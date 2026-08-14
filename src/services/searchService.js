import apiClient from "./apiClient";

/**
 * Global REX OS search — debounced by the caller (see pages/Search).
 * The backend queries every source server-side with caching so a
 * debounced frontend never hammers external services.
 */

/** GET /api/search?q= — grouped results across media, downloads, docker… */
export async function globalSearch(query) {
  const { data } = await apiClient.get("/search", {
    params: { q: query },
  });
  return data;
}
