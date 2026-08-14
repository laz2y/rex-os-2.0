import apiClient from "./apiClient";

/**
 * Direct Link Add → REX API → pyLoad.
 * All pyLoad credentials stay on the server; the browser only calls /api/pyload.
 */

/** Send one direct download URL to pyLoad. Returns { packageId, packageName }. */
export async function addDirectLink(url) {
  const { data } = await apiClient.post("/pyload/add", { url });
  return data;
}

/** Active pyLoad downloads (name, state, progress, size, speed, ETA). */
export async function getPyLoadStatus() {
  const { data } = await apiClient.get("/pyload/status");
  return data.downloads || [];
}

/** pyLoad configuration + reachability for the Direct Link page. */
export async function getPyLoadInfo() {
  const { data } = await apiClient.get("/pyload");
  return data;
}

/** Remove packages from pyLoad's queue/collector (files stay on disk). */
export async function removePyLoadPackages(packageIds) {
  const { data } = await apiClient.post("/pyload/remove", { packageIds });
  return data;
}
