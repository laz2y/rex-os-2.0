const searchService = require("../services/searchService");

/** GET /api/search?q=... — global REX OS search (debounced by the frontend). */
exports.search = async (req, res) => {
  try {
    const result = await searchService.search(req.query.q);
    res.json(result);
  } catch (error) {
    console.error("[search] error:", error.message);
    res.status(500).json({ ok: false, error: "Search failed." });
  }
};
