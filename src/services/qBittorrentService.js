import apiClient from "./apiClient";

/**
 * Downloads → REX API → qBittorrent.
 * All qBittorrent credentials stay on the server; the browser only calls
 * /api/qbittorrent.
 */

/** Version, transfer stats and the full torrent list. */
export async function getQbittorrentOverview() {
  const { data } = await apiClient.get("/qbittorrent");
  return data;
}

/** Send one http(s)/magnet link to qBittorrent. */
export async function addTorrent(url) {
  const { data } = await apiClient.post("/qbittorrent/add", { url });
  return data;
}

export async function pauseTorrent(hash) {
  const { data } = await apiClient.post("/qbittorrent/pause", { hashes: [hash] });
  return data;
}

export async function resumeTorrent(hash) {
  const { data } = await apiClient.post("/qbittorrent/resume", { hashes: [hash] });
  return data;
}

/** Remove a torrent; deleteFiles=true also removes the downloaded data. */
export async function removeTorrent(hash, deleteFiles) {
  const { data } = await apiClient.post("/qbittorrent/remove", {
    hashes: [hash],
    deleteFiles,
  });
  return data;
}
