const update = require("../services/updateService");

/** GET /api/update/status — full updater state. */
exports.getStatus = async (req, res) => {
  try {
    res.json(await update.getStatus());
  } catch (error) {
    console.error("[update] status error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to read updater state." });
  }
};

/**
 * POST /api/update/upload — receives the raw gzip archive body
 * (the route mounts express.raw for gzip/octet-stream types).
 * Filename comes from the Content-Disposition filename or ?filename=.
 */
exports.upload = (req, res) => {
  try {
    let filename = req.query.filename;
    if (!filename && typeof req.headers["content-disposition"] === "string") {
      const match = req.headers["content-disposition"].match(/filename="?([^";]+)"?/i);
      if (match) filename = decodeURIComponent(match[1]);
    }

    const result = update.upload({ filename: filename || "", body: req.body });
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("[update] upload error:", error.message);
    res.status(500).json({ ok: false, error: "Upload failed." });
  }
};

/** POST /api/update/validate — dry-run validation of the uploaded package. */
exports.validate = (req, res) => {
  try {
    const result = update.validate();
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("[update] validate error:", error.message);
    res.status(500).json({ ok: false, error: "Validation failed." });
  }
};

/** POST /api/update/prepare — create the rollback point. */
exports.prepare = (req, res) => {
  try {
    const result = update.prepare();
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("[update] prepare error:", error.message);
    res.status(500).json({ ok: false, error: "Prepare failed." });
  }
};

/** POST /api/update/install — stage + verify + record the upgrade. */
exports.install = async (req, res) => {
  try {
    const result = await update.install();
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("[update] install error:", error.message);
    res.status(500).json({ ok: false, error: "Install failed." });
  }
};

/** POST /api/update/rollback — restore REX state from a rollback point. */
exports.rollback = (req, res) => {
  try {
    const result = update.rollback(req.body || {});
    if (!result.ok) {
      return res.status(400).json({ ok: false, error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error("[update] rollback error:", error.message);
    res.status(500).json({ ok: false, error: "Rollback failed." });
  }
};

/** GET /api/update/history — past update/rollback records. */
exports.getHistory = (req, res) => {
  try {
    res.json(update.getHistory());
  } catch (error) {
    console.error("[update] history error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to read update history." });
  }
};
