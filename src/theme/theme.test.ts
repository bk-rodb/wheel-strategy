import { describe, expect, it } from "vitest";
import {
  alpha,
  buildThemeStylesheet,
  extendTheme,
  resolveCssValue,
  themeToCssVars,
  themes,
  vars,
} from "./index";
import { darkTheme } from "./themes/dark";

describe("theme framework", () => {
  it("every registered theme defines exactly the dark theme's tokens", () => {
    const expected = Object.keys(themeToCssVars(darkTheme)).sort();
    for (const theme of themes) {
      expect(Object.keys(themeToCssVars(theme)).sort(), theme.name).toEqual(expected);
      for (const [name, value] of Object.entries(themeToCssVars(theme))) {
        expect(value, `${theme.name} ${name}`).toBeTruthy();
      }
    }
  });

  it("theme names are unique", () => {
    const names = themes.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("vars are CSS variable references named after the token path", () => {
    expect(vars.text.dim).toBe("var(--wd-text-dim)");
    expect(vars.broker.alpacaPaper).toBe("var(--wd-broker-alpaca-paper)");
    expect(vars.accent).toBe("var(--wd-accent)");
  });

  it("stylesheet scopes each theme to its data-theme attribute", () => {
    const css = buildThemeStylesheet(themes);
    expect(css).toContain(":root {");
    for (const theme of themes) {
      expect(css).toContain(`:root[data-theme="${theme.name}"]`);
    }
    expect(css).toContain(`--wd-bg-app: ${darkTheme.bg.app};`);
  });

  it("resolveCssValue swaps var references for literal values", () => {
    expect(resolveCssValue(darkTheme, vars.status.gain)).toBe(darkTheme.status.gain);
    expect(resolveCssValue(darkTheme, `1px solid ${vars.border.subtle}`)).toBe(`1px solid ${darkTheme.border.subtle}`);
    expect(resolveCssValue(darkTheme, "#123456")).toBe("#123456");
  });

  it("alpha mixes any color, including var references, toward transparent", () => {
    expect(alpha(vars.accent, 0.25)).toBe("color-mix(in srgb, var(--wd-accent) 25%, transparent)");
    expect(alpha("#fff", 2)).toContain("100%");
  });

  it("extendTheme overrides only the given tokens", () => {
    const t = extendTheme(darkTheme, { name: "x", label: "X", text: { dim: "#123456" }, accent: "#abcdef" });
    expect(t.text.dim).toBe("#123456");
    expect(t.text.strong).toBe(darkTheme.text.strong);
    expect(t.accent).toBe("#abcdef");
    expect(darkTheme.text.dim).not.toBe("#123456");
  });
});
