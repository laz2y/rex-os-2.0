const express = require("express");

const router = express.Router();

const {
  getInfo,
  addLink,
  getStatus,
} = require("../controllers/pyLoadController");

router.get("/", getInfo);

router.post("/add", addLink);

router.get("/status", getStatus);

module.exports = router;
