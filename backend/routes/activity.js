const express = require("express");

const router = express.Router();

const {
  getActivity,
  clearActivity,
} = require("../controllers/activityController");

router.get("/", getActivity);
router.delete("/", clearActivity);

module.exports = router;
