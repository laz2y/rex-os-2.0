import apiClient from "./apiClient";

/**
 * Updates → REX API → updateService (server-side).
 * All updater routes are session-authenticated.
 */

/** GET /api/update/status — current version, state, package, history. */
export async function getUpdateStatus() {
  const { data } = await apiClient.get("/update/status");
  return data;
}

/**
 * POST /api/update/upload — upload a release archive (raw gzip body).
 * `file` is a File/Blob; the backend validates filename + gzip magic.
 */
export async function uploadUpdatePackage(file) {
  const { data } = await apiClient.post("/update/upload", file, {
    headers: { "Content-Type": "application/gzip" },
    params: { filename: file.name },
    timeout: 120000,
  });
  return data;
}

/** POST /api/update/validate — full dry-run validation. */
export async function validateUpdate() {
  const { data } = await apiClient.post("/update/validate");
  return data;
}

/** POST /api/update/prepare — create the pre-upgrade rollback point. */
export async function prepareUpdate() {
  const { data } = await apiClient.post("/update/prepare");
  return data;
}

/** POST /api/update/install — stage + verify + record the upgrade. */
export async function installUpdate() {
  const { data } = await apiClient.post("/update/install", {}, { timeout: 180000 });
  return data;
}

/** POST /api/update/rollback — restore REX state from a rollback point. */
export async function rollbackUpdate(id = null) {
  const { data } = await apiClient.post("/update/rollback", { id });
  return data;
}

/** GET /api/update/history — past update/rollback records. */
export async function getUpdateHistory() {
  const { data } = await apiClient.get("/update/history");
  return data;
}
