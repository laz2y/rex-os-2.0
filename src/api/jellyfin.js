import { API_BASE } from "./config";

export async function getJellyfin() {
  const response = await fetch(`${API_BASE}/jellyfin`);

  if (!response.ok) {
    throw new Error("Failed to load Jellyfin information.");
  }

  return response.json();
}
