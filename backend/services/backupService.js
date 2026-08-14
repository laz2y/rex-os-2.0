const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const stateStore = require("./stateStore");
const activity = require("./activityService");
const notification = require("./notificationService");

/**
 * REX OS Backups — snapshots the REX OS state/configuration that matters
 * (backend/data/* JSON state, notifications, activity, pipeline state,
 * recovery state, update state) plus a version marker.
 *
 * Rules:
 *   - NEVER backs up user media or download libraries (that is the job of
 *     the NAS / media apps, not REX OS).
 *   - NEVER includes secrets: backend/.env, backend/.auth-secrets.json and
 *     node_modules are excluded. .env.example (no secrets) is included.
 *   - Backups live in backend/data/backups/ (gitignored with the rest of
 *     data/); a backup never includes other backups or the updater tree.
 *   - Restore swaps files in via a temp dir so a bad archive can never
 *     leave REX state half-written.
 *   - A scheduler (REX_BACKUP_INTERVAL, default 24h) creates automatic
 *     daily backups; each is recorded in Activity + a notification.
 */

const APP_VERSION = process.env.REX_APP_VERSION || "3.0.0";

const DATA_DIR = stateStore.DATA_DIR;
const BACKUPS_DIR = path.join(DATA_DIR, "backups");

const INTERVAL_MS = Math.max(
  60 * 60 * 1000, // never more often than hourly
  Number.parseInt(process.env.REX_BACKUP_INTERVAL, 10) || 24 * 60 * 60 * 1000
);

function ensureDir() {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

function nextId() {
  return `backup-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function listEntries(archivePath) {
  const out = execSync(`tar -tvzf ${shellQuote(archivePath)}`, {
    encoding: "utf8",
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return out
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const typeChar = line[0] || "";
      const kind =
        typeChar === "l" || typeChar === "h"
          ? "link"
          : typeChar === "d"
          ? "dir"
          : "file";
      const name = line.slice(line.indexOf(" ") + 1).split(/\s+/, 6).pop() || "";
      return { kind, name: name.replace(/\/$/, "") };
    });
}

function pathSafe(name) {
  if (!name || name.startsWith("/")) return false;
  return !name.split("/").some((part) => part === "..");
}

function validateArchive(archivePath) {
  let entries;
  try {
    entries = listEntries(archivePath);
  } catch (error) {
    return { ok: false, error: `Cannot read the backup: ${error.message}` };
  }
  if (!entries.length) return { ok: false, error: "The backup archive is empty." };
  for (const entry of entries) {
    if (!pathSafe(entry.name)) {
      return { ok: false, error: `Unsafe path in backup: ${entry.name}` };
    }
    if (entry.kind === "link") {
      return { ok: false, error: `Backup contains a link — rejected: ${entry.name}` };
    }
  }
  return { ok: true, entries };
}

function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

/** Write the version marker included in every backup. */
function writeVersionMarker(dir) {
  fs.writeFileSync(
    path.join(dir, "rexos-version.json"),
    JSON.stringify(
      {
        app: "REX OS",
        version: APP_VERSION,
        createdAt: new Date().toISOString(),
        note: "State snapshot — no media, no secrets.",
      },
      null,
      2
    )
  );
}

/**
 * Create a backup tarball of REX OS state. Returns metadata; never throws.
 */
function createBackup(type = "manual") {
  ensureDir();

  const id = nextId();
  const dir = path.join(BACKUPS_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  writeVersionMarker(dir);

  const archiveName = "rex-state.tar.gz";
  const archivePath = path.join(dir, archiveName);

  const excludes = [
    "--exclude=backups",
    "--exclude=updates",
    "--exclude=.env",
    "--exclude=.auth-secrets.json",
    "--exclude=node_modules",
  ].join(" ");

  const backendDir = path.join(DATA_DIR, "..");
  const include = ["data"];
  if (fs.existsSync(path.join(backendDir, ".env.example"))) include.push(".env.example");

  execSync(
    `tar -czf ${shellQuote(archivePath)} ${excludes} -C ${shellQuote(backendDir)} ${include.join(" ")}`,
    { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
  );

  const meta = {
    id,
    type, // manual | auto
    createdAt: new Date().toISOString(),
    version: APP_VERSION,
    bytes: fs.statSync(archivePath).size,
    archive: archiveName,
    contents: listEntries(archivePath)
      .filter((entry) => entry.kind === "file")
      .map((entry) => entry.name),
  };
  fs.writeFileSync(path.join(dir, "backup.json"), JSON.stringify(meta, null, 2));

  activity.record({
    type: "backup",
    service: "rexos",
    action: type === "auto" ? "backup_auto" : "backup_created",
    result: "success",
    message: `${type === "auto" ? "Automatic" : "Manual"} backup ${id} created (${(meta.bytes / 1048576).toFixed(1)} MB)`,
    severity: "info",
  });

  return meta;
}

/** List backups, newest first. */
function listBackups() {
  ensureDir();
  const backups = [];
  for (const entry of fs.readdirSync(BACKUPS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(BACKUPS_DIR, entry.name, "backup.json");
    try {
      backups.push(JSON.parse(fs.readFileSync(metaPath, "utf8")));
    } catch {
      /* skip unreadable backups */
    }
  }
  return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Restore a backup into backend/data. The archive is validated, extracted
 * to a temp dir, then state files are swapped in atomically.
 */
function restoreBackup(id) {
  const backup = listBackups().find((b) => b.id === id);
  if (!backup) return { ok: false, error: "Backup not found." };

  const archivePath = path.join(BACKUPS_DIR, backup.id, backup.archive);
  if (!fs.existsSync(archivePath)) {
    return { ok: false, error: "Backup archive missing on disk." };
  }

  const valid = validateArchive(archivePath);
  if (!valid.ok) return { ok: false, error: `Backup failed validation: ${valid.error}` };

  const tmp = path.join(BACKUPS_DIR, `.restore-${backup.id}`);
  rmrf(tmp);
  fs.mkdirSync(tmp, { recursive: true });
  execSync(
    `tar -xzf ${shellQuote(archivePath)} -C ${shellQuote(tmp)} --no-same-owner`,
    { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
  );

  const dataTmp = path.join(tmp, "data");
  if (!fs.existsSync(dataTmp)) {
    rmrf(tmp);
    return { ok: false, error: "Backup has no data/ directory — nothing to restore." };
  }

  for (const entry of fs.readdirSync(dataTmp)) {
    const from = path.join(dataTmp, entry);
    const to = path.join(DATA_DIR, entry);
    rmrf(to);
    fs.cpSync(from, to, { recursive: true });
  }
  rmrf(tmp);

  activity.record({
    type: "backup",
    service: "rexos",
    action: "backup_restored",
    result: "success",
    message: `Restored REX OS state from backup ${backup.id}`,
    severity: "warning",
  });
  notification.push({
    type: "backup_restored",
    service: "rexos",
    severity: "warning",
    title: "Backup restored",
    message: `REX OS state was restored from backup ${backup.id}.`,
    dedupeKey: `backup-restored:${backup.id}`,
  });

  return { ok: true, backup };
}

/** Delete a backup by id. */
function deleteBackup(id) {
  const backup = listBackups().find((b) => b.id === id);
  if (!backup) return { ok: false, error: "Backup not found." };

  rmrf(path.join(BACKUPS_DIR, backup.id));

  activity.record({
    type: "backup",
    service: "rexos",
    action: "backup_deleted",
    result: "success",
    message: `Deleted backup ${backup.id}`,
    severity: "info",
  });

  return { ok: true, id };
}

/* ------------------------------------------------------------------ */
/* Scheduler                                                           */
/* ------------------------------------------------------------------ */

let timer = null;
let running = false;
let lastAutoKey = null;

async function autoBackupCycle() {
  if (running) return;
  running = true;
  try {
    const day = new Date().toISOString().slice(0, 10);
    if (lastAutoKey === day) return; // one automatic backup per day
    const meta = createBackup("auto");
    lastAutoKey = day;
    notification.push({
      type: "backup_complete",
      service: "rexos",
      severity: "info",
      title: "Automatic backup complete",
      message: `REX OS state backed up (${(meta.bytes / 1048576).toFixed(1)} MB).`,
      dedupeKey: `backup-auto:${day}`,
    });
  } catch (error) {
    console.error(`[backups] auto cycle error: ${error.message}`);
  } finally {
    running = false;
  }
}

/** Start the automatic backup scheduler (idempotent, guarded for tests). */
function startScheduler() {
  if (timer) return;
  if (process.env.REX_DISABLE_BACKUPS === "true") return;
  // First automatic backup shortly after boot, then on the interval.
  setTimeout(() => autoBackupCycle(), 45000);
  timer = setInterval(() => autoBackupCycle(), INTERVAL_MS);
  console.log(
    `💾 Automatic backups enabled (every ${Math.round(INTERVAL_MS / 3600000)}h)`
  );
}

/** Stop the scheduler (used by tests). */
function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

ensureDir();

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  startScheduler,
  stopScheduler,
  INTERVAL_MS,
  BACKUPS_DIR,
};
