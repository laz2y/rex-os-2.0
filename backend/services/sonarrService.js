const axios = require("axios");

/**
 * Sonarr integration (read-only) — REX talks to Sonarr only from the server.
 * Credentials come from backend/.env or backend/.auth-secrets.json
 * (SONARR_URL, SONARR_API_KEY) and never reach the browser. Only the API key
 * header is used; the key is never logged or returned.
 */

const TIMEOUT = 10000;

function getConfig() {
  return {
    baseUrl: (process.env.SONARR_URL || "").trim().replace(/\/+$/, ""),
    apiKey: process.env.SONARR_API_KEY || "",
  };
}

function isConfigured() {
  const { baseUrl, apiKey } = getConfig();
  return Boolean(baseUrl && apiKey);
}

function headers() {
  return { "X-Api-Key": getConfig().apiKey };
}

async function api(path, params = {}) {
  const { baseUrl } = getConfig();
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
  ).toString();
  const { data } = await axios.get(
    `${baseUrl}/api/v3${path}${query ? `?${query}` : ""}`,
    { headers: headers(), timeout: TIMEOUT }
  );
  return data;
}

/** GET /api/v3/system/status → { version, appName, instanceName }. */
async function getSystemStatus() {
  const data = await api("/system/status");
  return {
    version: data.version || "",
    appName: data.appName || "Sonarr",
    instanceName: data.instanceName || "",
  };
}

function mapQueueItem(item) {
  return {
    id: item.id ?? null,
    seriesId: item.seriesId ?? null,
    episodeId: item.episodeId ?? null,
    title: item.title || "Unknown episode",
    status: item.status || "unknown",
    trackedDownloadState: item.trackedDownloadState || "",
    trackedDownloadStatus: item.trackedDownloadStatus || "",
    errorMessage: item.errorMessage || "",
    sizeleft: item.sizeleft ?? null,
    estimatedCompletionTime: item.estimatedCompletionTime || null,
    downloadClient: item.downloadClient || "",
    indexer: item.indexer || "",
  };
}

/** GET /api/v3/queue → { totalRecords, records }. */
async function getQueue() {
  const data = await api("/queue", {
    page: 1,
    pageSize: 100,
    includeUnknownSeriesItems: "true",
  });
  return {
    totalRecords: data.totalRecords || 0,
    records: (data.records || []).map(mapQueueItem),
  };
}

/** GET /api/v3/series → full series list. */
async function getSeries() {
  const data = await api("/series");
  return Array.isArray(data) ? data : [];
}

/** GET /api/v3/wanted/missing → totalRecords of missing episodes. */
async function getMissing() {
  const data = await api("/wanted/missing", { page: 1, pageSize: 1 });
  return (data && data.totalRecords) || 0;
}

/**
 * GET /api/v3/history — recent events mapped to a small UI-safe shape.
 * Event types: grabbed, downloadFolderImported, downloadFailed, …
 */
async function getHistory(limit = 25) {
  const data = await api("/history", {
    page: 1,
    pageSize: limit,
    sortKey: "date",
    sortDirection: "descending",
  });
  return (data.records || []).map((record) => {
    const series = record.series || {};
    const episode = record.episode || {};
    const episodeLabel = episode.seasonNumber != null && episode.episodeNumber != null
      ? `S${String(episode.seasonNumber).padStart(2, "0")}E${String(episode.episodeNumber).padStart(2, "0")}`
      : "";
    return {
      id: record.id ?? null,
      date: record.date || null,
      eventType: record.eventType || "unknown",
      sourceTitle: record.sourceTitle || "",
      title: series.title || record.title || record.sourceTitle || "Unknown episode",
      detail: episodeLabel
        ? `${episodeLabel}${episode.title ? ` · ${episode.title}` : ""}`
        : episode.title || "",
      quality: (record.quality && record.quality.quality && record.quality.quality.name) || "",
      downloadClient: (record.data && record.data.downloadClient) || record.downloadClient || "",
      indexer: record.indexer || "",
    };
  });
}

module.exports = {
  isConfigured,
  getSystemStatus,
  getQueue,
  getSeries,
  getMissing,
  getHistory,
};
