import { API_BASE } from "./config";

/** GET /api/notifications — list + unread count. */
export async function getNotifications(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  const response = await fetch(`${API_BASE}/notifications${query ? `?${query}` : ""}`);
  if (!response.ok) throw new Error("Failed to load notifications.");
  return response.json();
}

/** POST /api/notifications/read — mark one (or all when id omitted) as read. */
export async function markNotificationRead(id = null) {
  const response = await fetch(`${API_BASE}/notifications/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(id ? { id } : {}),
  });
  if (!response.ok) throw new Error("Failed to update notifications.");
  return response.json();
}

/** DELETE /api/notifications/:id — remove a single notification. */
export async function removeNotification(id) {
  const response = await fetch(`${API_BASE}/notifications/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to remove notification.");
  return response.json();
}

/** DELETE /api/notifications — clear all. */
export async function clearNotifications() {
  const response = await fetch(`${API_BASE}/notifications`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to clear notifications.");
  return response.json();
}
