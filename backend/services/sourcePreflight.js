/**
 * Direct Link source preflight (REX OS v2.5.0 Fix #1).
 *
 * Lightweight, server-side reachability check for a user-supplied download
 * URL — performed BEFORE pyLoad's add_package so providers that will
 * definitely refuse (expired/short r2.dev tokens, gone files) are never
 * handed to pyLoad, while signed R2 object URLs (where HEAD = 403 but a
 * range GET works — verified live) pass cleanly.
 *
 * Method: GET with `Range: bytes=0-0` (never HEAD-authoritative), bounded
 * redirect following, streaming response — only headers/minimal bytes are
 * read, then the response stream is destroyed. The file is never downloaded.
 *
 * SSRF safety: http/https only; localhost, loopback, link-local (169.254/16
 * incl. cloud metadata), and non-global (private/CGNAT/reserved) targets are
 * blocked and every redirect destination is revalidated. No REX/pyLoad
 * cookies, credentials, Authorization headers or CSRF tokens are forwarded.
 */

const dns = require("dns").promises;
const { isIP } = require("net");
const http = require("http");
const https = require("https");
const { URL } = require("url");

const PREFLIGHT_TIMEOUT = 8000;
const MAX_REDIRECTS = 4;

/** ip = parsed string; returns a reject reason or null when safe. */
function ipRisk(ip) {
  const version = isIP(ip);
  if (!version) return "unparseable-address";

  if (version === 4) {
    const parts = ip.split(".").map((n) => Number.parseInt(n, 10));
    if (parts[0] === 0) return "this-network";
    if (parts[0] === 10) return "private-range";
    if (parts[0] === 127) return "loopback";
    if (parts[0] === 169 && parts[1] === 254) return "link-local-metadata";
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return "private-range";
    if (parts[0] === 192 && parts[1] === 168) return "private-range";
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return "cgnat";
    if (parts[0] >= 224) return "reserved-multicast";
    return null;
  }

  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return "loopback";
  if (v6.startsWith("fe80")) return "link-local";
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return "unique-local";
  if (
    v6.startsWith("64:ff9b:") ||
    v6.startsWith("::ffff:") ||
    v6 === "100::" ||
    v6.startsWith("2001:db8:")
  ) {
    return "reserved";
  }
  const first = Number.parseInt(v6.split(":")[0], 16);
  if (first >= 0xff00) return "reserved-multicast";
  return null;
}

/**
 * Is this URL a safe target? Returns { ok, reason?, ip? }.
 * Hostnames are resolved (all records must be safe — no mixed-record tricks).
 *
 * `ipAllowList` is a TEST-ONLY escape hatch (used by the local mock server,
 * which necessarily listens on loopback); every host NOT in the list —
 * including redirect destinations — is still fully validated.
 */
async function assertSafeTarget(url, { ipAllowList } = {}) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "only http/https URLs are supported" };
  }

  const port = url.port
    ? Number.parseInt(url.port, 10)
    : url.protocol === "https:"
    ? 443
    : 80;
  const forbiddenPorts = new Set([22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 8080, 8443, 9090, 9200]);
  if (forbiddenPorts.has(port)) {
    return { ok: false, reason: `port ${port} is not an HTTP(S) download port` };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    return { ok: false, reason: "internal hostnames are not valid download sources" };
  }

  // Literal IPs are checked directly; names are resolved so a DNS answer
  // pointing at loopback/link-local/private space cannot smuggle through.
  const literal = isIP(hostname) ? [hostname] : null;
  let addresses = literal;
  let resolved = false;
  if (!literal) {
    try {
      const results = await dns.lookup(hostname, { all: true, verbatim: true });
      addresses = results.map((r) => r.address);
      resolved = true;
    } catch {
      return { ok: false, reason: "hostname could not be resolved" };
    }
  }

  for (const address of addresses) {
    if (ipAllowList && ipAllowList.includes(address)) continue;
    const risk = ipRisk(address);
    if (risk) {
      return {
        ok: false,
        reason:
          risk === "link-local-metadata"
            ? "cloud metadata / link-local addresses are not valid download sources"
            : `target resolves to a non-public address (${risk})`,
        ip: address,
      };
    }
  }

  return { ok: true, ip: addresses && addresses[0], resolved };
}

function filenameFromDisposition(header) {
  if (!header) return null;
  const star = String(header).match(/filename\*=UTF-8''([^;]+)/i);
  if (star && star[1].trim()) {
    try {
      return decodeURIComponent(star[1].trim());
    } catch {
      /* fall through */
    }
  }
  const plain = String(header).match(/filename\s*=\s*(?:\"([^\"]*)\"|([^;]+))/i);
  const value = plain && (plain[1] ?? plain[2]);
  if (value && String(value).trim()) {
    return String(value).trim().replace(/^\"|\"$/g, "");
  }
  return null;
}

function filenameFromPath(url) {
  try {
    const base = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return base && base !== "/" ? base : null;
  } catch {
    return null;
  }
}

/** Clearly non-file payloads (error/authorization documents). */
function looksLikeErrorDocument(contentType, filename) {
  const type = String(contentType || "").toLowerCase();
  if (/\b(text\/html|application\/json|application\/xml|text\/xml|text\/plain)\b/.test(type)) {
    return true;
  }
  if (filename && /\.(html?|json|xml|aspx?|php)$/i.test(filename)) return true;
  return false;
}

/** "video/mp4" → "video"; keep known binary/media/document types. */
function contentCategory(contentType) {
  const type = String(contentType || "").toLowerCase().split(";")[0].trim();
  if (/^application\/octet-stream$/.test(type)) return "octet-stream";
  if (/^(video|audio)\//.test(type)) return "media";
  if (
    /^(application\/(zip|x-7z-compressed|x-rar-compressed|gzip|x-tar|pdf|x-iso9660-image|vnd\.android\.package-archive|epub\+zip)|image\/(png|jpe?g|gif|webp|avif|x-icon)|text\/(csv|plain))/.test(
      type
    )
  ) {
    return "binary";
  }
  if (/\b(text\/html|application\/json|application\/xml|text\/xml)\b/.test(type)) {
    return "document";
  }
  return "unknown";
}

function requestFnFor(url) {
  return url.protocol === "https:" ? https : http;
}

/** Follow up to MAX_REDIRECTS, revalidating SSRF safety at every hop. */
async function preflightSource(rawUrl, options = {}) {
  const timeout = options.timeout || PREFLIGHT_TIMEOUT;

  let current;
  try {
    current = new URL(String(rawUrl == null ? "" : rawUrl).trim());
  } catch {
    return {
      verdict: "rejected",
      reason: "That doesn't look like a valid URL.",
      checks: { preflight: true },
    };
  }

  let response = null;
  let req = null;
  let hops = 0;

  try {
    while (true) {
      const safety = await assertSafeTarget(current, {
        ipAllowList: options.ipAllowList,
      });
      if (!safety.ok) {
        return {
          verdict: "rejected",
          reason:
            current === rawUrl || hops === 0
              ? `Source rejected the link: ${safety.reason}`
              : `Source redirected to an unsafe target: ${safety.reason}`,
          checks: { preflight: true, redirectTargetUnsafe: hops > 0 },
        };
      }

      if (hops > MAX_REDIRECTS) {
        return {
          verdict: "uncertain",
          reason: "Too many redirects",
          checks: { preflight: true, redirects: hops },
        };
      }

      response = await new Promise((resolve, reject) => {
        const settled = { done: false };
        req = requestFnFor(current).request(
          current,
          {
            method: "GET", // primary method — HEAD is not authoritative for signed R2
            headers: { Range: "bytes=0-0", Accept: "*/*" },
            timeout,
          },
          (res) => {
            // Do not let the (possibly large) response body flow; we only
            // need headers. Destroyed after classification below.
            resolve(res);
            if (!settled.done) {
              settled.done = true;
              res.destroy();
            }
          }
        );
        req.on("timeout", () => {
          req.destroy(new Error("timeout"));
        });
        req.on("error", reject);
        req.end();
      });

      const status = response.statusCode || 0;

      // Bounded redirect following with revalidation of each destination.
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        if (!location) {
          return {
            verdict: "uncertain",
            reason: `Redirect without a destination (HTTP ${status})`,
            checks: { preflight: true, status },
          };
        }
        let next;
        try {
          next = new URL(location, current);
        } catch {
          return {
            verdict: "uncertain",
            reason: "Redirect destination could not be parsed",
            checks: { preflight: true, status },
          };
        }
        if (next.protocol !== "http:" && next.protocol !== "https:") {
          return {
            verdict: "uncertain",
            reason: `Redirect switched to unsupported scheme ${next.protocol}`,
            checks: { preflight: true, status },
        };
        }
        current = next;
        hops += 1;
        continue;
      }

      break; // final response — classify below
    }

    const status = response.statusCode || 0;
    const headers = response.headers || {};
    const contentType = headers["content-type"];
    const disposition = headers["content-disposition"];
    const contentRange = headers["content-range"];
    const finalUrl = current.toString();
    const filename =
      filenameFromDisposition(disposition) || filenameFromPath(finalUrl);

    const result = { checks: { preflight: true, status } };

    // ---- Strong acceptance: 206 (partial content for our 1-byte range) ----
    if (status === 206) {
      const category = contentCategory(contentType);
      const rangeOk = contentRange && /^bytes\s/i.test(contentRange);
      if (category === "document") {
        return {
          verdict: "rejected",
          reason: "Source returned an error document instead of a file",
          checks: result.checks,
        };
      }
      result.checks.contentType = contentType || null;
      result.checks.contentRange = rangeOk ? contentRange : null;
      return {
        verdict: "accepted",
        reason: rangeOk
          ? "Range GET succeeded (HTTP 206, valid Content-Range)"
          : "Range GET succeeded (HTTP 206)",
        filename,
        contentType: contentType || null,
        finalUrl,
        checks: result.checks,
      };
    }

    // ---- 200 to a range request: no range support, but a binary file ----
    if (status === 200) {
      const category = contentCategory(contentType);
      if (category === "document") {
        return {
          verdict: "rejected",
          reason: "Source returned an error document instead of a file",
          checks: result.checks,
        };
      }
      if (category === "octet-stream" || category === "media" || category === "binary") {
        return {
          verdict: "accepted",
          reason: "Range GET succeeded (HTTP 200, binary response)",
          filename,
          contentType: contentType || null,
          finalUrl,
          checks: result.checks,
        };
      }
      // text/plain or unknown content type on 200 — do not block generic
      // direct-download servers on a missing MIME type.
      return {
        verdict: "uncertain",
        reason: "Source responded, but the response type is ambiguous",
        checks: result.checks,
      };
    }

    // ---- Definite source rejection (authorization/existence failures) ----
    if ([401, 403, 404, 410].includes(status)) {
      const category = contentCategory(contentType);
      const filenameIsDoc =
        filename && /\.(html?|json|xml|aspx?|php)$/i.test(filename);
      if (category === "document" || !contentType || filenameIsDoc) {
        const label =
          status === 401
            ? "401 Unauthorized"
            : status === 403
            ? "403 Forbidden"
            : status === 404
            ? "404 Not Found"
            : "410 Gone";
        return {
          verdict: "rejected",
          reason: `Source rejected the link: HTTP ${label}`,
          filename,
          contentType: contentType || null,
          finalUrl,
          checks: result.checks,
        };
      }
      // 403/404 with a binary body is provider-specific — stay uncertain.
      return {
        verdict: "uncertain",
        reason: `Source returned HTTP ${status} with a binary response`,
        checks: result.checks,
      };
    }

    // ---- Unusual Range implementations / other statuses → uncertain ----
    if ([405, 416, 429, 500, 502, 503].includes(status)) {
      // A 416 from a plain GET is odd but not proof of invalidity; 5xx is the
      // provider's problem, not the link's. No fallback beyond this — the
      // spec's "safe fallback where reasonable" is the Range GET itself.
      return {
        verdict: "uncertain",
        reason: `Source returned HTTP ${status} to the range probe`,
        checks: result.checks,
      };
    }

    return {
      verdict: "uncertain",
      reason: `Source returned HTTP ${status}`,
      checks: result.checks,
    };
  } catch (error) {
    const code = error && error.code;
    return {
      verdict: "uncertain",
      reason:
        code === "ENOTFOUND" || code === "EAI_AGAIN"
          ? "Source hostname could not be resolved"
          : "Source could not be reached for verification",
      checks: { preflight: true, error: code || "network" },
    };
  } finally {
    if (response && typeof response.destroy === "function") response.destroy();
    if (req && typeof req.destroy === "function") req.destroy();
  }
}

module.exports = {
  preflightSource,
  assertSafeTarget,
  ipRisk,
  filenameFromDisposition,
  filenameFromPath,
  contentCategory,
  looksLikeErrorDocument,
  PREFLIGHT_TIMEOUT,
  MAX_REDIRECTS,
};
