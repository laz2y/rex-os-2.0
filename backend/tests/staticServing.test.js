/**
 * Static-path hotfix — the running server's frontend serving contract.
 *
 * The NAS validated this dual-layout resolution and the REX Updater release
 * must not regress it:
 *
 *   packaged runtime → <dirname>/dist     (backend/ + dist/ are siblings in
 *                                          the release archive)
 *   development      → <dirname>/../dist  (Vite writes to the repo root)
 *
 * This test boots the REAL backend/server.js in a child process (recovery
 * monitor + backup scheduler disabled) and asserts the observable behavior:
 *   - GET /api/health  → 200 JSON (never shadowed by the app shell)
 *   - GET /api/*       → keeps priority; unknown /api routes never fall
 *                        through to index.html
 *   - GET /            → the React app shell (index.html)
 *   - GET /<spa route> → the React app shell
 *   - GET /assets/*    → the built asset bytes
 *   - root-level static files (favicon, manifest) → 200
 *
 * The dev layout is the one present in this repository. The packaged layout
 * and the API-only fallback are locked down in regression.test.js.
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const backendDir = path.join(__dirname, "..");
const repoRoot = path.join(backendDir, "..");
const devDist = path.join(repoRoot, "dist");
const indexHtml = path.join(devDist, "index.html");

const PORT = 41987;
const base = `http://127.0.0.1:${PORT}`;

let child = null;
let stderr = "";

/** Poll /api/health until the server answers (or fail loudly). */
async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`server did not start on ${base}\n${stderr}`);
}

before(async () => {
  // The dev layout must exist for this test to mean anything.
  assert.ok(
    fs.existsSync(indexHtml),
    "run `bun run build` first — this test asserts the real served UI"
  );

  child = spawn(process.execPath, [path.join(backendDir, "server.js")], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      // No background timers, and no live service probing from a test.
      REX_DISABLE_RECOVERY: "true",
      REX_DISABLE_BACKUPS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    stderr += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  await waitForServer();
});

after(() => {
  if (child && !child.killed) child.kill();
});

test("/api/health stays JSON (the app shell never shadows /api)", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /application\/json/);

  const body = await res.json();
  assert.equal(body.status, "ok");
  // A JSON health payload is the opposite of the HTML app shell.
  assert.ok(!String(body).includes("<div id=\"root\">"));
});

test("unknown /api routes keep priority and never fall back to index.html", async () => {
  const res = await fetch(`${base}/api/definitely-not-a-route`);
  const text = await res.text();

  assert.equal(res.status, 404);
  assert.ok(
    !text.includes("<div id=\"root\">"),
    "the SPA fallback must not swallow /api/*"
  );
});

test("GET / serves the React app shell from the built dist", async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  assert.ok(html.includes('<div id="root">'), "React mount point present");
  assert.ok(html.includes("<script"), "the app bundle is referenced");
  assert.equal(html, fs.readFileSync(indexHtml, "utf8"), "exact dist/index.html");
});

test("SPA deep links return index.html", async () => {
  const res = await fetch(`${base}/direct-link`);
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  assert.equal(html, fs.readFileSync(indexHtml, "utf8"));
});

test("built assets continue serving with their real bytes", async () => {
  const html = fs.readFileSync(indexHtml, "utf8");
  const entry = html.match(/src="(\/assets\/[^"]+\.js)"/);

  assert.ok(entry, "index.html references an entry bundle");

  const res = await fetch(`${base}${entry[1]}`);
  // Compare BYTES — the bundle is UTF-8 and contains multibyte characters.
  const served = Buffer.from(await res.arrayBuffer());
  const built = fs.readFileSync(path.join(devDist, entry[1]));

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /javascript/);
  assert.equal(served.length, built.length, "served bytes match the built file");
  assert.ok(served.equals(built), "served asset is byte-identical to the build");
});

test("root-level static files (favicon, manifest, icons) keep serving", async () => {
  for (const assetPath of ["/favicon.svg", "/manifest.webmanifest", "/icons/icon-192.png"]) {
    const res = await fetch(`${base}${assetPath}`);
    assert.equal(res.status, 200, `${assetPath} must serve`);
  }
});
