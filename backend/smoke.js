/**
 * REX OS backend smoke test.
 *
 * Boots the Express app in-process on PORT (default 4000), probes every API
 * endpoint and prints a compact report, then exits.
 *
 * Credentials come from the process environment (backend/.env or exported
 * variables) — this file contains no secrets.
 *
 * Usage:
 *   cd backend && node smoke.js          # with backend/.env present
 *   PORT=4000 node smoke.js              # or with env vars exported
 */
process.env.PORT = process.env.PORT || "4000";

const server = require("./server.js"); // starts listening on :PORT

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function probe(path) {
  try {
    const started = Date.now();
    const res = await fetch(`http://localhost:${process.env.PORT}${path}`);
    const text = await res.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    return { path, status: res.status, ms: Date.now() - started, body };
  } catch (error) {
    return { path, status: "ERR", ms: 0, error: error.message };
  }
}

function summarize(result) {
  if (result.status === "ERR") {
    return `  ${result.path} -> ERROR ${result.error}`;
  }

  const b = result.body;
  let info = "";

  if (b && typeof b === "object") {
    if (b.cpu != null) {
      info = `cpu=${b.cpu} ram=${b.ram} storage=${b.storage} network=${JSON.stringify(
        b.network
      )} uptime=${b.uptime} host=${b.hostname}`;
    } else if (b.running != null) {
      info = `running=${b.running} stopped=${b.stopped} containers=${(b.containers || []).length}`;
    } else if (b.serverName) {
      info = `${b.serverName} v${b.version}`;
    } else if (b.sessions) {
      info = `sessions=${b.sessions.length}`;
    } else if (b.services) {
      info =
        "{ " +
        Object.entries(b.services)
          .map(([id, s]) => `${id}:${s.status}${s.detail ? `(${s.detail})` : ""}`)
          .join(", ") +
        " }";    } else {
      if (b.online != null) info += ` online=${b.online}`;
      if (b.versionString) info += ` version=${b.versionString}`;
      if (b.version && b.version.startsWith("v")) info += ` version=${b.version}`;
      if (b.totalUsers != null) info += ` users=${b.totalUsers}`;
      if (b.activeUsers != null) info += ` active=${b.activeUsers}`;
      if (b.total != null) info += ` total=${b.total}`;
      if (b.usagePercent != null) info += ` usage=${b.usagePercent}%`;
      if (b.available != null) info += ` available=${b.available}`;
      if (Array.isArray(b.activities)) info += ` activities=${b.activities.length}`;
      if (b.statistics) info += ` stats=${JSON.stringify(b.statistics)}`;
      if (Array.isArray(b.albums)) info += ` albums=${b.albums.length}`;
    }
  }

  return `  ${result.path} -> HTTP ${result.status} (${result.ms}ms)  ${info}`;
}

(async () => {
  console.log(`REX OS backend smoke test — server on port ${process.env.PORT}`);

  await sleep(1500);

  const paths = [
    "/api/health",
    "/api/system",
    "/api/nextcloud/status",
    "/api/nextcloud/info",
    "/api/nextcloud/users",
    "/api/nextcloud/storage",
    "/api/nextcloud/activity",
    "/api/system/connections",
    "/api/docker",
    "/api/jellyfin",
    "/api/jellyfin/latest",
    "/api/immich/overview",
    "/api/pyload",
    "/api/pyload/status",
    "/api/auth/me",
  ];

  // Auth login probe (wrong password must be rejected — 401).
  try {
    const res = await fetch(
      `http://localhost:${process.env.PORT}/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bad-user", password: "bad-pass" }),
      }
    );
    const text = await res.text();
    console.log(`  POST /api/auth/login (bad creds) -> HTTP ${res.status}  ${text}`);
  } catch (error) {
    console.log(`  POST /api/auth/login -> ERROR ${error.message}`);
  }

  const results = [];
  for (const path of paths) {
    results.push(await probe(path));
  }

  results.forEach((result) => console.log(summarize(result)));
  console.log("Smoke test complete.");
  process.exit(0);
})();
