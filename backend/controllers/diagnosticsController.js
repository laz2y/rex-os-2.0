const diagnostics = require("../services/diagnosticsService");

/** GET /api/diagnostics — run and return a full diagnostics report. */
exports.getDiagnostics = async (req, res) => {
  try {
    const report = await diagnostics.runDiagnostics();
    res.json(report);
  } catch (error) {
    console.error("[diagnostics] report error:", error.message);
    res.status(500).json({ ok: false, error: "Failed to run diagnostics." });
  }
};
