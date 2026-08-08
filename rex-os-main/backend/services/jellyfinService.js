const axios = require("axios");

const client = axios.create({
  baseURL: process.env.JELLYFIN_URL,
  headers: {
    "X-Emby-Token": process.env.JELLYFIN_API_KEY,
  },
  timeout: 10000,
});

async function getServerInfo() {
  const response = await client.get("/System/Info");
  return response.data;
}

async function getUsers() {
  const response = await client.get("/Users");
  return response.data;
}

async function getLatestMedia() {
  const users = await getUsers();

  const user =
    users.find((u) => u.Policy?.IsAdministrator) ||
    users[0];

  if (!user) {
    throw new Error("No Jellyfin users found.");
  }

  const response = await client.get(
    `/Users/${user.Id}/Items/Latest`
  );

  return response.data;
}

async function getSessions() {
  const response = await client.get("/Sessions");

  return response.data;
}

async function getPoster(id) {
  const response = await client.get(
    `/Items/${id}/Images/Primary`,
    {
      responseType: "stream",
    }
  );

  return {
    stream: response.data,
    contentType: response.headers["content-type"],
  };
}

async function getBackdrop(id) {
  const response = await client.get(
    `/Items/${id}/Images/Backdrop/0`,
    {
      responseType: "stream",
    }
  );

  return {
    stream: response.data,
    contentType: response.headers["content-type"],
  };
}

module.exports = {
  getServerInfo,
  getUsers,
  getLatestMedia,
  getSessions,
  getPoster,
  getBackdrop,
};