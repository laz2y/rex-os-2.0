/**
 * Fix #1 — regression guardrails (static source assertions).
 *
 * Requirements 7 and 10 of the test plan, plus protection of the do-not-touch
 * surface: fake credentials, frontend double-click guard, response contract
 * wiring, and the approved Direct Link page design tokens.
 *
 * Run: node --test backend/tests/
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

// ---------------------------------------------------------------------------
// 10 — fake/demo credentials must remain intact
// ---------------------------------------------------------------------------
test("10: pyLoad fake dev credential fallbacks are preserved", () => {
  const src = read("backend/services/pyLoadService.js");
  assert.ok(
    src.includes('process.env.PYLOAD_USERNAME || "admin"'),
    "PYLOAD_USERNAME fallback admin must remain"
  );
  assert.ok(
    src.includes('process.env.PYLOAD_PASSWORD || "za2yrocks"'),
    "PYLOAD_PASSWORD fallback za2yrocks must remain"
  );
});

test("10: qBittorrent fake dev credential fallbacks are preserved", () => {
  const src = read("backend/services/qBittorrentService.js");
  assert.ok(
    src.includes('process.env.QBITTORRENT_USERNAME || "admin"'),
    "QBITTORRENT_USERNAME fallback admin must remain"
  );
  assert.ok(
    src.includes('process.env.QBITTORRENT_PASSWORD || "za2yrocks"'),
    "QBITTORRENT_PASSWORD fallback za2yrocks must remain"
  );
});

// ---------------------------------------------------------------------------
// 7 — frontend double-click / request protection
// ---------------------------------------------------------------------------
test("7: Direct Link button and submit handler are double-click guarded", () => {
  const src = read("src/pages/DirectLink.jsx");
  assert.ok(src.includes("disabled={adding}"), "submit button disabled while adding");
  assert.ok(src.includes("if (adding) return;"), "early return blocks re-entry");
  assert.ok(
    src.includes('const [adding, setAdding] = useState(false)'),
    "adding state still drives the form"
  );
});

test("frontend handles the three submission outcomes", () => {
  const src = read("src/pages/DirectLink.jsx");
  assert.ok(src.includes('outcome === "rejected"'), "rejected branch present");
  assert.ok(src.includes('outcome === "ambiguous"'), "ambiguous branch present");
  assert.ok(
    src.includes("Submission may have been accepted by pyLoad. Checking status…"),
    "ambiguous message per spec"
  );
  assert.ok(src.includes("Added to pyLoad"), "accepted message per spec");
  // The URL input must be cleared EXACTLY once — in the accepted path only
  // (rejected/ambiguous keep the URL for the user).
  const clears = src.match(/setUrl\(""\)/g) || [];
  assert.equal(clears.length, 1, "URL cleared only on accepted");
});

// ---------------------------------------------------------------------------
// Contract + wiring preserved
// ---------------------------------------------------------------------------
test("frontend API wrapper contract unchanged", () => {
  const src = read("src/services/pyLoadService.js");
  assert.ok(src.includes('apiClient.post("/pyload/add", { url })'));
  assert.ok(src.includes('apiClient.get("/pyload/status")'));
});

test("backend route wiring unchanged", () => {
  const src = read("backend/routes/pyLoad.js");
  assert.ok(src.includes('router.post("/add", addLink)'));
  assert.ok(src.includes('router.get("/status", getStatus)'));
  assert.ok(src.includes('router.post("/remove", removePackages)'));
});

test("controller returns the structured status contract", () => {
  const src = read("backend/controllers/pyLoadController.js");
  assert.ok(src.includes("submitDirectLink"), "uses the orchestrator");
  assert.ok(src.includes("status: result.status"), "forwards accepted/rejected/ambiguous");
  assert.ok(src.includes('message: "Download added"') === false, "new message contract");
});

test("pyLoad request schema for add_package is unchanged", () => {
  const src = read("backend/services/pyLoadService.js");
  assert.ok(src.includes("`${baseUrl}/api/add_package`"), "same endpoint");
  assert.ok(
    src.includes("{ name: packageName, links: [url] }"),
    "same body shape { name, links }"
  );
});

// ---------------------------------------------------------------------------
// Approved design must remain (no redesign)
// ---------------------------------------------------------------------------
test("Direct Link page design tokens/styles remain present", () => {
  const css = read("src/pages/DirectLink.css");
  assert.ok(css.includes(".dl-card {"), "card style intact");
  assert.ok(css.includes("var(--glass-border)"), "glassmorphism tokens intact");
  assert.ok(css.includes(".dl-alert.error"), "existing error alert intact");
  assert.ok(css.includes(".dl-alert.success"), "existing success alert intact");
  assert.ok(css.includes(".dl-alert.warn"), "new ambiguous-state variant added");
  assert.ok(css.includes("@media (max-width: 640px)"), "responsive rules intact");
});

test("Direct Link page structure intact (headings, form, status section)", () => {
  const src = read("src/pages/DirectLink.jsx");
  assert.ok(src.includes("Direct Link Add"), "page heading intact");
  assert.ok(src.includes("Add a Download"), "form card intact");
  assert.ok(src.includes("Download Status"), "status section intact");
  assert.ok(src.includes("Open pyLoad"), "pyLoad link intact");
  assert.ok(src.includes("./DirectLink.css"), "styles still imported");
});
