import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { THEMES, getTheme } from "../core/themes/themeManager";

const STORAGE_KEY = "rexos-theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) || "rex";
    } catch {
      return "rex";
    }
  });

  const theme = getTheme(themeId);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme.id);

    try {
      window.localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      /* ignore */
    }

    // Crossfade the background artwork when switching themes.
    const bg = document.querySelector(".theme-bg");
    if (bg) {
      bg.classList.remove("theme-crossfade");
      void bg.offsetWidth;
      bg.classList.add("theme-crossfade");
    }
  }, [theme.id]);

  const setTheme = useCallback((id) => {
    if (getTheme(id).id === id) setThemeId(id);
  }, []);

  const value = useMemo(
    () => ({ theme, themes: THEMES, setTheme }),
    [theme, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
