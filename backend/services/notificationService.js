const stateStore = require("./stateStore");

/**
 * Centralized Notifications for REX OS — persisted JSON, capped. Events
 * include service failed/recovered, container stopped/restarted, download
 * failed, storage warning, pipeline failure/recovery, update events.
 *
 * Severity: info | success | warning | error | critical
 * Notifications are stored so they can be viewed later (unread/read state).
 */

const COLLECTION = "notifications";
const MAX_ENTRIES = 200;

let sequence = 0;

function nextId() {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Record a notification. Dedupe with `dedupeKey`: when provided, an existing
 * notification with the same key that is still unread is skipped — this
 * prevents the auto-recovery monitor from spamming identical alerts.
 */
function push({ type = "event", service = "rexos", severity = "info", title = "", message = "", dedupeKey = null }) {
  const collection = stateStore.readCollection(COLLECTION);

  if (dedupeKey) {
    const existing = collection.find(
      (entry) => entry.dedupeKey === dedupeKey && !entry.read
    );
    if (existing) return existing;
  }

  const notification = {
    id: nextId(),
    time: new Date().toISOString(),
    type,
    service,
    severity,
    title,
    message,
    dedupeKey: dedupeKey || undefined,
    read: false,
  };

  collection.unshift(notification);
  stateStore.writeCollection(COLLECTION, collection.slice(0, MAX_ENTRIES));
  return notification;
}

/** List notifications, newest first, with optional severity filter. */
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
  const limit = Math.min(200, Math.max(1, Number.parseInt(filters.limit, 10) || 100));

  const entries = collection
    .filter((entry) => {
      if (severities.length && !severities.includes(entry.severity)) return false;
      if (services.length && !services.includes(String(entry.service).toLowerCase())) return false;
      return true;
    })
    .slice(0, limit);

  return {
    total: collection.length,
    unread: collection.filter((entry) => !entry.read).length,
    entries,
  };
}

/** Mark one or all notifications as read. */
function markRead(id) {
  const collection = stateStore.readCollection(COLLECTION);
  let changed = false;
  for (const entry of collection) {
    if (!id || entry.id === id) {
      if (!entry.read) {
        entry.read = true;
        changed = true;
      }
      if (id) break;
    }
  }
  if (changed) stateStore.writeCollection(COLLECTION, collection);
  return { ok: true };
}

/** Remove a single notification. */
function remove(id) {
  const collection = stateStore.readCollection(COLLECTION);
  const next = collection.filter((entry) => entry.id !== id);
  if (next.length !== collection.length) {
    stateStore.writeCollection(COLLECTION, next);
    return { removed: true };
  }
  return { removed: false };
}

/** Clear all notifications. */
function clear() {
  stateStore.writeCollection(COLLECTION, []);
  return { cleared: true };
}

module.exports = {
  push,
  list,
  markRead,
  remove,
  clear,
  MAX_ENTRIES,
};
