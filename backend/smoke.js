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

// The smoke test cannot know the plaintext password (only the bcrypt hash is
// stored), so it signs a short-lived JWT directly with the server-side secret
// to exercise session-authenticated endpoints end-to-end.
const jwt = require("jsonwebtoken");
const authCookie =
  process.env.JWT_SECRET && process.env.REX_USERNAME
    ? `rexos_token=${jwt.sign(
        { user: process.env.REX_USERNAME },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      )}`
    : null;

async function probe(path, options = {}) {
  try {
    const started = Date.now();
    const res = await fetch(`http://localhost:${process.env.PORT}${path}`, {
      headers: options.headers || {},
      method: options.method || "GET",
      body: options.body,
    });
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

async function probeAuth(path) {
  // Same path with and without the session cookie.
  const unauth = await probe(path);
  const auth = await probe(path, {
    headers: authCookie ? { Cookie: authCookie } : {},
  });
  return {
    path,
    unauthStatus: unauth.status,
    status: auth.status,
    ms: auth.ms,
    body: auth.body,
  };
}

function summarizeAuth(result) {
  const b = result.body;
  let info = "";
  if (b && typeof b === "object") {
    if (b.generatedAt) info = `unauth=${result.unauthStatus} auth=${result.status} cpu=${b.cpu} ram=${b.ram} memGB=${((b.memory?.total || 0) / 1073741824).toFixed(1)} swap=${b.swap ? b.swap.percent + "%" : "n/a"} net=${b.network?.download ?? "n/a"}/${b.network?.upload ?? "n/a"} MB/s io=${b.diskIo ? b.diskIo.readBps + "/" + b.diskIo.writeBps : "n/a"} procs=${b.processes ? b.processes.length : "n/a"} docker=${b.docker ? b.docker.running + "/" + b.docker.total : "n/a"}`;
    else if (b.filesystems) info = `unauth=${result.unauthStatus} auth=${result.status} fs=${b.filesystems.length} root=${b.root?.usedPercent}% level=${b.root?.level} warnings=${b.warnings.length} io=${b.io ? b.io.readBps + "/" + b.io.writeBps : "n/a"}`;
    else if (b.stats) info = `unauth=${result.unauthStatus} auth=${result.status} cpu=${b.stats.cpuPercent}% mem=${b.stats.memory?.percent}% net=${JSON.stringify(b.stats.network)} pids=${b.stats.pids}`;
    else if (b.inspect) info = `unauth=${result.unauthStatus} auth=${result.status} name=${b.inspect.name} state=${b.inspect.state?.status} restarts=${b.inspect.restartCount} policy=${b.inspect.restartPolicy} mounts=${b.inspect.mounts?.length} envExposed=${b.inspect.env ? "YES" : "no"}`;
    else if (b.session) info = `unauth=${result.unauthStatus} auth=${result.status} id=${b.session.id?.slice(0, 8)} shell=${b.session.shell} pty=${b.session.pty}`;
    else if (b.activeSessions != null) info = `unauth=${result.unauthStatus} auth=${result.status} shell=${b.shell} pty=${b.ptySupported} active=${b.activeSessions}`;
    else info = `unauth=${result.unauthStatus} auth=${result.status}`;
  }
  return `  ${result.path} -> HTTP ${result.status} (${result.ms}ms)  ${info}`;
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
        " }";
    } else if (b.summary) {
      info = `summary=${JSON.stringify(b.summary)}`;
    } else if (b.pipeline) {
      info = `state=${b.pipeline.state} health=${b.pipeline.health} lastSuccess=${b.pipeline.lastSuccess} lastFailure=${b.pipeline.lastFailure} services=${Object.keys(b.services || {}).length}`;
    } else if (b.unread != null) {
      info = `total=${b.total} unread=${b.unread}`;    } else {
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
    "/api/pipeline",
    "/api/pipeline/recovery",
    "/api/activity",
    "/api/notifications",
    "/api/diagnostics",
    "/api/auth/me",
    "/api/radarr/overview",
    "/api/sonarr/overview",
    "/api/search?q=test",
    "/api/search?q=",
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

  // ---- Phase 2: session-authenticated endpoints ----
  console.log("\nPhase 2 — auth-protected endpoints (unauth must be 401):");

  const authPaths = [
    "/api/system/metrics",
    "/api/storage",
    "/api/terminal/info",
    "/api/update/status",
    "/api/backups",
    "/api/docker/stats",
  ];
  for (const path of authPaths) {
    console.log(summarizeAuth(await probeAuth(path)));
  }

  // Backups: create with a valid session, then list.
  if (authCookie) {
    const created = await probe("/api/backups", {
      method: "POST",
      headers: { Cookie: authCookie },
    });
    console.log(
      `  POST /api/backups (auth) -> HTTP ${created.status}  ${created.body?.backup ? `id=${created.body.backup.id} bytes=${created.body.backup.bytes} type=${created.body.backup.type}` : JSON.stringify(created.body)}`
    );
    const id = created.body?.backup?.id;
    if (id) {
      const deleted = await probe(`/api/backups/${id}`, {
        method: "DELETE",
        headers: { Cookie: authCookie },
      });
      console.log(`  DELETE /api/backups/:id (auth) -> HTTP ${deleted.status}  ${JSON.stringify(deleted.body)}`);
    }
  } else {
    console.log("  (no JWT_SECRET — skipping backup create/delete flow)");
  }

  // Update flow guards: validate without an upload must fail cleanly.
  if (authCookie) {
    const noUpload = await probe("/api/update/validate", {
      method: "POST",
      headers: { Cookie: authCookie },
    });
    console.log(`  POST /api/update/validate (no package) -> HTTP ${noUpload.status}  ${JSON.stringify(noUpload.body)}`);
  }
  for (const path of authPaths) {
    console.log(summarizeAuth(await probeAuth(path)));
  }

  // Bulk container stats + per-container stats/inspect against real containers.
  try {
    const bulk = await probeAuth("/api/docker/stats");
    const count = bulk.body?.stats ? Object.keys(bulk.body.stats).length : 0;
    console.log(`  /api/docker/stats (bulk) -> HTTP ${bulk.status} (${bulk.ms}ms)  unauth=${bulk.unauthStatus} containersWithStats=${count}`);
  } catch (error) {
    console.log(`  /api/docker/stats (bulk) -> ERROR ${error.message}`);
  }

  // Docker stats/inspect against the first real container.
  try {
    const docker = await probe("/api/docker");
    const first = docker.body?.containers?.[0];
    if (first) {
      console.log(summarizeAuth(await probeAuth(`/api/docker/stats/${first.id}`)));
      console.log(summarizeAuth(await probeAuth(`/api/docker/inspect/${first.id}`)));
    } else {
      console.log("  (no containers found — skipping docker stats/inspect)");
    }
  } catch (error) {
    console.log(`  docker stats/inspect -> ERROR ${error.message}`);
  }

  // Terminal end-to-end: create -> input -> output -> interrupt -> close.
  /* (Phase 2 terminal flow kept below) */
  if (authCookie) {
    try {
      const created = await probe("/api/terminal/session", {
        method: "POST",
        headers: { Cookie: authCookie },
      });
      console.log(summarizeAuth({ path: "/api/terminal/session", status: created.status, ms: created.ms, body: created.body, unauthStatus: "n/a" }));

      const sessionId = created.body?.session?.id;
      if (sessionId) {
        await probe(`/api/terminal/session/${sessionId}/input`, {
          method: "POST",
          headers: { Cookie: authCookie, "Content-Type": "application/json" },
          body: JSON.stringify({ input: "echo rex-phase2-terminal-ok\r" }),
        });
        await sleep(1200);
        const output = await probe(`/api/terminal/session/${sessionId}/output`, {
          headers: { Cookie: authCookie },
        });
        console.log(
          `  /api/terminal/session/:id/output -> HTTP ${output.status}  output="${String(
            output.body?.output || ""
          ).slice(0, 80)}" exited=${output.body?.exited}`
        );
        const interrupted = await probe(`/api/terminal/session/${sessionId}/interrupt`, {
          method: "POST",
          headers: { Cookie: authCookie },
        });
        console.log(`  /api/terminal/session/:id/interrupt -> HTTP ${interrupted.status}  ${JSON.stringify(interrupted.body)}`);
        const closed = await probe(`/api/terminal/session/${sessionId}`, {
          method: "DELETE",
          headers: { Cookie: authCookie },
        });
        console.log(`  DELETE /api/terminal/session/:id -> HTTP ${closed.status}  ${JSON.stringify(closed.body)}`);
      }
    } catch (error) {
      console.log(`  terminal flow -> ERROR ${error.message}`);
    }
  } else {
    console.log("  (no JWT_SECRET — skipping authenticated terminal flow)");
  }

  console.log("Smoke test complete.");
  process.exit(0);
})();
