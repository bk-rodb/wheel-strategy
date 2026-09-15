import { buildThemeStylesheet } from "./cssVars";
import { DEFAULT_THEME, findTheme, themes } from "./themes";
import { lightTheme } from "./themes/light";
import type { Theme } from "./types";

const STORAGE_KEY = "wheel-desk.theme";
const STYLE_ELEMENT_ID = "wd-theme-tokens";

/** Inject (or refresh) the `<style>` holding every theme's custom properties. */
export function installThemeStylesheet(): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ELEMENT_ID;
    document.head.prepend(el);
  }
  el.textContent = buildThemeStylesheet(themes);
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme.name;
}

export function storeTheme(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Private mode / blocked storage — the choice just won't persist.
  }
}

/** Saved choice → OS preference → default. */
export function readPreferredTheme(): Theme {
  try {
    const saved = findTheme(localStorage.getItem(STORAGE_KEY));
    if (saved) return saved;
  } catch {
    // fall through
  }
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: light)").matches) {
    return lightTheme;
  }
  return DEFAULT_THEME;
}

/** Call once before the first render so the page never flashes the wrong theme. */
export function initTheme(): Theme {
  const theme = readPreferredTheme();
  installThemeStylesheet();
  applyTheme(theme);
  return theme;
}
