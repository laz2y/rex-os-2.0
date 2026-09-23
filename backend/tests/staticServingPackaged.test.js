/**
 * Static-path hotfix — the PACKAGED layout, proven against the real server.
 *
 * A REX Updater release archive can nest the UI inside the backend directory,
 * so `<dirname>/dist/index.html` must win over `<dirname>/../dist/index.html`.
 * This test creates that layout (a self-cleaning symlink from `backend/dist`
 * to the real build — the identical bytes the dev layout serves), boots
 * backend/server.js in a child process and asserts the resolution + contract.
 *
 * Without this, a release could silently fall back to the development path,
 * or to the API-only root, and the frontend would regress.
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
const packagedDist = path.join(backendDir, "dist");

const PORT = 41988;
const base = `http://127.0.0.1:${PORT}`;

let child = null;
let output = "";

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
  throw new Error(`server did not start on ${base}\n${output}`);
}

before(async () => {
  assert.ok(
    fs.existsSync(path.join(devDist, "index.html")),
    "run `bun run build` first — this test asserts the real served UI"
  );

  // Packaged layout: <backend>/dist exists and holds the build.
  fs.rmSync(packagedDist, { force: true });
  fs.symlinkSync(path.relative(backendDir, devDist), packagedDist, "dir");

  child = spawn(process.execPath, [path.join(backendDir, "server.js")], {
    cwd: backendDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      REX_DISABLE_RECOVERY: "true",
      REX_DISABLE_BACKUPS: "true",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr.on("data", (chunk) => {
    output += String(chunk);
  });

  await waitForServer();
});

after(() => {
  if (child && !child.killed) child.kill();
  fs.rmSync(packagedDist, { force: true });
});

test("packaged <backend>/dist wins over the development build", () => {
  // The server reports exactly which directory it chose.
  const match = output.match(/Serving REX OS UI from (.+)/);
  assert.ok(match, `server logged no dist choice:\n${output}`);
  assert.equal(
    match[1].trim(),
    packagedDist,
    "the packaged candidate must be selected first"
  );
});

test("packaged layout serves the app shell, SPA routes, assets and JSON /api", async () => {
  const root = await fetch(`${base}/`);
  const html = await root.text();
  assert.equal(root.status, 200);
  assert.match(root.headers.get("content-type") || "", /text\/html/);
  assert.ok(html.includes('<div id="root">'), "React app shell served");
  assert.equal(html, fs.readFileSync(path.join(devDist, "index.html"), "utf8"));

  const spa = await fetch(`${base}/storage`);
  assert.equal(spa.status, 200);
  assert.match(spa.headers.get("content-type") || "", /text\/html/);

  const entry = html.match(/src="(\/assets\/[^"]+\.js)"/);
  assert.ok(entry, "index.html references an entry bundle");
  const asset = await fetch(`${base}${entry[1]}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get("content-type") || "", /javascript/);

  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.match(health.headers.get("content-type") || "", /application\/json/);
  assert.equal((await health.json()).status, "ok");

  const unknownApi = await fetch(`${base}/api/nope`);
  assert.equal(unknownApi.status, 404);
  assert.ok(!(await unknownApi.text()).includes('<div id="root">'));
});
