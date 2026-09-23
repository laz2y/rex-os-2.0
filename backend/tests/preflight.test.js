/**
 * Fix #1 — source preflight tests (scenario group B).
 * Uses local http servers — no live NAS, no external network.
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const { once } = require("events");

const {
  preflightSource,
  assertSafeTarget,
  ipRisk,
} = require("../services/sourcePreflight");

/**
 * Start a tiny HTTP server; handler gets (req, res) per request.
 * The server listens on loopback, so tests pass the loopback IP through the
 * preflight's TEST-ONLY ipAllowList escape hatch — every other SSRF guard
 * (schemes, ports, redirect targets, metadata addresses) stays fully active.
 */
async function withServer(handler, fn) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  const opts = { ipAllowList: ["127.0.0.1"] };
  try {
    return await fn(base, (url) => preflightSource(url, opts));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// ---------------------------------------------------------------------------
// Scenario B — Range GET acceptance / rejection
// ---------------------------------------------------------------------------
test("B: Range GET 206 octet-stream → accepted with filename", async () => {
  await withServer((req, res) => {
    assert.equal(req.headers.range, "bytes=0-0");
    res.writeHead(206, {
      "Content-Type": "application/octet-stream",
      "Content-Range": "bytes 0-0/12345678",
      "Content-Length": "1",
      "Content-Disposition": 'attachment; filename="Movie.2024.mkv"',
      "Accept-Ranges": "bytes",
    });
    res.end("X");
  }, async (base, check) => {
    const result = await check(`${base}/files/Movie.2024.mkv?X-Amz-Signature=abc`);
    assert.equal(result.verdict, "accepted");
    assert.equal(result.filename, "Movie.2024.mkv");
    assert.ok(result.checks.contentRange.startsWith("bytes"));
  });
});

test("B: Range GET 200 video → accepted", async () => {
  await withServer((req, res) => {
    res.writeHead(200, { "Content-Type": "video/mp4", "Content-Length": "1" });
    res.end("X");
  }, async (base, check) => {
    const result = await check(`${base}/clip.mp4`);
    assert.equal(result.verdict, "accepted");
    assert.equal(result.filename, "clip.mp4"); // from URL path
  });
});

test("B: HEAD 403 does not matter — Range GET 206 decides (signed R2 behavior)", async () => {
  await withServer((req, res) => {
    if (req.method === "HEAD") {
      res.writeHead(403, { "Content-Type": "text/html" });
      return res.end("<html>forbidden</html>");
    }
    res.writeHead(206, {
      "Content-Type": "application/octet-stream",
      "Content-Range": "bytes 0-0/999",
      "Content-Disposition": "attachment; filename=r2-object.mkv",
    });
    res.end("X");
  }, async (base, check) => {
    // Preflight never issues HEAD — verify the Range GET alone passes even
    // when the server would 403 a HEAD.
    const result = await check(`${base}/signed-object`);
    assert.equal(result.verdict, "accepted");
    assert.equal(result.filename, "r2-object.mkv");
  });
});

test("B: Range GET 403 HTML → rejected (invalid r2.dev token case)", async () => {
  await withServer((req, res) => {
    res.writeHead(403, { "Content-Type": "text/html" });
    res.end("<html><body>Forbidden</body></html>");
  }, async (base, check) => {
    const result = await check(`${base}/pub-abc123?token=expired`);
    assert.equal(result.verdict, "rejected");
    assert.match(result.reason, /403 Forbidden/);
  });
});

test("B: 404 HTML → rejected", async () => {
  await withServer((req, res) => {
    res.writeHead(404, { "Content-Type": "text/html" });
    res.end("<html>not found</html>");
  }, async (base, check) => {
    const result = await check(`${base}/gone/file.mkv`);
    assert.equal(result.verdict, "rejected");
    assert.match(result.reason, /404 Not Found/);
  });
});

test("B: redirect to binary → accepted, filename follows final URL", async () => {
  await withServer((req, res) => {
    if (req.url === "/jump") {
      res.writeHead(302, { Location: "/final/Movie.mkv" });
      return res.end();
    }
    res.writeHead(206, {
      "Content-Type": "application/octet-stream",
      "Content-Range": "bytes 0-0/42",
    });
    res.end("X");
  }, async (base, check) => {
    const result = await check(`${base}/jump`);
    assert.equal(result.verdict, "accepted");
    assert.equal(result.filename, "Movie.mkv");
  });
});

test("B: redirect to loopback/private → rejected as unsafe", async () => {
  await withServer((req, res) => {
    res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" });
    res.end();
  }, async (base, check) => {
    const result = await check(`${base}/evil-redirect`);
    assert.equal(result.verdict, "rejected");
    assert.ok(result.checks.redirectTargetUnsafe);
  });
});

test("B: body is NOT fully downloaded (stream destroyed after headers)", async () => {
  let served = 0;
  await withServer((req, res) => {
    res.writeHead(206, {
      "Content-Type": "application/octet-stream",
      "Content-Range": "bytes 0-0/1000000000",
    });
    // Keep the connection open streaming; count what the client consumes.
    const timer = setInterval(() => {
      res.write("X".repeat(1024));
      served += 1024;
    }, 5);
    req.on("close", () => clearInterval(timer));
    res.on("close", () => clearInterval(timer));
  }, async (base, check) => {
    const result = await check(`${base}/huge.bin`);
    assert.equal(result.verdict, "accepted");
    // Give a tick for any in-flight data, then assert we consumed a trivial
    // amount (headers + ≤ a few KB), not a meaningful part of the file.
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(served < 64 * 1024, `server streamed ${served} bytes — too much`);
  });
});

test("B: 200 text/html → rejected; 200 text/plain file → accepted (do not block generic servers)", async () => {
  await withServer((req, res) => {
    if (req.url === "/page") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end("<html>login page</html>");
    }
    res.writeHead(200, { "Content-Type": "text/plain", "Content-Length": "5" });
    res.end("hello");
  }, async (base, check) => {
    const html = await check(`${base}/page`);
    assert.equal(html.verdict, "rejected");
    // text/plain is a legitimate file type (.txt/.srt/.nfo downloads) —
    // generic direct-download servers must not be blocked on it.
    const plain = await check(`${base}/plain.txt`);
    assert.equal(plain.verdict, "accepted");
    assert.equal(plain.filename, "plain.txt");
  });
});

test("B: 416 / 405 / 5xx → uncertain, never definite rejection", async () => {
  await withServer((req, res) => {
    if (req.url === "/416") {
      res.writeHead(416, { "Content-Type": "application/json" });
      return res.end("{}");
    }
    if (req.url === "/405") {
      res.writeHead(405, { "Content-Type": "text/plain" });
      return res.end("no range here");
    }
    res.writeHead(503, { "Content-Type": "text/plain" });
    res.end("busy");
  }, async (base, check) => {
    for (const path of ["/416", "/405", "/busy"]) {
      const result = await check(`${base}${path}`);
      assert.equal(result.verdict, "uncertain", path);
    }
  });
});

// ---------------------------------------------------------------------------
// SSRF guards
// ---------------------------------------------------------------------------
test("SSRF: loopback, private, CGNAT, metadata and ULA addresses are blocked", () => {
  assert.equal(ipRisk("127.0.0.1"), "loopback");
  assert.equal(ipRisk("10.1.2.3"), "private-range");
  assert.equal(ipRisk("172.16.0.9"), "private-range");
  assert.equal(ipRisk("192.168.1.10"), "private-range");
  assert.equal(ipRisk("100.64.0.1"), "cgnat");
  assert.equal(ipRisk("169.254.169.254"), "link-local-metadata");
  assert.equal(ipRisk("::1"), "loopback");
  assert.equal(ipRisk("fe80::1"), "link-local");
  assert.equal(ipRisk("fd00::5"), "unique-local");
  assert.equal(ipRisk("0.0.0.0"), "this-network");
  assert.equal(ipRisk("224.0.0.1"), "reserved-multicast");
  assert.equal(ipRisk("192.0.2.55"), null); // TEST-NET-1 is treated as public
});

test("SSRF: literal and resolved non-public targets are rejected before any request", async () => {
  for (const bad of [
    "http://localhost/file.mkv",
    "http://127.0.0.1/file.mkv",
    "http://[::1]/file.mkv",
    "http://10.9.8.7/file.mkv",
    "http://169.254.169.254/latest/meta-data",
    "http://metadata.google.internal/computeMetadata/v1/",
    "http://192.168.0.20:8080/x",
  ]) {
    const result = await preflightSource(bad);
    assert.equal(result.verdict, "rejected", bad);
  }
});

test("SSRF: non-http schemes are rejected", async () => {
  const result = await preflightSource("ftp://example.com/file.mkv");
  assert.equal(result.verdict, "rejected");
});

test("SSRF: dangerous ports are blocked", async () => {
  const result = await preflightSource("http://192.0.2.10:6379/x");
  assert.equal(result.verdict, "rejected");
  assert.match(result.reason, /port/);
});
