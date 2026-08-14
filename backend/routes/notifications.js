const express = require("express");

const router = express.Router();

const {
  getNotifications,
  markRead,
  removeNotification,
  clearNotifications,
} = require("../controllers/notificationsController");

router.get("/", getNotifications);
router.post("/read", markRead);
router.delete("/:id", removeNotification);
router.delete("/", clearNotifications);

module.exports = router;
