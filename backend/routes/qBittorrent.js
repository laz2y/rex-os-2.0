const express = require("express");

const router = express.Router();

const {
  getOverview,
  addTorrent,
  pauseTorrents,
  resumeTorrents,
  removeTorrents,
} = require("../controllers/qBittorrentController");

router.get("/", getOverview);

router.post("/add", addTorrent);

router.post("/pause", pauseTorrents);

router.post("/resume", resumeTorrents);

router.post("/remove", removeTorrents);

module.exports = router;
