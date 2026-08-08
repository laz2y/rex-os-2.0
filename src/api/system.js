import { API_BASE } from "./config";

export async function getSystem() {
  const response = await fetch(`${API_BASE}/system`);

  if (!response.ok) {
    throw new Error("Failed to load system information.");
  }

  return response.json();
}
