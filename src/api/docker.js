import { API_BASE } from "./config";

export async function getDocker() {
  const response = await fetch(`${API_BASE}/docker`);

  if (!response.ok) {
    throw new Error("Failed to load docker information.");
  }

  return response.json();
}
