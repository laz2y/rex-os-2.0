const express = require("express");

const router = express.Router();

const {
  getInfo,
  addLink,
  getStatus,
  removePackages,
} = require("../controllers/pyLoadController");

router.get("/", getInfo);

router.post("/add", addLink);

router.get("/status", getStatus);

router.post("/remove", removePackages);

module.exports = router;
