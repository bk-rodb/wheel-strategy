import { createContext, useContext } from "react";
import { resolveCssValue } from "./cssVars";
import { DEFAULT_THEME, themes } from "./themes";
import type { Theme } from "./types";

export interface ThemeContextValue {
  /** Active theme's literal token values. */
  theme: Theme;
  themes: readonly Theme[];
  setTheme: (name: string) => void;
  /** `var(--wd-…)` → literal color, for SVG attributes and canvas. */
  resolve: (value: string) => string;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  themes,
  setTheme: () => {},
  resolve: (value) => resolveCssValue(DEFAULT_THEME, value),
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
