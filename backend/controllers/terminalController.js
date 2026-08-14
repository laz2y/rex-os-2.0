const terminal = require("../services/terminalService");

/**
 * REX OS Terminal — session lifecycle. Every route in this controller is
 * mounted behind requireAuth (JWT httpOnly cookie); there is no unauthenticated
 * path to command execution.
 */

exports.getInfo = (req, res) => {
  res.json({ status: "success", ...terminal.getInfo() });
};

exports.createSession = async (req, res) => {
  try {
    const session = await terminal.createSession();
    res.status(201).json({ status: "success", session });
  } catch (error) {
    console.error("[terminal] create session error:", error.message);
    res.status(400).json({ status: "error", message: error.message });
  }
};

exports.sendInput = (req, res) => {
  try {
    const { input } = req.body || {};
    terminal.writeInput(req.params.id, input);
    res.json({ status: "success" });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};

exports.readOutput = (req, res) => {
  try {
    const result = terminal.readOutput(req.params.id);
    res.json({ status: "success", ...result });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};

exports.interrupt = (req, res) => {
  try {
    const result = terminal.interrupt(req.params.id);
    res.json({ status: "success", ...result });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};

exports.resize = (req, res) => {
  try {
    const result = terminal.resize(req.params.id);
    res.json({ status: "success", ...result });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};

exports.closeSession = (req, res) => {
  try {
    terminal.destroy(req.params.id);
    res.json({ status: "success", closed: true });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
};
