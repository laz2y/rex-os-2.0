require("dotenv").config();

const express = require("express");
const cors = require("cors");

const systemRoute = require("./routes/system");
const dockerRoute = require("./routes/docker");
const jellyfinRoute = require("./routes/jellyfin");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    app: "REX API",
    version: "1.0.0",
    status: "online",
  });
});

app.use("/api/system", systemRoute);
app.use("/api/docker", dockerRoute);
app.use("/api/jellyfin", jellyfinRoute);

app.listen(process.env.PORT || 4000, () => {
  console.log(
    `🚀 REX API running on port ${process.env.PORT || 4000}`
  );
});