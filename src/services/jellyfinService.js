import apiClient from "./apiClient";
import { API_ORIGIN } from "../api/config";

/** Builds an absolute URL for relative media image paths returned by the API. */
export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

// Server identity (name/version) is effectively static, but several Home
// widgets fetch it independently on mount (JellyfinWidget + FooterStatus).
// A short-TTL in-memory cache coalesces those into one request per minute
// instead of two per page load.
let serverInfoPromise = null;
let serverInfoAt = 0;
const SERVER_INFO_TTL_MS = 60000;

export async function getJellyfinServer() {
  const now = Date.now();
  if (serverInfoPromise && now - serverInfoAt < SERVER_INFO_TTL_MS) {
    return serverInfoPromise;
  }
  serverInfoAt = now;
  serverInfoPromise = apiClient.get("/jellyfin").then(({ data }) => data);
  try {
    return await serverInfoPromise;
  } catch (error) {
    serverInfoPromise = null;
    throw error;
  }
}

export async function getLatestMedia() {
  const { data } = await apiClient.get("/jellyfin/latest");
  return data.items || [];
}

/** Browse the library with an optional type filter, search term and paging. */
export async function getLibraryItems({
  type = "",
  search = "",
  startIndex = 0,
  limit = 24,
} = {}) {
  const { data } = await apiClient.get("/jellyfin/items", {
    params: { type, search, startIndex, limit },
  });

  return {
    items: data.items || [],
    total: data.total || 0,
  };
}

export async function getResumeMedia() {
  const { data } = await apiClient.get("/jellyfin/resume");
  return data.items || [];
}

export async function getSessions() {
  const { data } = await apiClient.get("/jellyfin/sessions");
  return data.sessions || [];
}
