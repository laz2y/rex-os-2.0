const path = require("path");

// Server-side credentials live in backend/.env (gitignored) or in the host
// process environment — never in frontend code or VITE_* variables.
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Optional gitignored credential override (backend/.auth-secrets.json).
// Service/auth values fill gaps when the process environment lacks them; the
// password hash always overrides so the rotated credential wins. Never
// committed, never sent to the browser.
try {
  const secrets = require(path.join(__dirname, ".auth-secrets.json"));
  if (secrets) {
    const GAP_KEYS = [
      "REX_USERNAME",
      "JWT_SECRET",
      "PORTAINER_URL",
      "PORTAINER_API_TOKEN",
      "PORTAINER_ENDPOINT_ID",
      "JELLYFIN_URL",
      "JELLYFIN_API_KEY",
      "NEXTCLOUD_URL",
      "NEXTCLOUD_USERNAME",
      "NEXTCLOUD_PASSWORD",
      "IMMICH_URL",
      "IMMICH_API_KEY",
      "QBITTORRENT_URL",
      "QBITTORRENT_USERNAME",
      "QBITTORRENT_PASSWORD",
      "PYLOAD_URL",
      "PYLOAD_USERNAME",
      "PYLOAD_PASSWORD",
      "RADARR_URL",
      "RADARR_API_KEY",
      "SONARR_URL",
      "SONARR_API_KEY",
    ];
    for (const key of GAP_KEYS) {
      if (
        typeof secrets[key] === "string" &&
        secrets[key].length > 0 &&
        !process.env[key]
      ) {
        process.env[key] = secrets[key];
      }
    }
    if (
      typeof secrets.REX_PASSWORD_HASH === "string" &&
      secrets.REX_PASSWORD_HASH.length > 0
    ) {
      process.env.REX_PASSWORD_HASH = secrets.REX_PASSWORD_HASH;
    }
  }
} catch {
  /* no override file — fall back to the process environment */
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const systemRoute = require("./routes/system");
const dockerRoute = require("./routes/docker");
const jellyfinRoute = require("./routes/jellyfin");
const nextcloudRoute = require("./routes/nextcloud");
const immichRoute = require("./routes/immich");
const pyLoadRoute = require("./routes/pyLoad");
const qbittorrentRoute = require("./routes/qBittorrent");
const pipelineRoute = require("./routes/pipeline");
const authRoute = require("./routes/auth");
const activityRoute = require("./routes/activity");
const notificationsRoute = require("./routes/notifications");
const diagnosticsRoute = require("./routes/diagnostics");
const storageRoute = require("./routes/storage");
const searchRoute = require("./routes/search");
const radarrRoute = require("./routes/radarr");
const sonarrRoute = require("./routes/sonarr");
const updateRoute = require("./routes/update");
const backupsRoute = require("./routes/backups");
const recovery = require("./services/recoveryService");
const backups = require("./services/backupService");

const app = express();

// Reflect the calling origin so the session cookie works cross-origin too.
app.use(
  cors({
    origin: (origin, callback) => callback(null, origin || true),
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// Production: serve the built frontend (../dist) from the same process so a
// single `node server.js` hosts both the REX OS UI and the /api backend.
// Registered before the JSON root route so / serves the app shell in
// production; guarded so it is skipped when dist/ is absent (pure API).
const distDir = path.join(__dirname, "..", "dist");
const fs = require("fs");
if (fs.existsSync(distDir)) {
  // Real files (assets, index.html, favicon) win; then the SPA fallback
  // serves the app shell for unknown non-/api GET paths.
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(distDir, "index.html"));
  });
  console.log(`🖥️  Serving REX OS UI from ${distDir}`);
}

// API-only mode (no dist/): the root returns API info. In production the
// static block above already answered / with the app shell, so this route
// is only reachable when the UI build is absent.
app.get("/", (req, res) => {
  res.json({
    app: "REX API",
    version: "3.0.0",
    status: "online",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "3.0.0",
    uptime: process.uptime(),
  });
});

app.use("/api/system", systemRoute);
app.use("/api/docker", dockerRoute);
app.use("/api/jellyfin", jellyfinRoute);
app.use("/api/nextcloud", nextcloudRoute);
app.use("/api/immich", immichRoute);
app.use("/api/pyload", pyLoadRoute);
app.use("/api/qbittorrent", qbittorrentRoute);
app.use("/api/pipeline", pipelineRoute);
app.use("/api/auth", authRoute);
app.use("/api/activity", activityRoute);
app.use("/api/notifications", notificationsRoute);
app.use("/api/diagnostics", diagnosticsRoute);
app.use("/api/storage", storageRoute);
app.use("/api/search", searchRoute);
app.use("/api/radarr", radarrRoute);
app.use("/api/sonarr", sonarrRoute);
app.use("/api/update", updateRoute);
app.use("/api/backups", backupsRoute);

// ⚠️ TEMPORARY — dev-release download route. REMOVE AFTER DOWNLOAD.
// Serves ONLY the verified rexos-2.2-release.tar.gz archive so the
// developer can pull it out of the workspace for manual upload. No
// directory listing, no other files, clean 404 when missing. Do NOT
// ship this route in a release — delete it once the download is done.
const REX22_RELEASE_ARCHIVE = path.join(
  __dirname,
  "..",
  "rexos-2.2-release.tar.gz"
);
app.get("/api/download/rexos-2.2-release.tar.gz", (req, res) => {
  if (!fs.existsSync(REX22_RELEASE_ARCHIVE)) {
    return res.status(404).json({ error: "Release archive not found" });
  }
  res.setHeader("Content-Type", "application/gzip");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="rexos-2.2-release.tar.gz"'
  );
  res.sendFile(REX22_RELEASE_ARCHIVE);
});

// Start the auto-recovery monitor (probes + controlled restarts + alerts).
// Guarded so `node smoke.js` / test harnesses can require this module
// without spawning background timers.
if (process.env.REX_DISABLE_RECOVERY !== "true") {
  recovery.start();
}

// Start automatic REX OS state backups (daily by default). Also guarded so
// test harnesses never spawn background timers.
if (process.env.REX_DISABLE_BACKUPS !== "true") {
  backups.startScheduler();
}

app.listen(process.env.PORT || 4000, () => {
  console.log(
    `🚀 REX API running on port ${process.env.PORT || 4000}`
  );
});