import apiClient from "./apiClient";

/**
 * Pipeline → REX API → per-service backend services.
 * The browser never talks to pyLoad/qBittorrent/Radarr/Sonarr directly and
 * never sees their credentials — only sanitized status + stats.
 */

/** Full pipeline payload: { services: {...}, activity: [...] }. */
export async function getPipeline() {
  const { data } = await apiClient.get("/pipeline");
  return data;
}
