import type { Theme, ThemeOverrides } from "./types";

/** Build a theme from a base plus per-group overrides (one level deep, which is all tokens need). */
export function extendTheme(
  base: Theme,
  overrides: ThemeOverrides & Pick<Theme, "name" | "label">,
): Theme {
  const result = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(overrides)) {
    const current = result[key];
    result[key] =
      value && typeof value === "object" && current && typeof current === "object"
        ? { ...current, ...value }
        : value;
  }
  return result as unknown as Theme;
}
