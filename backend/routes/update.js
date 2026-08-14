const express = require("express");

const router = express.Router();

const { requireAuth } = require("../middleware/requireAuth");
const {
  getStatus,
  upload,
  validate,
  prepare,
  install,
  rollback,
  getHistory,
} = require("../controllers/updateController");

// Upload accepts the raw gzip body (browser posts the File directly).
// The 512 MB cap mirrors the service-level MAX_UPLOAD_BYTES.
router.post(
  "/upload",
  requireAuth,
  express.raw({
    type: ["application/gzip", "application/octet-stream", "application/x-gzip"],
    limit: "512mb",
  }),
  upload
);

router.get("/status", requireAuth, getStatus);
router.post("/validate", requireAuth, validate);
router.post("/prepare", requireAuth, prepare);
router.post("/install", requireAuth, install);
router.post("/rollback", requireAuth, rollback);
router.get("/history", requireAuth, getHistory);

module.exports = router;
