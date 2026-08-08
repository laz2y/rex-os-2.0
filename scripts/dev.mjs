#!/usr/bin/env node
/**
 * REX OS dev launcher.
 *
 * Starts the Express backend (backend/server.js) and the Vite dev server
 * together as one dev session, so the backend comes up automatically
 * whenever the platform starts the dev server and dies cleanly with it.
 * No extra dependencies — plain Node child_process with signal forwarding
 * (no orphaned processes).
 *
 * If the backend fails to bind (:4000 already in use by an existing
 * instance) Vite keeps running — the proxy just keeps using the live
 * backend on :4000.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BACKEND_ARGS = ["backend/server.js"];
const VITE_ARGS = [path.join("node_modules", "vite", "bin", "vite.js")];

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of [backend, vite]) {
    if (child && child.exitCode === null) child.kill("SIGTERM");
  }

  // Force-kill anything that ignored SIGTERM, then leave.
  setTimeout(() => {
    for (const child of [backend, vite]) {
      if (child && child.exitCode === null) child.kill("SIGKILL");
    }
    process.exit(code ?? 0);
  }, 400);
}

const backend = spawn(process.execPath, BACKEND_ARGS, {
  cwd: root,
  stdio: "inherit",
});

const vite = spawn(process.execPath, VITE_ARGS, {
  cwd: root,
  stdio: "inherit",
});

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

backend.on("exit", (code) => {
  if (code !== 0 && vite.exitCode === null) {
    console.error(
      `[dev] backend exited (code ${code}) — if port 4000 is already in use, an existing instance is serving it.`,
    );
  }
});

vite.on("exit", (code) => shutdown(code ?? 0));
