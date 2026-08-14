const notification = require("../services/notificationService");

/** GET /api/notifications — list with unread count. */
exports.getNotifications = (req, res) => {
  res.json(notification.list(req.query));
};

/** POST /api/notifications/read — mark one or all as read. */
exports.markRead = (req, res) => {
  const { id } = req.body || {};
  res.json(notification.markRead(id || undefined));
};

/** DELETE /api/notifications/:id — remove one notification. */
exports.removeNotification = (req, res) => {
  res.json(notification.remove(req.params.id));
};

/** DELETE /api/notifications — clear all. */
exports.clearNotifications = (req, res) => {
  notification.clear();
  res.json({ ok: true });
};
