const stateStore = require("./stateStore");

/**
 * Centralized Activity Log for REX OS — persisted JSON, capped so it can
 * never grow without bound on a NAS. Every important action/event is
 * recorded here: user actions, service restarts, automatic recovery, Docker
 * changes, pipeline events, downloads, diagnostics, errors.
 *
 * Event shape: { id, time, type, service, action, result, message, severity }
 * severity ∈ info | success | warning | error | critical
 */

const COLLECTION = "activity";
const MAX_ENTRIES = 500;

let sequence = 0;

function nextId() {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Record an activity entry. Entries are prepended (newest first). The
 * collection is capped to MAX_ENTRIES on every write.
 */
function record({ type = "event", service = "rexos", action = "", result = "success", message = "", severity = "info" }) {
  const collection = stateStore.readCollection(COLLECTION);
  collection.unshift({
    id: nextId(),
    time: new Date().toISOString(),
    type,
    service,
    action,
    result,
    message,
    severity,
  });
  const capped = collection.slice(0, MAX_ENTRIES);
  stateStore.writeCollection(COLLECTION, capped);
  return capped[0];
}

/**
 * List activity entries with optional filters:
 *   severity (comma list), service (comma list), type, search (text),
 *   since (ISO), limit (default 100).
 */
function list(filters = {}) {
  const collection = stateStore.readCollection(COLLECTION);

  const severities = (filters.severity || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const services = (filters.service || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const types = (filters.type || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const search = String(filters.search || "").trim().toLowerCase();
  const since = filters.since ? new Date(filters.since).getTime() : null;
  const limit = Math.min(500, Math.max(1, Number.parseInt(filters.limit, 10) || 100));

  const filtered = collection.filter((entry) => {
    if (severities.length && !severities.includes(entry.severity)) return false;
    if (services.length && !services.includes(String(entry.service).toLowerCase())) return false;
    if (types.length && !types.includes(String(entry.type).toLowerCase())) return false;
    if (since && new Date(entry.time).getTime() < since) return false;
    if (search) {
      const haystack = `${entry.message} ${entry.action} ${entry.service} ${entry.type}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return {
    total: filtered.length,
    entries: filtered.slice(0, limit),
  };
}

/** Completely clear the log (used by the UI "Clear" action). */
function clear() {
  stateStore.writeCollection(COLLECTION, []);
  return { cleared: true };
}

module.exports = {
  record,
  list,
  clear,
  MAX_ENTRIES,
};
