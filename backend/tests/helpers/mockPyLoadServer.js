/**
 * In-process mock of the pyLoad 0.5.x web UI + JSON API (Fix #1 tests).
 *
 * Freebuff has NO access to the live NAS, so every "live" behavior is
 * simulated here using the VERIFIED pyLoad 0.5.0b3.dev101-ls254 shapes:
 *
 *   GET  /login                  → seed cookie + CSRF meta + login-form HTML
 *   POST /login                  → validates the FAKE dev creds (admin /
 *                                  za2yrocks fallback), returns session cookie
 *   GET  /dashboard              → authed page with a fresh CSRF token
 *   POST /api/add_package        → session + X-CSRFToken required; behavior
 *                                  driven by state.addMode
 *   GET  /api/get_queue_data     → { packages: [{ pid, name, links: [{ url, name }] }] }
 *   GET  /api/get_collector_data → same shape, collector packages
 *   GET  /api/status_downloads   → [{ fid, name, package_id, package_name, ... }]
 *   GET  /api/get_package_data   → package detail (pid param)
 *   GET  /api/get_file_data      → file detail (fid param)
 *   GET  /api/get_queue          → legacy queue summary (Pipeline page)
 *   GET  /api/get_server_version → version string
 *
 * Modes for add_package (state.addMode):
 *   "accept"          create package, 200 {pid}
 *   "reject"          400 {error: rejectReason}, NO package created
 *   "reject-echo"     400 whose body echoes the full signed URL + secrets
 *   "accept-then-502" create package, then answer 502 (Ant-Man case)
 *   "accept-then-400" create package, then answer generic 400
 *   "drop"            destroy the socket — response never arrives
 */

const http = require("http");
const crypto = require("crypto");

const SEED_COOKIE = "pyload_session_seed";
const SESSION_COOKIE = "pyload_session";
const SEED_CSRF = "seed-csrf";
const API_CSRF = "api-csrf";

function loginPageHtml() {
  return (
    `<html><head><meta name="csrf-token" content="${SEED_CSRF}"></head>` +
    `<body><form id="login"><input name="username"></form></body></html>`
  );
}

function dashboardHtml() {
  return (
    `<html><head><meta name="csrf-token" content="${API_CSRF}"></head>` +
    `<body><nav>Dashboard</nav></body></html>`
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function cookieOf(req, name) {
  const header = req.headers.cookie || "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function createMockPyLoad(options = {}) {
  const state = {
    addMode: options.addMode || "accept",
    username: options.username || "admin",
    password: options.password || "za2yrocks",
    rejectReason: options.rejectReason || "No valid links supplied",
    addCalls: 0,
    loginCount: 0,
    loginAttempts: [],
    queue: [],      // packages in queue
    collector: [],  // packages in collector
    downloads: [],  // active downloads
    sessions: new Set(),
    nextPid: 1,
    nextFid: 1,
  };

  const pkgPayload = (pkg) => ({
    pid: pkg.pid,
    name: pkg.name,
    links: pkg.links.map((link, index) => ({
      fid: pkg.fids[index],
      url: link,
      name: pkg.resolved[index] || `file-${index}.bin`,
      package_id: pkg.pid,
      status: 12,
      statusmsg: "downloading",
      error: "",
    })),
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    // ---- web-UI login flow -------------------------------------------------
    if (req.method === "GET" && url.pathname === "/login") {
      res.setHeader("Set-Cookie", `${SEED_COOKIE}=${crypto.randomUUID()}; Path=/`);
      res.setHeader("Content-Type", "text/html");
      return res.end(loginPageHtml());
    }

    if (req.method === "POST" && url.pathname === "/login") {
      const raw = await readBody(req);
      const params = new URLSearchParams(raw);
      const attempt = {
        username: params.get("username"),
        password: params.get("password"),
        csrf: params.get("csrf_token"),
      };
      state.loginAttempts.push(attempt);
      state.loginCount += 1;

      const valid =
        attempt.username === state.username &&
        attempt.password === state.password &&
        Boolean(attempt.csrf);

      if (valid) {
        const sid = crypto.randomUUID();
        state.sessions.add(sid);
        res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${sid}; Path=/`);
        res.setHeader("Location", "/dashboard");
        res.statusCode = 302;
        return res.end();
      }

      // Bad credentials: stay on the login page (the service then sees the
      // login form on /dashboard and raises a credential-free 401).
      res.setHeader("Content-Type", "text/html");
      return res.end(loginPageHtml());
    }

    const session = cookieOf(req, SESSION_COOKIE);
    const authed = session && state.sessions.has(session);

    if (req.method === "GET" && url.pathname === "/dashboard") {
      res.setHeader("Content-Type", "text/html");
      return res.end(authed ? dashboardHtml() : loginPageHtml());
    }

    // ---- JSON API ----------------------------------------------------------
    if (url.pathname.startsWith("/api/")) {
      const csrfOk = req.headers["x-csrftoken"] === API_CSRF;
      if (!authed || !csrfOk) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ error: "Unauthorized" }));
      }

      if (req.method === "POST" && url.pathname === "/api/add_package") {
        state.addCalls += 1;
        const raw = await readBody(req);
        let body = {};
        try {
          body = JSON.parse(raw || "{}");
        } catch {
          /* keep empty */
        }
        const links = Array.isArray(body.links) ? body.links : [];

        if (state.addMode === "drop") {
          // Response is lost after pyLoad received the request.
          return void req.socket.destroy();
        }

        if (state.addMode === "reject") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: state.rejectReason }));
        }

        if (state.addMode === "reject-echo") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(
            JSON.stringify({
              error: `Invalid link: ${links[0] || ""} token=supersecret jwt=eyJhbGciOiJIUzI1NiJ9.aaaaaaaaaaaa.bbbbbbbbbbbb`,
            })
          );
        }

        // "accept" and "accept-then-*" modes all CREATE the package first.
        const pkg = {
          pid: state.nextPid++,
          name: body.name || "Unknown package",
          links,
          resolved: links.map((_, i) => `resolved-${i}.mkv`),
          fids: links.map(() => state.nextFid++),
        };
        state.queue.push(pkg);

        if (state.addMode === "accept-then-502") {
          res.statusCode = 502;
          res.setHeader("Content-Type", "text/html");
          return res.end("<html><body>Bad Gateway</body></html>");
        }

        if (state.addMode === "accept-then-400") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ error: "Bad Request" }));
        }

        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ pid: pkg.pid }));
      }

      if (req.method === "GET" && url.pathname === "/api/get_queue_data") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ packages: state.queue.map(pkgPayload) }));
      }

      if (req.method === "GET" && url.pathname === "/api/get_collector_data") {
        res.setHeader("Content-Type", "application/json");
        return res.end(
          JSON.stringify({ packages: state.collector.map(pkgPayload) })
        );
      }

      if (req.method === "GET" && url.pathname === "/api/status_downloads") {
        const rows = [];
        for (const pkg of state.queue) {
          pkg.links.forEach((link, i) => {
            rows.push({
              fid: pkg.fids[i],
              name: pkg.resolved[i] || `file-${i}.bin`,
              package_id: pkg.pid,
              package_name: pkg.name,
              status: 5,
              statusmsg: "waiting",
            });
          });
        }
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify(rows));
      }

      if (req.method === "GET" && url.pathname === "/api/get_package_data") {
        const pid = Number.parseInt(url.searchParams.get("pid") || "", 10);
        const pkg =
          state.queue.find((p) => p.pid === pid) ||
          state.collector.find((p) => p.pid === pid);
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify(pkg ? pkgPayload(pkg) : {}));
      }

      if (req.method === "GET" && url.pathname === "/api/get_file_data") {
        const fid = Number.parseInt(url.searchParams.get("fid") || "", 10);
        for (const pkg of [...state.queue, ...state.collector]) {
          const index = pkg.fids.indexOf(fid);
          if (index >= 0) {
            res.setHeader("Content-Type", "application/json");
            return res.end(
              JSON.stringify({
                fid,
                url: pkg.links[index],
                name: pkg.resolved[index] || `file-${index}.bin`,
                package_id: pkg.pid,
              })
            );
          }
        }
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({}));
      }

      if (req.method === "GET" && url.pathname === "/api/get_queue") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({ packages: state.queue.map(pkgPayload) }));
      }

      if (req.method === "GET" && url.pathname === "/api/get_server_version") {
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify("0.5.0b3.dev101-ls254"));
      }

      res.statusCode = 404;
      return res.end();
    }

    res.statusCode = 404;
    res.end();
  });

  return {
    state,
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
          resolve(`http://127.0.0.1:${server.address().port}`);
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      });
    },
  };
}

module.exports = { createMockPyLoad };
