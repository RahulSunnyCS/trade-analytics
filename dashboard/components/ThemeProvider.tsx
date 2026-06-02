"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

type ThemeCtx = { dark: boolean; toggle: () => void };
const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });
const KEY = "ta_dash_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  // Read persisted theme once on mount
  useEffect(() => {
    const persisted = window.localStorage.getItem(KEY) === "dark";
    setDark(persisted);
  }, []);

  // Sync attribute on <html>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  const toggle = useCallback(() => {
    setDark((d) => {
      const next = !d;
      try {
        window.localStorage.setItem(KEY, next ? "dark" : "light");
      } catch {
        /* noop */
      }
      return next;
    });
  }, []);

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  return useContext(Ctx);
}
