const express = require("express");

const router = express.Router();

const {
  getStatus,
  getInfo,
  getUsers,
  getStorage,
  getActivity,
} = require("../controllers/nextcloudController");

router.get("/status", getStatus);
router.get("/info", getInfo);
router.get("/users", getUsers);
router.get("/storage", getStorage);
router.get("/activity", getActivity);

module.exports = router;
