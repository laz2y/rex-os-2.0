/**
 * REX API configuration.
 *
 * The Express backend (./backend) serves routes under /api:
 *   /api/system, /api/docker, /api/jellyfin (…)
 *
 * VITE_API_URL should include the /api prefix, e.g.:
 *   https://api.laz2ynas.cc/api          (deployed)
 *
 * When unset, the app falls back to the same-origin "/api" path — the Vite
 * dev server proxies it to the Express backend on :4000 (see vite.config.ts).
 */
const raw = (import.meta.env.VITE_API_URL || "/api").trim().replace(/\/+$/, "");

export const API_BASE = raw;

/** Origin without the /api suffix — used to build absolute image URLs. */
export const API_ORIGIN = API_BASE.replace(/\/api$/, "");
