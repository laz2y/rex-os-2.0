const fs = require("fs");
const path = require("path");

/**
 * Minimal JSON state store for REX OS — no database. Each collection lives
 * in a gitignored JSON file under backend/data/ and is written atomically
 * (temp file + rename) so a crash mid-write can never corrupt the state.
 *
 * This is the same persistence choice the updater design makes (see
 * rex-updater/DESIGN.md — "JSON state files (atomic write + fsync)"), so
 * REX OS 3.0 keeps one consistent storage approach across the project.
 *
 * Deployments should mount backend/data/ as a persistent volume so state
 * survives container recreation.
 */

const DATA_DIR = path.join(__dirname, "..", "data");

/** Ensure the data directory exists (no-op when it already does). */
function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** Read a collection file; returns [] when absent or corrupt. */
function readCollection(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Missing file is the normal first-run case; corrupt JSON degrades to
    // an empty collection rather than crashing the API.
    return [];
  }
}

/** Atomically persist a collection (temp file + rename + fsync). */
function writeCollection(name, collection) {
  atomicWrite(name, collection);
}

/** Read a generic JSON object file; returns defaultValue when absent/corrupt. */
function readJson(name, defaultValue = {}) {
  const file = path.join(DATA_DIR, `${name}.json`);
  try {
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : defaultValue;
  } catch {
    return defaultValue;
  }
}

/** Atomically persist a generic JSON object (temp file + rename + fsync). */
function writeJson(name, value) {
  atomicWrite(name, value);
}

function atomicWrite(name, value) {
  ensureDir();
  const file = path.join(DATA_DIR, `${name}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  const json = JSON.stringify(value, null, 2);
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeFileSync(fd, json, "utf8");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

module.exports = {
  DATA_DIR,
  readCollection,
  writeCollection,
  readJson,
  writeJson,
};
