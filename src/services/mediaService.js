import apiClient from "./apiClient";

/**
 * Media Center → REX API → Radarr/Sonarr.
 * All ARR credentials stay on the server; the browser only calls
 * /api/radarr and /api/sonarr.
 */

/** GET /api/radarr/overview — library, missing, queue and recent events. */
export async function getRadarrOverview() {
  const { data } = await apiClient.get("/radarr/overview");
  return data;
}

/** GET /api/sonarr/overview — library, missing, queue and recent events. */
export async function getSonarrOverview() {
  const { data } = await apiClient.get("/sonarr/overview");
  return data;
}
