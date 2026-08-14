import { API_BASE } from "./config";

/** GET /api/diagnostics — runs a full server-side report and returns it. */
export async function getDiagnostics() {
  const response = await fetch(`${API_BASE}/diagnostics`);
  if (!response.ok) throw new Error("Failed to run diagnostics.");
  return response.json();
}
