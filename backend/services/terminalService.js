const { spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const activity = require("./activityService");

/**
 * REX OS Terminal Service — authenticated, session-based command execution.
 *
 * SECURITY MODEL
 *  - Sessions can ONLY be created through POST /api/terminal/session, which
 *    is behind the JWT requireAuth middleware. There is no public shell and
 *    no arbitrary "execute this command" HTTP endpoint.
 *  - Each session is a dedicated shell process spawned by the backend. Input
 *    is written raw to the shell's stdin (the admin typing) — the backend
 *    never concatenates untrusted strings into command lines.
 *  - Session IDs are random UUIDs (not enumerable); sessions are capped,
 *    idle-expire, and their whole process group is terminated on close.
 *  - Output is a bounded ring buffer (never an unbounded memory leak).
 *  - No credentials are ever logged or returned to the browser.
 *
 * PRIVILEGE LEVEL (documented, not hidden)
 *  - Commands run as the same OS user/container that the REX OS backend runs
 *    as. If the backend runs inside Docker, the terminal is a shell INSIDE
 *    that container — NOT a host-level root shell.
 *  - Interactive full-screen apps (top/htop/editors) are best-effort: a PTY
 *    is allocated via util-linux `script` when available, but raw-mode
 *    terminal control is not proxied, so prefer plain commands.
 *  - Resize is not supported (requires native ioctl access we deliberately
 *    avoid); the endpoint reports supported:false instead of pretending.
 */

const MAX_SESSIONS = 8;
const IDLE_MS = 10 * 60 * 1000; // 10 minutes without input/output activity
const MAX_OUTPUT = 1024 * 1024; // 1 MiB ring buffer per session
const MAX_INPUT = 16 * 1024; // per-write input cap

const sessions = new Map(); // sessionId -> session

function detectShell() {
  if (process.env.REX_TERMINAL_SHELL) return process.env.REX_TERMINAL_SHELL;
  if (process.env.SHELL) return process.env.SHELL;
  return process.platform === "win32" ? "cmd.exe" : "/bin/sh";
}

/**
 * Spawn a PTY-backed shell via util-linux `script`, falling back to a plain
 * piped shell when `script` is missing or exits immediately (busybox etc.).
 */
function spawnShell(shell) {
  const scriptBin = "/usr/bin/script";
  const plain = () =>
    spawn(shell, [], { stdio: ["pipe", "pipe", "pipe"], detached: true });

  if (process.platform === "win32" || !fs.existsSync(scriptBin)) {
    return Promise.resolve(plain());
  }

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        scriptBin,
        ["-q", "-f", "-c", shell, "/dev/null"],
        { stdio: ["pipe", "pipe", "pipe"], detached: true }
      );
    } catch {
      return resolve(plain());
    }

    let settled = false;
    const fallback = () => {
      if (settled) return;
      settled = true;
      clearTimeout(probe);
      resolve(plain());
    };

    // `script` can reject options (busybox) and exit instantly — verify it
    // actually survived the first ~700ms before trusting it as the session.
    // The fallback only triggers inside that window; a normal later `exit`
    // must never spawn a replacement shell.
    const probe = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (child.exitCode !== null) {
        resolve(plain()); // script flaked — use a plain shell
      } else {
        resolve(child);
      }
    }, 700);

    child.once("error", fallback);
    child.once("exit", () => {
      if (!settled) fallback();
    });
  });
}

async function createSession() {
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error("Too many active terminal sessions — close one first.");
  }

  const id = crypto.randomUUID();
  const shell = detectShell();
  const child = await spawnShell(shell);

  const session = {
    id,
    shell,
    child,
    output: [],
    outputBytes: 0,
    lastActivity: Date.now(),
    exited: false,
    exitCode: null,
  };

  const buffer = (chunk) => {
    session.lastActivity = Date.now();
    const text = chunk.toString("utf8");
    session.output.push(text);
    session.outputBytes += Buffer.byteLength(text);
    // Ring-buffer trim: drop oldest chunks while over budget.
    while (session.outputBytes > MAX_OUTPUT && session.output.length > 1) {
      session.outputBytes -= Buffer.byteLength(session.output.shift());
    }
  };

  child.stdout && child.stdout.on("data", buffer);
  child.stderr && child.stderr.on("data", buffer);
  child.once("exit", (code) => {
    session.exited = true;
    session.exitCode = code;
    session.lastActivity = Date.now();
  });
  child.once("error", () => {
    session.exited = true;
    session.exitCode = null;
    session.lastActivity = Date.now();
  });

  sessions.set(id, session);

  activity.record({
    type: "terminal",
    service: "rexos",
    action: "terminal_session_started",
    result: "success",
    message: "Terminal session started",
    severity: "info",
  });

  return {
    id,
    shell,
    pty: Boolean(child.stdout && child.pid),
    privilege: "Runs as the same user/container the REX OS backend runs as.",
  };
}

/** Send raw input to the session shell (capped; no command construction). */
function writeInput(id, input) {
  const session = sessions.get(id);
  if (!session) throw new Error("Session not found");
  if (session.exited) throw new Error("Session has exited");
  if (typeof input !== "string" || !input.length) return;
  const payload = input.length > MAX_INPUT ? input.slice(0, MAX_INPUT) : input;
  session.lastActivity = Date.now();
  if (session.child.stdin && session.child.stdin.writable) {
    session.child.stdin.write(payload);
  }
}

/** Drain buffered output since the last poll. */
function readOutput(id) {
  const session = sessions.get(id);
  if (!session) throw new Error("Session not found");
  session.lastActivity = Date.now();
  const output = session.output.join("");
  session.output = [];
  session.outputBytes = 0;
  return {
    output,
    exited: session.exited,
    exitCode: session.exitCode,
    active: sessions.has(id) && !session.exited,
  };
}

/** Send SIGINT (Ctrl+C) to the session's whole process group. */
function interrupt(id) {
  const session = sessions.get(id);
  if (!session) throw new Error("Session not found");
  if (session.exited) return { interrupted: false, exited: true };
  session.lastActivity = Date.now();
  try {
    if (process.platform === "win32") {
      session.child.kill("SIGINT");
    } else {
      process.kill(-session.child.pid, "SIGINT");
    }
  } catch {
    /* process group already gone */
  }
  return { interrupted: true };
}

/**
 * Resize is intentionally unsupported (would require native ioctl access we
 * avoid). Reported honestly instead of pretending to apply a size.
 */
function resize(id) {
  if (!sessions.has(id)) throw new Error("Session not found");
  return { supported: false, note: "Resize requires native PTY ioctl access; not available." };
}

/** Terminate the session and its whole process group. */
function destroy(id) {
  const session = sessions.get(id);
  if (!session) return;
  const { child } = session;
  try {
    if (process.platform === "win32") {
      child.kill("SIGTERM");
    } else {
      process.kill(-child.pid, "SIGTERM");
    }
  } catch {
    /* already gone */
  }
  // Hard-kill fallback so no orphaned shells linger.
  const killTimer = setTimeout(() => {
    try {
      if (process.platform === "win32") {
        child.kill("SIGKILL");
      } else {
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      /* gone */
    }
  }, 2000);
  killTimer.unref();

  try {
    child.stdin && child.stdin.destroy();
    child.stdout && child.stdout.destroy();
    child.stderr && child.stderr.destroy();
  } catch {
    /* streams already closed */
  }

  sessions.delete(id);

  activity.record({
    type: "terminal",
    service: "rexos",
    action: "terminal_session_closed",
    result: "success",
    message: "Terminal session closed",
    severity: "info",
  });
}

function getInfo() {
  return {
    shell: detectShell(),
    ptySupported: process.platform !== "win32" && fs.existsSync("/usr/bin/script"),
    maxSessions: MAX_SESSIONS,
    idleMs: IDLE_MS,
    activeSessions: sessions.size,
    privilege: "Runs as the same user/container the REX OS backend runs as.",
    resizeSupported: false,
  };
}

/** Periodic sweep: close idle/exited sessions so shells never pile up. */
function startSweeper() {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (session.exited || now - session.lastActivity > IDLE_MS) {
        destroy(id);
      }
    }
  }, 30000);
  timer.unref();
}

startSweeper();

module.exports = {
  createSession,
  writeInput,
  readOutput,
  interrupt,
  resize,
  destroy,
  getInfo,
};
