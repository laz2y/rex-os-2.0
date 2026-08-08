const path = require("path");

// Server-side credentials live in backend/.env (gitignored) or in the host
// process environment — never in frontend code or VITE_* variables.
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Optional gitignored auth override (backend/.auth-secrets.json). When
// present it takes precedence over the process environment, so credentials
// can be rotated server-side without rebuilding the env. Never committed.
try {
  const secrets = require(path.join(__dirname, ".auth-secrets.json"));
  if (
    secrets &&
    typeof secrets.REX_PASSWORD_HASH === "string" &&
    secrets.REX_PASSWORD_HASH.length > 0
  ) {
    process.env.REX_PASSWORD_HASH = secrets.REX_PASSWORD_HASH;
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
const authRoute = require("./routes/auth");

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

app.get("/", (req, res) => {
  res.json({
    app: "REX API",
    version: "2.0.0",
    status: "online",
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    version: "2.0.0",
    uptime: process.uptime(),
  });
});

app.use("/api/system", systemRoute);
app.use("/api/docker", dockerRoute);
app.use("/api/jellyfin", jellyfinRoute);
app.use("/api/nextcloud", nextcloudRoute);
app.use("/api/immich", immichRoute);
app.use("/api/auth", authRoute);

app.listen(process.env.PORT || 4000, () => {
  console.log(
    `🚀 REX API running on port ${process.env.PORT || 4000}`
  );
});