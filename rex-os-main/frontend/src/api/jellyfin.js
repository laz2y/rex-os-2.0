const API = "http://localhost:4000";

export async function getJellyfin() {
  const response = await fetch(`${API}/api/jellyfin`);

  if (!response.ok) {
    throw new Error("Failed to load Jellyfin information.");
  }

  return response.json();
}