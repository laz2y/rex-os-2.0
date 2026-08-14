const storage = require("../services/storageService");

/** GET /api/storage — filesystem inventory, root usage, thresholds, I/O. */
exports.getStorage = async (req, res) => {
  try {
    const report = await storage.getStorageReport();
    res.json({ status: "success", ...report });
  } catch (error) {
    console.error("[storage] error:", error.message);
    res.status(500).json({
      status: "error",
      message: "Failed to collect storage information.",
    });
  }
};
