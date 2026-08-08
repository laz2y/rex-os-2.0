const axios = require("axios");

const BASE = process.env.NEXTCLOUD_URL;
const USERNAME = process.env.NEXTCLOUD_USERNAME;
const PASSWORD = process.env.NEXTCLOUD_PASSWORD;

const client = axios.create({
  baseURL: BASE,
  headers: {
    "OCS-APIRequest": "true",
    Accept: "application/json",
  },
  auth:
    USERNAME && PASSWORD
      ? { username: USERNAME, password: PASSWORD }
      : undefined,
  timeout: 12000,
});

/** Nextcloud /status.php — version + maintenance flags (public endpoint). */
async function getStatus() {
  const response = await client.get("/status.php");
  return response.data;
}

/** OCS capabilities — includes the Nextcloud version string. */
async function getCapabilities() {
  const response = await client.get("/ocs/v2.php/cloud/capabilities", {
    params: { format: "json" },
  });
  return response.data?.ocs?.data || null;
}

/** All Nextcloud user ids (admin OCS API). */
async function getUsers() {
  const response = await client.get("/ocs/v1.php/cloud/users", {
    params: { format: "json" },
  });
  return response.data?.ocs?.data?.users || [];
}

/** Detail for a single user: display name, email, quota, last login. */
async function getUser(userId) {
  const response = await client.get(
    `/ocs/v1.php/cloud/users/${encodeURIComponent(userId)}`,
    { params: { format: "json" } }
  );
  return response.data?.ocs?.data || null;
}

/** Recent activity feed (activity app). Returns [] when unavailable. */
async function getActivity(limit = 12) {
  const response = await client.get(
    "/ocs/v2.php/apps/activity/api/v1/activity",
    { params: { format: "json", limit } }
  );
  return response.data?.ocs?.data || [];
}

module.exports = {
  getStatus,
  getCapabilities,
  getUsers,
  getUser,
  getActivity,
};
