const express = require("express");

const router = express.Router();

const {
  getServer,
  getUsers,
  getLatest,
  getItems,
  getResume,
  getSessions,
  getPoster,
  getBackdrop,
} = require("../controllers/jellyfinController");

router.get("/", getServer);

router.get("/users", getUsers);

router.get("/latest", getLatest);

router.get("/items", getItems);

router.get("/resume", getResume);

router.get("/sessions", getSessions);

router.get("/poster/:id", getPoster);

router.get("/backdrop/:id", getBackdrop);

module.exports = router;