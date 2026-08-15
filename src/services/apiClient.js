import axios from "axios";

import { API_BASE } from "../api/config";

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Session-expiry handling: a 401 from any protected API means the httpOnly
 * session cookie has expired or been invalidated while the app was open.
 * Rather than leaving pages stuck in error states, send the user to the
 * login screen and preserve where they were headed (the same returnTo
 * pattern RequireAuth uses).
 *
 * Auth endpoints (/api/auth/*) are exempt — their 401 is the normal
 * "not logged in" / "bad credentials" signal (login page, session probe),
 * and redirecting there would create a loop.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");
    const isAuthCall = url.includes("/auth/");
    const onLoginPage =
      typeof window !== "undefined" && /\/login(\?|$)/.test(window.location.pathname);

    if (status === 401 && !isAuthCall && !onLoginPage && typeof window !== "undefined") {
      const returnTo = encodeURIComponent(
        window.location.pathname + window.location.search,
      );
      window.location.assign(`/login?returnTo=${returnTo}`);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
