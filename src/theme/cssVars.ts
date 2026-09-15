import { DEFAULT_THEME } from "./themes";
import type { Theme } from "./types";

/**
 * Themes are emitted as CSS custom properties (`--wd-text-dim`) scoped to
 * `:root[data-theme="<name>"]`. Components reference them through `vars`, so switching
 * themes is one attribute change — no React re-render of the tree, no prop drilling.
 */

const PREFIX = "--wd";
const META_KEYS = new Set<keyof Theme>(["name", "label", "colorScheme"]);

type TokenGroups = Omit<Theme, "name" | "label" | "colorScheme">;

/** Same shape as a theme, but every leaf is a `var(--wd-…)` reference. */
export type ThemeVars = {
  [G in keyof TokenGroups]: TokenGroups[G] extends object
    ? { readonly [K in keyof TokenGroups[G]]: string }
    : string;
};

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

export function cssVarName(path: readonly string[]): string {
  return `${PREFIX}-${path.map(kebab).join("-")}`;
}

function tokenEntries(theme: Theme): [path: string[], value: string][] {
  const out: [string[], string][] = [];
  for (const [group, value] of Object.entries(theme)) {
    if (META_KEYS.has(group as keyof Theme)) continue;
    if (typeof value === "string") {
      out.push([[group], value]);
    } else {
      for (const [key, leaf] of Object.entries(value as Record<string, string>)) {
        out.push([[group, key], leaf]);
      }
    }
  }
  return out;
}

/** `{ "--wd-text-dim": "#4a4a6a", … }` for one theme. */
export function themeToCssVars(theme: Theme): Record<string, string> {
  return Object.fromEntries(tokenEntries(theme).map(([path, value]) => [cssVarName(path), value]));
}

function block(selector: string, theme: Theme): string {
  const decls = Object.entries(themeToCssVars(theme))
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n  color-scheme: ${theme.colorScheme};\n${decls}\n}`;
}

/** Full stylesheet: the default theme on bare `:root`, then one block per theme. */
export function buildThemeStylesheet(themes: readonly Theme[], defaultTheme: Theme = DEFAULT_THEME): string {
  return [block(":root", defaultTheme), ...themes.map((t) => block(`:root[data-theme="${t.name}"]`, t))].join("\n\n");
}

function buildVars(theme: Theme): ThemeVars {
  const result: Record<string, unknown> = {};
  for (const [path] of tokenEntries(theme)) {
    const ref = `var(${cssVarName(path)})`;
    if (path.length === 1) {
      result[path[0]] = ref;
    } else {
      const group = (result[path[0]] ??= {}) as Record<string, string>;
      group[path[1]] = ref;
    }
  }
  return result as ThemeVars;
}

/** Typed CSS-variable references for inline styles: `color: vars.text.dim`. */
export const vars: ThemeVars = buildVars(DEFAULT_THEME);

/**
 * Translucent version of any color — including a `var(--wd-…)` reference, which a hex
 * suffix like `${color}40` cannot do. `opacity` is 0–1.
 */
export function alpha(color: string, opacity: number): string {
  const pct = Math.round(Math.min(1, Math.max(0, opacity)) * 1000) / 10;
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}

/**
 * Replace `var(--wd-…)` references with the theme's literal values. Needed where CSS
 * variables do not work: SVG presentation attributes (Recharts `stroke`/`fill`), canvas.
 */
export function resolveCssValue(theme: Theme, value: string): string {
  const table = themeToCssVars(theme);
  return value.replace(/var\((--wd-[a-z0-9-]+)\)/g, (match, name: string) => table[name] ?? match);
}
