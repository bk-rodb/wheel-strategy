import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { resolveCssValue } from "./cssVars";
import { applyTheme, installThemeStylesheet, readPreferredTheme, storeTheme } from "./dom";
import { ThemeContext, type ThemeContextValue } from "./ThemeContext";
import { findTheme, themes } from "./themes";
import type { Theme } from "./types";

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme?: Theme }) {
  const [theme, setThemeState] = useState<Theme>(() => initialTheme ?? readPreferredTheme());

  useLayoutEffect(() => {
    installThemeStylesheet();
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((name: string) => {
    const next = findTheme(name);
    if (!next) return;
    storeTheme(next.name);
    setThemeState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themes, setTheme, resolve: (v) => resolveCssValue(theme, v) }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
