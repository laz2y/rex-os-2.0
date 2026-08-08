import { API_BASE } from "./config";

/** GET /api/immich/overview — real Immich stats via Express (server-side key). */
export async function getImmichOverview() {
  const response = await fetch(`${API_BASE}/immich/overview`);

  if (!response.ok) {
    throw new Error("Failed to load Immich overview.");
  }

  return response.json();
}
