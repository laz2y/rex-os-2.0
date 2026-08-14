const backups = require("../services/backupService");

/** GET /api/backups — list backups, newest first. */
exports.list = (req, res) => {
  try {
    res.json({ ok: true, backups: backups.listBackups() });
  } catch (error) {
    console.error("[backups] list error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to list backups." });
  }
};

/** POST /api/backups — create a manual backup. */
exports.create = (req, res) => {
  try {
    const meta = backups.createBackup("manual");
    res.json({ ok: true, backup: meta });
  } catch (error) {
    console.error("[backups] create error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to create a backup." });
  }
};

/** POST /api/backups/:id/restore — restore REX state from a backup. */
exports.restore = (req, res) => {
  try {
    const result = backups.restoreBackup(req.params.id);
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, backup: result.backup });
  } catch (error) {
    console.error("[backups] restore error:", error.message);
    res.status(500).json({ ok: false, error: "Restore failed." });
  }
};

/** DELETE /api/backups/:id — remove a backup. */
exports.remove = (req, res) => {
  try {
    const result = backups.deleteBackup(req.params.id);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error });
    }
    res.json({ ok: true, id: result.id });
  } catch (error) {
    console.error("[backups] delete error:", error.message);
    res.status(500).json({ ok: false, error: "Delete failed." });
  }
};
