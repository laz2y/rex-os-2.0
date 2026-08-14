import { getNotifications } from "../api/notifications";

/**
 * REX OS Push Notifications (graceful fallback).
 *
 * True web-push (service worker + VAPID + a push provider) is not possible
 * for a self-hosted NAS without an external push service, so this module
 * implements the honest fallback: while REX OS is open (or installed as a
 * PWA and running), it watches the server-side notification feed and shows
 * a browser Notification for every new, enabled event.
 *
 * Behavior:
 *   - Preferences live in localStorage (master switch + per-category).
 *   - A "seen" set prevents re-notifying for the same event.
 *   - Polling only happens while the tab is visible; one poll per 30s.
 *   - The browser permission is requested only from user interaction
 *     (Settings → Notifications → Enable), never silently.
 *   - If permission is denied, notifications are simply skipped — the in-app
 *     Notifications page still works as before.
 */

const PREFS_KEY = "rexos_push_prefs";
const SEEN_KEY = "rexos_push_seen";
const POLL_MS = 30000;

/** Every notification type the backend can emit, mapped to a UI category. */
export const CATEGORIES = [
  { id: "service_failed", label: "Service failed" },
  { id: "service_recovered", label: "Service recovered" },
  { id: "service_restarted", label: "Service restarted" },
  { id: "container_stopped", label: "Container stopped" },
  { id: "storage_warning", label: "Storage warning" },
  { id: "storage_critical", label: "Storage critical" },
  { id: "download_failed", label: "Download failed" },
  { id: "update_ready", label: "Update ready" },
  { id: "backup_complete", label: "Backup complete" },
  { id: "backup_restored", label: "Backup restored" },
  { id: "other", label: "Other events" },
];

const DEFAULT_PREFS = {
  enabled: false,
  categories: Object.fromEntries(CATEGORIES.map((cat) => [cat.id, true])),
};

function readPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS, categories: { ...DEFAULT_PREFS.categories } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      categories: { ...DEFAULT_PREFS.categories, ...(parsed.categories || {}) },
    };
  } catch {
    return { ...DEFAULT_PREFS, categories: { ...DEFAULT_PREFS.categories } };
  }
}

export function getPrefs() {
  return readPrefs();
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* storage unavailable — prefs won't persist */
  }
}

function readSeen() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen) {
  try {
    // Cap the seen set — old ids are never needed again.
    const list = [...seen];
    localStorage.setItem(SEEN_KEY, JSON.stringify(list.slice(-500)));
  } catch {
    /* best effort */
  }
}

/** Category for a notification (falls back to "other"). */
function categoryFor(notification) {
  return CATEGORIES.some((cat) => cat.id === notification.type)
    ? notification.type
    : "other";
}

/** True when this notification should produce a browser Notification. */
function shouldNotify(notification, prefs) {
  if (!prefs.enabled) return false;
  if (!("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  const category = categoryFor(notification);
  if (prefs.categories[category] === false) return false;
  return true;
}

/** Request browser notification permission (must come from a user gesture). */
export async function requestPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/** Permission state without prompting. */
export function permissionState() {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

let timer = null;
let started = false;

function showNotification(notification) {
  try {
    const body = notification.message || notification.title || "REX OS event";
    new Notification(`REX OS · ${notification.title || "Notification"}`, {
      body,
      tag: `rexos-${notification.id}`,
      icon: "/icons/icon-192.png",
      silent: false,
    });
  } catch {
    /* notifications unsupported — fall back to the in-app list */
  }
}

async function poll() {
  if (document.hidden) return;

  let data;
  try {
    data = await getNotifications({ limit: 30 });
  } catch {
    return; // backend unreachable — try again next tick
  }

  const prefs = readPrefs();
  const seen = readSeen();
  let changed = false;

  for (const entry of data.entries || []) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    changed = true;
    if (shouldNotify(entry, prefs)) showNotification(entry);
  }

  if (changed) writeSeen(seen);
}

/** Start polling (idempotent). */
export function startPushMonitor() {
  if (started) return;
  started = true;
  poll();
  timer = setInterval(poll, POLL_MS);
}

/** Stop polling (used for tests / teardown). */
export function stopPushMonitor() {
  started = false;
  if (timer) clearInterval(timer);
  timer = null;
}
