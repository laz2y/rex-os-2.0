import { API_BASE } from "./config";

/** GET /api/system/connections — status of every NAS service (via Express). */
export async function getConnections() {
  const response = await fetch(`${API_BASE}/system/connections`);

  if (!response.ok) {
    throw new Error("Failed to load connections.");
  }

  return response.json();
}

/** POST /api/system/connections/:id/test — server-side probe for one service. */
export async function testConnection(id) {
  const response = await fetch(
    `${API_BASE}/system/connections/${encodeURIComponent(id)}/test`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error("Connection test failed.");
  }

  return response.json();
}
