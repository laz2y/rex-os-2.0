const axios = require("axios");

const client = axios.create({
  baseURL: process.env.PORTAINER_URL,
  headers: {
    "X-API-Key": process.env.PORTAINER_API_TOKEN,
  },
});

const endpointId = process.env.PORTAINER_ENDPOINT_ID;

async function getContainers() {
  const response = await client.get(
    `/api/endpoints/${endpointId}/docker/containers/json?all=true`
  );

  return response.data;
}

async function restartContainer(containerId) {
  await client.post(
    `/api/endpoints/${endpointId}/docker/containers/${containerId}/restart`
  );
}

async function stopContainer(containerId) {
  await client.post(
    `/api/endpoints/${endpointId}/docker/containers/${containerId}/stop`
  );
}

async function startContainer(containerId) {
  await client.post(
    `/api/endpoints/${endpointId}/docker/containers/${containerId}/start`
  );
}

async function getLogs(containerId) {
  const response = await client.get(
    `/api/endpoints/${endpointId}/docker/containers/${containerId}/logs`,
    {
      params: {
        stdout: true,
        stderr: true,
        tail: 100,
      },
      responseType: "text",
    }
  );

  return response.data;
}

/** One-shot resource stats snapshot for a container. */
async function getContainerStats(containerId) {
  const response = await client.get(
    `/api/endpoints/${endpointId}/docker/containers/${containerId}/stats`,
    { params: { stream: false }, timeout: 10000 }
  );

  return response;
}

/** Full (raw) container inspect. Callers must curate before responding. */
async function getContainerInspect(containerId) {
  const response = await client.get(
    `/api/endpoints/${endpointId}/docker/containers/${containerId}/json`,
    { timeout: 10000 }
  );

  return response;
}

module.exports = {
  getContainers,
  restartContainer,
  stopContainer,
  startContainer,
  getLogs,
  getContainerStats,
  getContainerInspect,
};