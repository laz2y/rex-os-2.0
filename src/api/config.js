/**
 * REX API configuration.
 *
 * The Express backend (./backend) serves routes under /api:
 *   /api/system, /api/docker, /api/jellyfin (…)
 *
 * VITE_API_URL should include the /api prefix, e.g.:
 *   http://localhost:4000/api            (local dev)
 *   https://api.laz2ynas.cc/api          (deployed)
 */
const raw = (import.meta.env.VITE_API_URL || "http://localhost:4000/api")
  .trim()
  .replace(/\/+$/, "");

export const API_BASE = raw;

/** Origin without the /api suffix — used to build absolute image URLs. */
export const API_ORIGIN = API_BASE.replace(/\/api$/, "");
