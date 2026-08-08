import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { getMe, login as apiLogin, logout as apiLogout } from "../api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  // Resolve the existing session (httpOnly cookie) once on mount.
  useEffect(() => {
    let active = true;

    getMe()
      .then((data) => {
        if (active) setUser(data.user || null);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, []);

  /** Sign in — validation happens on Express; React never sees the password. */
  const signIn = useCallback(async (username, password) => {
    const data = await apiLogin(username, password);
    setUser(data.user || null);
    return data;
  }, []);

  /** Sign out — invalidates the session cookie server-side. */
  const signOut = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      /* clear locally even if the backend is unreachable */
    }
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, checking, signIn, signOut }),
    [user, checking, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
