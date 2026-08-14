import apiClient from "./apiClient";

export async function getContainers() {
  const { data } = await apiClient.get("/docker");
  return data;
}

export async function startContainer(id) {
  const { data } = await apiClient.post(`/docker/start/${id}`);
  return data;
}

export async function stopContainer(id) {
  const { data } = await apiClient.post(`/docker/stop/${id}`);
  return data;
}

export async function restartContainer(id) {
  const { data } = await apiClient.post(`/docker/restart/${id}`);
  return data;
}

export async function getContainerLogs(id) {
  const response = await apiClient.get(`/docker/logs/${id}`, {
    responseType: "text",
  });

  return response.data;
}

export async function getContainerStats(id) {
  const { data } = await apiClient.get(`/docker/stats/${id}`);
  return data.stats;
}

export async function getContainerInspect(id) {
  const { data } = await apiClient.get(`/docker/inspect/${id}`);
  return data.inspect;
}