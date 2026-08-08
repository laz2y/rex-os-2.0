const axios = require("axios");

const client = axios.create({
  baseURL: process.env.JELLYFIN_URL,
  headers: {
    "X-Emby-Token": process.env.JELLYFIN_API_KEY,
  },
  timeout: 10000,
});

function pickUser(users) {
  return (
    users.find((user) => user.Policy?.IsAdministrator) ||
    users[0]
  );
}

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

  const user = pickUser(users);

  if (!user) {
    throw new Error("No Jellyfin users found.");
  }

  const response = await client.get(
    `/Users/${user.Id}/Items/Latest`
  );

  return response.data;
}

/** Browse the library: optional type filter ("Movie", "Series", …), free-text
 *  search and paging. Returns { Items, TotalRecordCount }. */
async function getItems({
  startIndex = 0,
  limit = 24,
  type = "",
  search = "",
} = {}) {
  const users = await getUsers();

  const user = pickUser(users);

  if (!user) {
    throw new Error("No Jellyfin users found.");
  }

  const params = {
    SortBy: "DateCreated",
    SortOrder: "Descending",
    StartIndex: Number(startIndex) || 0,
    Limit: Math.min(Number(limit) || 24, 100),
    Recursive: true,
    Fields: "Overview,PrimaryImageAspectRatio",
  };

  if (type) params.IncludeItemTypes = type;
  if (search) params.SearchTerm = search;

  const response = await client.get(`/Users/${user.Id}/Items`, {
    params,
  });

  return response.data;
}

/** "Continue watching" — partially watched items for the primary user. */
async function getResume() {
  const users = await getUsers();

  const user = pickUser(users);

  if (!user) {
    throw new Error("No Jellyfin users found.");
  }

  const response = await client.get(`/Users/${user.Id}/Items/Resume`, {
    params: {
      Limit: 12,
      Recursive: true,
      Fields: "PrimaryImageAspectRatio",
    },
  });

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
  getItems,
  getResume,
  getSessions,
  getPoster,
  getBackdrop,
};
