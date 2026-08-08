import apiClient from "./apiClient";

export async function getJellyfinServer() {
  const { data } = await apiClient.get("/jellyfin");
  return data;
}

export async function getLatestMedia() {
  const { data } = await apiClient.get("/jellyfin/latest");
  return data.items;
}