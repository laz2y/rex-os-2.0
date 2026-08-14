import { API_BASE } from "./config";

/** GET /api/activity — filtered activity log (severity, service, type, search, since, limit). */
export async function getActivity(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  const response = await fetch(`${API_BASE}/activity${query ? `?${query}` : ""}`);
  if (!response.ok) throw new Error("Failed to load activity.");
  return response.json();
}

/** DELETE /api/activity — clear the whole log. */
export async function clearActivity() {
  const response = await fetch(`${API_BASE}/activity`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to clear activity.");
  return response.json();
}
