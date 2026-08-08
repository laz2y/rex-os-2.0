const axios = require("axios");

// Server-side Immich credentials only — never exposed to the browser.
const BASE = process.env.IMMICH_URL;
const API_KEY = process.env.IMMICH_API_KEY;

const client = axios.create({
  baseURL: `${BASE}/api`,
  headers: API_KEY ? { "x-api-key": API_KEY } : undefined,
  timeout: 10000,
});

/** Server ping — { res: "pong" } when reachable. */
async function ping() {
  const response = await client.get("/server/ping");
  return response.data;
}

/** Server version — { major, minor, patch }. */
async function getVersion() {
  const response = await client.get("/server/version");
  return response.data;
}

/** Asset statistics — { photos, videos, total } for the whole library. */
async function getStatistics() {
  const response = await client.get("/statistics");
  return response.data;
}

/** Albums list (name + asset count per album). */
async function getAlbums() {
  const response = await client.get("/albums");
  return response.data || [];
}

module.exports = {
  ping,
  getVersion,
  getStatistics,
  getAlbums,
};
