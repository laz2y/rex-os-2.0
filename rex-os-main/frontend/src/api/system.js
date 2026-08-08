const API = "http://localhost:4000";

export async function getSystem() {
  const response = await fetch(`${API}/api/system`);

  if (!response.ok) {
    throw new Error("Failed to load system information.");
  }

  return response.json();
}