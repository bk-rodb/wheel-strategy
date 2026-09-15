import type { Theme } from "../types";
import { customTheme } from "./custom";
import { darkTheme } from "./dark";
import { lightTheme } from "./light";

/**
 * Theme registry. To add a theme: create `themes/<name>.ts` exporting a `Theme`
 * (or `extendTheme(...)`), then list it here — the switcher picks it up automatically.
 */
export const themes: readonly Theme[] = [darkTheme, lightTheme, customTheme];

export const DEFAULT_THEME: Theme = darkTheme;

export function findTheme(name: string | null | undefined): Theme | undefined {
  return themes.find((t) => t.name === name);
}
