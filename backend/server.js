const path = require("path");

// Server-side credentials live in backend/.env (gitignored) or in the host
// process environment — never in frontend code or VITE_* variables.
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const systemRoute = require("./routes/system");
const dockerRoute = require("./routes/docker");
const jellyfinRoute = require("./routes/jellyfin");
const nextcloudRoute = require("./routes/nextcloud");
const immichRoute = require("./routes/immich");

const app = express();

app.use(cors());
app.use(express.json());

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

app.listen(process.env.PORT || 4000, () => {
  console.log(
    `🚀 REX API running on port ${process.env.PORT || 4000}`
  );
});