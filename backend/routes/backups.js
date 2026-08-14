const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth");
const { list, create, restore, remove } = require("../controllers/backupController");

router.get("/", requireAuth, list);
router.post("/", requireAuth, create);
router.post("/:id/restore", requireAuth, restore);
router.delete("/:id", requireAuth, remove);

module.exports = router;
