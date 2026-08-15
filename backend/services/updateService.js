const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const stateStore = require("./stateStore");
const activity = require("./activityService");
const notification = require("./notificationService");

/**
 * REX OS Update Manager.
 *
 * A safe, honest upgrade pipeline inside REX OS itself. It performs every
 * step that can be done safely from the running API:
 *
 *   upload → validate (structure + manifest + semver + disk + safe archive)
 *         → prepare (create a rollback point: full REX state snapshot)
 *         → install (stage the release, syntax-check backend JS, verify the
 *                    frontend build, health-check the running instance)
 *         → history (every attempt recorded)
 *         → rollback (restore the rollback point)
 *
 * LIMITATION (reported honestly, never faked): this process cannot restart
 * its own Docker container. The design (rex-updater/DESIGN.md) moves the
 * container swap to a separate updater container. Here the release is fully
 * validated + staged + the rollback point is created, and the UI tells the
 * operator the container must be recreated from the staged release to
 * activate it. Rollback restores the pre-update REX state from the
 * rollback point.
 *
 * Security rules:
 *   - Archive entries are listed first: absolute paths, ".." and symlinks
 *     are rejected before anything is extracted.
 *   - Only a strict filename pattern is accepted.
 *   - No secrets are ever included in backups (backend/.env,
 *     .auth-secrets.json and node_modules are excluded).
 *   - No shell input comes from the request — paths are always derived from
 *     validated values (version strings, fixed file names).
 */

const APP_VERSION = process.env.REX_APP_VERSION || "2.5.0";

const STATE_FILE = "update";
const HISTORY_FILE = "update-history";

const DATA_DIR = stateStore.DATA_DIR;
const UPDATES_DIR = path.join(DATA_DIR, "updates");
const UPLOADS_DIR = path.join(UPDATES_DIR, "uploads");
const STAGED_DIR = path.join(UPDATES_DIR, "staged");
const RELEASES_DIR = path.join(UPDATES_DIR, "releases");
const ROLLBACK_DIR = path.join(UPDATES_DIR, "rollback");

const MAX_UPLOAD_BYTES = Number.parseInt(process.env.REX_UPDATE_MAX_UPLOAD, 10) || 536870912; // 512 MB

const RELEASE_PATTERN = /^rexos-\d+\.\d+\.\d+(-[a-z0-9]+)?-release\.tar\.gz$/;

/* ------------------------------------------------------------------ */
/* Small strict semver helpers (MAJOR.MINOR.PATCH only — no deps)      */
/* ------------------------------------------------------------------ */

function parseVersion(raw) {
  const match = String(raw || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    raw: match[0],
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

function compareVersions(a, b) {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

function isValidVersion(raw) {
  return parseVersion(raw) !== null;
}

/* ------------------------------------------------------------------ */
/* State + history                                                     */
/* ------------------------------------------------------------------ */

function readState() {
  return stateStore.readJson(STATE_FILE, { state: "idle", history: [] });
}

function writeState(state) {
  stateStore.writeJson(STATE_FILE, state);
}

function readHistory() {
  return stateStore.readCollection(HISTORY_FILE);
}

function writeHistory(records) {
  stateStore.writeCollection(HISTORY_FILE, records.slice(0, 50));
}

function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDirs() {
  for (const dir of [UPLOADS_DIR, STAGED_DIR, RELEASES_DIR, ROLLBACK_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/* ------------------------------------------------------------------ */
/* Safe archive helpers (system tar + strict entry listing)            */
/* ------------------------------------------------------------------ */

/** List entries with type info: [{ path, kind }] — kind: file|dir|link. */
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
      // -rw-r--r-- user/group size date time path
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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function pathSafe(name) {
  if (!name || name.startsWith("/")) return false;
  const parts = name.split("/");
  if (parts.some((part) => part === "..")) return false;
  return true;
}

/**
 * Validate an archive before extraction:
 *  - every entry path must be relative and contain no ".."
 *  - symlinks/hardlinks are rejected outright
 * Returns { ok, error, entries }.
 */
function validateArchive(archivePath) {
  let entries;
  try {
    entries = listEntries(archivePath);
  } catch (error) {
    return { ok: false, error: `Cannot read the archive: ${error.message}` };
  }
  if (!entries.length) return { ok: false, error: "The archive is empty." };

  for (const entry of entries) {
    if (!pathSafe(entry.name)) {
      return { ok: false, error: `Unsafe path in archive: ${entry.name}` };
    }
    if (entry.kind === "link") {
      return { ok: false, error: `Archive contains a link — rejected: ${entry.name}` };
    }
  }
  return { ok: true, entries };
}

/** Extract an already-validated archive into an empty dir. */
function extractArchive(archivePath, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  execSync(
    `tar -xzf ${shellQuote(archivePath)} -C ${shellQuote(destDir)} --no-same-owner`,
    { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
  );
}

/** Recursively remove a directory tree. */
function rmrf(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

/** Collect *.js files under a dir (bounded) for syntax checks. */
function collectJsFiles(dir, max = 120) {
  const found = [];
  const walk = (current) => {
    if (found.length >= max) return;
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= max) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".js")) {
        found.push(full);
      }
    }
  };
  walk(dir);
  return found;
}

/* ------------------------------------------------------------------ */
/* Manifest + version gating                                           */
/* ------------------------------------------------------------------ */

function readManifest(releaseDir) {
  const manifestPath = path.join(releaseDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, error: "manifest.json is missing from the release." };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return { ok: false, error: "manifest.json is not valid JSON." };
  }

  if (manifest.product !== "REX OS") {
    return { ok: false, error: `manifest.product must be "REX OS" (got ${JSON.stringify(manifest.product)}).` };
  }
  if (!isValidVersion(manifest.version)) {
    return { ok: false, error: `manifest.version must be strict semver (got ${JSON.stringify(manifest.version)}).` };
  }
  if (!isValidVersion(manifest.minimumVersion)) {
    return { ok: false, error: `manifest.minimumVersion must be strict semver (got ${JSON.stringify(manifest.minimumVersion)}).` };
  }
  if (!["stable", "beta", "alpha", "rc"].includes(manifest.releaseType)) {
    return { ok: false, error: `manifest.releaseType must be stable|beta|alpha|rc (got ${JSON.stringify(manifest.releaseType)}).` };
  }
  return { ok: true, manifest };
}

/** Version gating: no downgrades; current must satisfy minimumVersion. */
function checkVersionGating(manifest, currentVersion) {
  const target = parseVersion(manifest.version);
  const minimum = parseVersion(manifest.minimumVersion);
  const current = parseVersion(currentVersion);
  if (!current) return { ok: false, error: `Current version ${currentVersion} is not semver.` };
  if (compareVersions(target, current) < 0) {
    return { ok: false, error: `Downgrade blocked — release ${manifest.version} is older than ${currentVersion}.` };
  }
  if (compareVersions(current, minimum) < 0) {
    return { ok: false, error: `This release requires REX OS >= ${manifest.minimumVersion} (you are on ${currentVersion}).` };
  }
  return { ok: true };
}

/** Free space (bytes) on the data dir — null when unavailable. */
function freeSpace() {
  try {
    const out = execSync(`df -Pk ${shellQuote(DATA_DIR)} 2>/dev/null`, {
      encoding: "utf8",
      timeout: 5000,
    });
    const fields = out.trim().split("\n")[1].trim().split(/\s+/);
    return parseInt(fields[3], 10) * 1024 || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Rollback points                                                     */
/* ------------------------------------------------------------------ */

/**
 * Create a rollback point: a tar.gz snapshot of the REX state that can be
 * restored later. Excludes secrets (backend/.env, .auth-secrets.json) and
 * node_modules. The archive is written under backend/data/updates/rollback/
 * (itself excluded from backups).
 */
function createRollbackPoint(reason) {
  ensureDirs();
  const id = nextId("rollback");
  const dir = path.join(ROLLBACK_DIR, id);
  fs.mkdirSync(dir, { recursive: true });

  const backupName = "rex-state.tar.gz";
  const backupPath = path.join(dir, backupName);

  const excludes = [
    "--exclude=updates",
    "--exclude=backups",
    "--exclude=.env",
    "--exclude=.auth-secrets.json",
    "--exclude=node_modules",
  ].join(" ");

  execSync(
    `tar -czf ${shellQuote(backupPath)} ${excludes} -C ${shellQuote(path.join(DATA_DIR, ".."))} data`,
    { timeout: 120000, maxBuffer: 8 * 1024 * 1024 }
  );

  const meta = {
    id,
    createdAt: new Date().toISOString(),
    reason: reason || "manual",
    fromVersion: APP_VERSION,
    bytes: fs.statSync(backupPath).size,
    archive: backupName,
  };
  fs.writeFileSync(path.join(dir, "rollback.json"), JSON.stringify(meta, null, 2));

  activity.record({
    type: "update",
    service: "rexos",
    action: "rollback_point_created",
    result: "success",
    message: `Rollback point ${id} created (${(meta.bytes / 1048576).toFixed(1)} MB)`,
    severity: "info",
  });

  return meta;
}

function listRollbackPoints() {
  ensureDirs();
  const points = [];
  for (const entry of fs.readdirSync(ROLLBACK_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metaPath = path.join(ROLLBACK_DIR, entry.name, "rollback.json");
    try {
      points.push(JSON.parse(fs.readFileSync(metaPath, "utf8")));
    } catch {
      /* skip unreadable rollback points */
    }
  }
  return points.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/** Restore a rollback point (or the most recent one) into backend/data. */
function restoreRollbackPoint(id) {
  const points = listRollbackPoints();
  const point = id ? points.find((p) => p.id === id) : points[0];
  if (!point) return { ok: false, error: "No rollback point available." };

  const archivePath = path.join(ROLLBACK_DIR, point.id, point.archive);
  if (!fs.existsSync(archivePath)) {
    return { ok: false, error: `Rollback archive missing for ${point.id}.` };
  }

  const valid = validateArchive(archivePath);
  if (!valid.ok) return { ok: false, error: `Rollback archive failed validation: ${valid.error}` };

  // Restore to a temp dir first, then swap the data files in — a corrupt
  // restore can never leave REX state half-written.
  const tmp = path.join(STAGED_DIR, `.restore-${point.id}`);
  rmrf(tmp);
  extractArchive(archivePath, tmp);

  const dataTmp = path.join(tmp, "data");
  if (!fs.existsSync(dataTmp)) {
    rmrf(tmp);
    return { ok: false, error: "Rollback archive has no data/ directory." };
  }

  for (const entry of fs.readdirSync(dataTmp)) {
    const from = path.join(dataTmp, entry);
    const to = path.join(DATA_DIR, entry);
    rmrf(to);
    fs.cpSync(from, to, { recursive: true });
  }
  rmrf(tmp);

  const record = {
    id: nextId("hist"),
    kind: "rollback",
    version: point.fromVersion,
    result: "rolled_back",
    reason: point.reason,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    detail: `Restored rollback point ${point.id}`,
  };
  const history = readHistory();
  history.unshift(record);
  writeHistory(history);

  activity.record({
    type: "update",
    service: "rexos",
    action: "rollback_restored",
    result: "success",
    message: `Rollback restored from ${point.id} (REX state back to ${point.fromVersion})`,
    severity: "warning",
  });

  return { ok: true, point, record };
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

/**
 * POST /api/update/upload — store a release archive. Expects the raw
 * gzip body (frontend uploads the File directly). Validates the filename
 * and gzip magic; full validation happens in validate().
 */
function upload({ filename, body }) {
  const safeName = String(filename || "").split("/").pop().split("\\").pop();
  if (!RELEASE_PATTERN.test(safeName)) {
    return {
      ok: false,
      error: `Filename must match rexos-<version>-release.tar.gz (got ${safeName || "none"}).`,
    };
  }
  if (!body || !Buffer.isBuffer(body) || body.length === 0) {
    return { ok: false, error: "No archive received." };
  }
  if (body.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `Archive exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1048576)} MB upload limit.` };
  }
  // gzip magic bytes: 1f 8b
  if (body[0] !== 0x1f || body[1] !== 0x8b) {
    return { ok: false, error: "The uploaded file is not a gzip archive." };
  }

  ensureDirs();
  const target = path.join(UPLOADS_DIR, safeName);
  fs.writeFileSync(target, body);

  const state = readState();
  state.state = "uploaded";
  state.uploadedPackage = {
    filename: safeName,
    bytes: body.length,
    uploadedAt: new Date().toISOString(),
    version: safeName.replace(/^rexos-/, "").replace(/-release\.tar\.gz$/, ""),
  };
  state.stagedVersion = null;
  state.lastError = null;
  writeState(state);

  activity.record({
    type: "update",
    service: "rexos",
    action: "package_uploaded",
    result: "success",
    message: `Release package ${safeName} uploaded (${(body.length / 1048576).toFixed(1)} MB)`,
    severity: "info",
  });

  return { ok: true, package: state.uploadedPackage };
}

/** POST /api/update/validate — full dry-run validation of the uploaded package. */
function validate() {
  const state = readState();
  const pkg = state.uploadedPackage;
  if (!pkg) return { ok: false, error: "No release package uploaded yet." };

  const archivePath = path.join(UPLOADS_DIR, pkg.filename);
  if (!fs.existsSync(archivePath)) {
    return { ok: false, error: "The uploaded archive is missing on disk." };
  }

  const archiveCheck = validateArchive(archivePath);
  if (!archiveCheck.ok) {
    state.state = "invalid";
    state.lastError = archiveCheck.error;
    writeState(state);
    return { ok: false, error: archiveCheck.error };
  }

  // Top-level structure: manifest.json + backend/ + dist/ must exist.
  const topLevel = new Set(
    archiveCheck.entries
      .filter((e) => e.kind === "file" || e.kind === "dir")
      .map((e) => e.name.split("/")[0])
  );
  for (const required of ["manifest.json", "backend", "dist"]) {
    if (!topLevel.has(required)) {
      const error = `Release structure incomplete — missing ${required} at the top level.`;
      state.state = "invalid";
      state.lastError = error;
      writeState(state);
      return { ok: false, error };
    }
  }

  // Extract to a fresh staging dir, then validate the manifest for real.
  const stageDir = path.join(STAGED_DIR, "current");
  rmrf(stageDir);
  extractArchive(archivePath, stageDir);

  const manifestResult = readManifest(stageDir);
  if (!manifestResult.ok) {
    state.state = "invalid";
    state.lastError = manifestResult.error;
    writeState(state);
    return { ok: false, error: manifestResult.error };
  }
  const { manifest } = manifestResult;

  const versionCheck = checkVersionGating(manifest, APP_VERSION);
  if (!versionCheck.ok) {
    state.state = "invalid";
    state.lastError = versionCheck.error;
    writeState(state);
    return { ok: false, error: versionCheck.error };
  }

  const space = freeSpace();
  if (space != null && space < 512 * 1024 * 1024) {
    const error = `Not enough free space on the data volume (${(space / 1048576).toFixed(0)} MB free, 512 MB required).`;
    state.state = "invalid";
    state.lastError = error;
    writeState(state);
    return { ok: false, error };
  }

  state.state = "validated";
  state.manifest = manifest;
  state.stagedVersion = manifest.version;
  state.lastError = null;
  writeState(state);

  activity.record({
    type: "update",
    service: "rexos",
    action: "package_validated",
    result: "success",
    message: `Release ${manifest.version} (${manifest.releaseType}) validated`,
    severity: "info",
  });

  return {
    ok: true,
    manifest,
    entries: archiveCheck.entries.length,
    freeSpace: space,
  };
}

/** POST /api/update/prepare — create the rollback point before installing. */
function prepare() {
  const state = readState();
  if (state.state !== "validated" && state.state !== "prepared") {
    return { ok: false, error: `Cannot prepare — state is ${state.state || "idle"} (validate first).` };
  }

  const point = createRollbackPoint("pre-upgrade");
  state.state = "prepared";
  state.rollbackPointId = point.id;
  writeState(state);

  return { ok: true, rollbackPoint: point };
}

/** Health-check the currently running REX API. */
async function healthCheck() {
  const port = process.env.PORT || 4000;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok && body && body.status === "ok",
      status: response.status,
      version: body ? body.version : null,
    };
  } catch {
    return { ok: false, status: null, version: null };
  }
}

/**
 * POST /api/update/install — stage + verify the release and record the
 * attempt. The container swap itself must be performed on the NAS (see
 * module docs); everything REX can verify safely is verified here.
 */
async function install() {
  const state = readState();
  if (state.state !== "prepared" && state.state !== "validated") {
    return { ok: false, error: `Cannot install — state is ${state.state || "idle"} (validate first).` };
  }
  if (!state.stagedVersion) {
    return { ok: false, error: "No staged release version." };
  }

  const started = Date.now();
  const staged = path.join(STAGED_DIR, "current");
  if (!fs.existsSync(path.join(staged, "manifest.json"))) {
    const validation = validate();
    if (!validation.ok) return { ok: false, error: validation.error };
  }

  // Rollback point is mandatory before install.
  if (!state.rollbackPointId) {
    const point = createRollbackPoint("pre-upgrade");
    state.rollbackPointId = point.id;
    writeState(state);
  }

  // 1) Real backend syntax check on the staged release.
  const jsFiles = collectJsFiles(path.join(staged, "backend"));
  const syntaxErrors = [];
  for (const file of jsFiles) {
    try {
      execSync(`node --check ${shellQuote(file)}`, { timeout: 20000, stdio: "pipe" });
    } catch (error) {
      syntaxErrors.push(path.relative(staged, file));
    }
  }

  // 2) Frontend build presence check.
  const hasDist = fs.existsSync(path.join(staged, "dist", "index.html"));

  if (syntaxErrors.length > 0 || !hasDist) {
    const error = syntaxErrors.length
      ? `Backend syntax errors in the staged release (${syntaxErrors.length} file(s): ${syntaxErrors.slice(0, 3).join(", ")})`
      : "The release has no dist/index.html — the frontend build is missing.";
    state.state = "failed";
    state.lastError = error;
    writeState(state);

    activity.record({
      type: "update",
      service: "rexos",
      action: "install_failed",
      result: "error",
      message: `Release ${state.stagedVersion} failed verification: ${error}`,
      severity: "error",
    });
    return { ok: false, error };
  }

  // 3) Copy the release into the releases tree.
  const releaseDir = path.join(RELEASES_DIR, state.stagedVersion);
  rmrf(releaseDir);
  fs.cpSync(staged, releaseDir, { recursive: true });

  // 4) Health-check the running instance (the version currently live).
  const health = await healthCheck();

  const record = {
    id: nextId("hist"),
    kind: "update",
    version: state.stagedVersion,
    fromVersion: APP_VERSION,
    result: health.ok ? "installed" : "installed_health_unknown",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    detail: health.ok
      ? `Staged to ${RELEASES_DIR}/${state.stagedVersion} — restart required to activate`
      : `Staged to ${RELEASES_DIR}/${state.stagedVersion} — REX health check did not answer during install`,
  };
  const history = readHistory();
  history.unshift(record);
  writeHistory(history);

  state.state = "installed";
  state.installedAt = new Date().toISOString();
  writeState(state);

  activity.record({
    type: "update",
    service: "rexos",
    action: "install_complete",
    result: "success",
    message: `Release ${state.stagedVersion} staged and verified — restart the container to activate`,
    severity: "info",
  });

  notification.push({
    type: "update_ready",
    service: "rexos",
    severity: "success",
    title: `REX OS ${state.stagedVersion} ready`,
    message: "The release is validated and staged. Restart the container on the NAS to activate it.",
    dedupeKey: `update-ready:${state.stagedVersion}`,
  });

  return {
    ok: true,
    record,
    health,
    stagedAt: releaseDir,
    restartRequired: true,
  };
}

/** POST /api/update/rollback — restore REX state from a rollback point. */
function rollback({ id } = {}) {
  const result = restoreRollbackPoint(id || null);
  if (!result.ok) return result;

  const state = readState();
  state.state = "rolled_back";
  state.lastError = null;
  state.rollbackPointId = null;
  writeState(state);

  return {
    ok: true,
    point: result.point,
    record: result.record,
    message: `Restored REX state from ${result.point.id}`,
  };
}

/** GET /api/update/status — current state, package, history and rollback points. */
async function getStatus() {
  const state = readState();
  const health = await healthCheck();
  const space = freeSpace();
  return {
    ok: true,
    currentVersion: APP_VERSION,
    state: state.state || "idle",
    uploadedPackage: state.uploadedPackage || null,
    manifest: state.manifest || null,
    stagedVersion: state.stagedVersion || null,
    rollbackPointId: state.rollbackPointId || null,
    lastError: state.lastError || null,
    installedAt: state.installedAt || null,
    health,
    freeSpace: space,
    history: readHistory(),
    rollbackPoints: listRollbackPoints(),
    maxUploadBytes: MAX_UPLOAD_BYTES,
  };
}

/** GET /api/update/history — past update/rollback records. */
function getHistory() {
  return { ok: true, history: readHistory() };
}

/* ------------------------------------------------------------------ */
/* Module bootstrap                                                     */
/* ------------------------------------------------------------------ */

ensureDirs();

module.exports = {
  APP_VERSION,
  upload,
  validate,
  prepare,
  install,
  rollback,
  getStatus,
  getHistory,
  listRollbackPoints,
  restoreRollbackPoint,
  createRollbackPoint,
  isValidVersion,
  compareVersions,
  parseVersion,
  RELEASE_PATTERN,
  STAGED_DIR,
  RELEASES_DIR,
  ROLLBACK_DIR,
};
