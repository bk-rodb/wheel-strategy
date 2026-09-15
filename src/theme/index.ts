/**
 * Theme framework — see docs/THEMING.md.
 *
 *   themes/dark.ts, light.ts, custom.ts   token values (edit these to restyle the desk)
 *   types.ts                              the token contract every theme satisfies
 *   cssVars.ts                            tokens → CSS custom properties, `vars`, `alpha`
 */
export type { Theme, ThemeOverrides } from "./types";
export { alpha, buildThemeStylesheet, cssVarName, resolveCssValue, themeToCssVars, vars } from "./cssVars";
export type { ThemeVars } from "./cssVars";
export { extendTheme } from "./extendTheme";
export { DEFAULT_THEME, findTheme, themes } from "./themes";
export { initTheme } from "./dom";
export { useTheme } from "./ThemeContext";
export { ThemeProvider } from "./ThemeProvider";
