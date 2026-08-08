import apiClient from "./apiClient";
import { API_ORIGIN } from "../api/config";

/** Builds an absolute URL for relative media image paths returned by the API. */
export function mediaUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//.test(path)) return path;
  return `${API_ORIGIN}${path}`;
}

export async function getJellyfinServer() {
  const { data } = await apiClient.get("/jellyfin");
  return data;
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
