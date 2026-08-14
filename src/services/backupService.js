import apiClient from "./apiClient";

/**
 * Backups → REX API → backupService (server-side).
 * All backup routes are session-authenticated.
 */

/** GET /api/backups — list backups, newest first. */
export async function getBackups() {
  const { data } = await apiClient.get("/backups");
  return data;
}

/** POST /api/backups — create a manual backup of REX OS state. */
export async function createBackup() {
  const { data } = await apiClient.post("/backups", {}, { timeout: 180000 });
  return data;
}

/** POST /api/backups/:id/restore — restore REX state from a backup. */
export async function restoreBackup(id) {
  const { data } = await apiClient.post(`/backups/${encodeURIComponent(id)}/restore`, {}, { timeout: 180000 });
  return data;
}

/** DELETE /api/backups/:id — remove a backup. */
export async function deleteBackup(id) {
  const { data } = await apiClient.delete(`/backups/${encodeURIComponent(id)}`);
  return data;
}
