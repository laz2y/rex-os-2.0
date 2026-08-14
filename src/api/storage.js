import apiClient from "../services/apiClient";

export async function getStorage() {
  const { data } = await apiClient.get("/storage");
  return data;
}
