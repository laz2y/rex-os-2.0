const API = "http://localhost:4000";

export async function getDocker() {
  const response = await fetch(`${API}/api/docker`);

  if (!response.ok) {
    throw new Error("Failed to load docker information.");
  }

  return response.json();
}