import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  getStoredThemePreference,
  resolveTheme,
} from "../lib/theme";

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState("device");
  const [resolved, setResolved] = useState("light");

  useEffect(() => {
    const stored = getStoredThemePreference();
    setPreference(stored);
    setResolved(resolveTheme(stored));
  }, []);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      setPreference((current) => {
        if (current === "device") {
          const next = mql.matches ? "dark" : "light";
          setResolved(next);
          applyResolvedTheme(next);
        }
        return current;
      });
    }
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((next) => {
    setPreference(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const r = resolveTheme(next);
    setResolved(r);
    applyResolvedTheme(r);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
