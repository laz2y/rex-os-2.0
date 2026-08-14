const express = require("express");

const router = express.Router();

const { getStorage } = require("../controllers/storageController");
const { requireAuth } = require("../middleware/requireAuth");

router.get("/", requireAuth, getStorage);

module.exports = router;
