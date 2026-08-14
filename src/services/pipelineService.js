import apiClient from "./apiClient";

/**
 * Pipeline → REX API → per-service backend services.
 * The browser never talks to pyLoad/qBittorrent/Radarr/Sonarr directly and
 * never sees their credentials — only sanitized status + stats.
 */

/** Full pipeline payload: { services: {...}, activity: [...], pipeline: {...} }. */
export async function getPipeline() {
  const { data } = await apiClient.get("/pipeline");
  return data;
}

/** POST /api/pipeline/restart/:service — controlled restart + health verify. */
export async function restartPipelineService(service) {
  const { data } = await apiClient.post(`/pipeline/restart/${encodeURIComponent(service)}`);
  return data;
}

/** POST /api/pipeline/restart-group — restart a service group sequentially. */
export async function restartPipelineGroup(group) {
  const { data } = await apiClient.post("/pipeline/restart-group", { group });
  return data;
}

/** GET /api/pipeline/recovery — auto-recovery status (read-only). */
export async function getRecovery() {
  const { data } = await apiClient.get("/pipeline/recovery");
  return data;
}
