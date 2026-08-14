const activity = require("../services/activityService");

/** GET /api/activity — filtered activity log. */
exports.getActivity = (req, res) => {
  res.json(activity.list(req.query));
};

/** DELETE /api/activity — clear the whole log. */
exports.clearActivity = (req, res) => {
  activity.clear();
  res.json({ ok: true });
};
