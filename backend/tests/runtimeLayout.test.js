/**
 * REX OS 2.6 — standardized production runtime layout.
 *
 * The live production container runs the backend directly under /app
 * (WORKDIR /app, CMD npm start, dist at /app/dist). The release Dockerfile
 * must build exactly that shape, and a tree shaped like /app must actually
 * serve the frontend (not the API-only JSON root) and JSON /api/health.
 *
 * Part A asserts the image definition (static, deterministic).
 * Part B builds an /app-shaped tree, boots the REAL server.js in it and
 * checks the endpoints the updater's health gate depends on.
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

const dockerfile = fs.readFileSync(path.join(repoRoot, "Dockerfile"), "utf8");
const backendPackage = require("../package.json");
const { APP_VERSION } = require("../version");

// ---------------------------------------------------------------------------
// Part A — the image layout is what production runs
// ---------------------------------------------------------------------------
test("Dockerfile runs the backend from /app, not /app/backend", () => {
  assert.match(dockerfile, /WORKDIR \/app\b/, "WORKDIR must be /app");
  assert.ok(
    dockerfile.includes("COPY backend/server.js ./"),
    "server.js must land at /app/server.js"
  );
  assert.ok(
    dockerfile.includes("COPY backend/version.js ./"),
    "the version module must land at /app/version.js"
  );
  for (const dir of ["routes", "controllers", "services", "middleware"]) {
    assert.ok(
      dockerfile.includes(`COPY backend/${dir}/ ./${dir}/`),
      `${dir}/ must land at /app/${dir}/`
    );
  }
  assert.ok(
    dockerfile.includes("COPY dist/ ./dist"),
    "the frontend build must land at /app/dist"
  );
  assert.ok(
    !dockerfile.includes("COPY backend/ ./backend"),
    "the backend must NOT be placed under /app/backend"
  );
  assert.ok(
    !/COPY\s+backend\/\s/.test(dockerfile),
    "no whole-directory backend copy (it would drag in runtime state)"
  );
});

test("Dockerfile runtime package is the BACKEND package, started with npm start", () => {
  assert.ok(
    dockerfile.includes("COPY backend/package.json backend/package-lock.json ./"),
    "the backend package must be the runtime npm package at /app/package.json"
  );
  assert.ok(
    !dockerfile.includes("COPY package.json ./") &&
      !dockerfile.includes("COPY package-lock.json ./"),
    "the repo/frontend package must never be copied into the image"
  );
  assert.match(
    dockerfile,
    /CMD \["npm", "start"\]/,
    "runtime CMD must be npm start"
  );
  assert.equal(
    backendPackage.scripts.start,
    "node server.js",
    "backend npm start runs server.js from the working directory"
  );
  assert.equal(backendPackage.name, "backend");
});

test("Dockerfile does not bake runtime state or credentials into the image", () => {
  // Only COPY/ADD sources matter — comments may document the mount paths.
  const copies = dockerfile
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("COPY") || line.startsWith("ADD"))
    .join("\n");

  assert.ok(copies.length > 0, "the Dockerfile copies runtime files");
  assert.ok(!/data/.test(copies), "runtime state (backend/data) must never be copied");
  assert.ok(
    !/auth-secrets/.test(copies),
    "credentials come from the host bind mount, never from the image"
  );
  assert.ok(!/tests/.test(copies), "tests are not runtime code");
  assert.ok(!/node_modules/.test(copies), "deps are installed at build time");
});

test("release excludes keep runtime state and ops utilities out of the archive", () => {
  const excludes = fs.readFileSync(path.join(repoRoot, "release-excludes.txt"), "utf8");
  assert.match(excludes, /^backend\/data$/m, "backend/data must be excluded");
  assert.match(
    excludes,
    /^deploy\/rex-persistence-migration\.sh$/m,
    "the one-time migration utility must be excluded"
  );
  // The intentional dev/demo credentials must still ship in the ARCHIVE.
  assert.ok(
    !/^backend\/\.auth-secrets\.json$/m.test(excludes),
    "the demo .auth-secrets.json is still part of the release archive"
  );
});

test("the release reports version 2.6.0 from one source", () => {
  assert.equal(APP_VERSION, "2.6.0");

  const server = fs.readFileSync(path.join(backendDir, "server.js"), "utf8");
  assert.ok(server.includes('require("./version")'), "server.js uses the version module");
  assert.ok(
    !/"2\.\d+\.\d+"/.test(server),
    "no hardcoded version literal left in server.js"
  );

  for (const file of [
    "services/updateService.js",
    "services/backupService.js",
    "services/diagnosticsService.js",
  ]) {
    const src = fs.readFileSync(path.join(backendDir, file), "utf8");
    assert.ok(
      src.includes('require("../version")'),
      `${file} must read the shared version`
    );
    assert.ok(
      !/REX_APP_VERSION/.test(src),
      `${file} must not let an env var override the running version`
    );
  }

  const config = fs.readFileSync(path.join(repoRoot, "src/data/config.js"), "utf8");
  assert.ok(config.includes('version: "2.6.0"'), "the UI version string is bumped too");
});

// ---------------------------------------------------------------------------
// Part B — a tree shaped like /app actually serves the app
// ---------------------------------------------------------------------------
const PORT = 41989;
const base = `http://127.0.0.1:${PORT}`;
// NOTE: no leading dot — express `send` treats a dot-prefixed path segment as
// a dotfile and would 404 the SPA fallback in the test tree only.
const runtimeRoot = path.join(repoRoot, "runtime-layout-test");

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

  // Build the /app shape: real server.js (so __dirname is this directory),
  // the BACKEND package.json at the root (CommonJS — the repo's root
  // package.json is ESM and must never be the runtime package), the sibling
  // runtime directories, and dist as <dirname>/dist.
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(runtimeRoot, { recursive: true });
  for (const file of ["server.js", "version.js", "package.json"]) {
    fs.copyFileSync(path.join(backendDir, file), path.join(runtimeRoot, file));
  }
  for (const dir of ["routes", "controllers", "services", "middleware"]) {
    fs.symlinkSync(path.join(backendDir, dir), path.join(runtimeRoot, dir), "dir");
  }
  // The image runs `npm install` at /app, so the runtime deps live in
  // /app/node_modules — not in the repo's frontend node_modules.
  fs.symlinkSync(path.join(backendDir, "node_modules"), path.join(runtimeRoot, "node_modules"), "dir");
  fs.symlinkSync(devDist, path.join(runtimeRoot, "dist"), "dir");

  child = spawn(process.execPath, [path.join(runtimeRoot, "server.js")], {
    cwd: runtimeRoot,
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
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
});

test("the runtime tree uses the BACKEND package, not the repo package", () => {
  const runtimePackage = JSON.parse(
    fs.readFileSync(path.join(runtimeRoot, "package.json"), "utf8")
  );
  assert.equal(runtimePackage.name, "backend");
  assert.equal(runtimePackage.scripts.start, "node server.js");
  assert.ok(
    runtimePackage.type !== "module",
    "the runtime package must stay CommonJS (server.js uses require)"
  );
});

test("/app-shaped tree serves the frontend from <dirname>/dist", () => {
  const match = output.match(/Serving REX OS UI from (.+)/);
  assert.ok(match, `server logged no dist choice:\n${output}`);
  assert.equal(
    match[1].trim(),
    path.join(runtimeRoot, "dist"),
    "the production <dirname>/dist candidate must win"
  );
});

test("GET / returns the React frontend, not the API-only JSON root", async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  assert.ok(html.includes('<div id="root">'), "React mount point present");
  assert.ok(!html.includes('"app":"REX API"'), "must not be the API-only root");
});

test("GET /pipeline returns the frontend (SPA deep link)", async () => {
  const res = await fetch(`${base}/pipeline`);
  const html = await res.text();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /text\/html/);
  assert.equal(html, fs.readFileSync(path.join(devDist, "index.html"), "utf8"));
});

test("GET /api/health returns JSON reporting 2.6.0", async () => {
  const res = await fetch(`${base}/api/health`);
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /application\/json/);
  assert.equal(body.status, "ok");
  assert.equal(body.version, "2.6.0", "the updater's health gate reads this");
});

test("the runtime layout works without a baked-in credentials file", async () => {
  // /app/.auth-secrets.json is a production bind mount, not an image file —
  // the server must still boot and answer health without it.
  assert.ok(
    !fs.existsSync(path.join(runtimeRoot, ".auth-secrets.json")),
    "the test tree intentionally has no credentials file"
  );
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
});
