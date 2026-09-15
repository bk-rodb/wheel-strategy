# E-006 — Central Theme Framework

| Field | Value |
|-------|-------|
| **ID** | `E-006` |
| **Type** | Enhancement |
| **Status** | in-progress |
| **Opened** | 2026-09-14 |
| **Closed** | — |
| **Owner** | — |
| **Related** | [docs/THEMING.md](../THEMING.md) |

---

## Prompt

> create theme framework so CSS and styling changes can be done at a central location like implementing from a file (e.g. dark-theme.ts, light-theme.ts, custom-theme.ts). I used .ts extension but use whatever is inline with industry standard or best practice

---

## Context

Styling lived in inline `style={{}}` objects with ~440 hardcoded hex colors spread across 32 files, plus a few in `index.css` / `tickerTab.css` and color maps in `constants.ts`. Restyling meant editing every component, and a second theme was not possible.

---

## Requirements

1. Theme values are defined in per-theme files: dark, light, custom.
2. Components take colors and fonts from the active theme, not literals.
3. The user can switch themes at runtime, and the choice persists.
4. Adding a theme takes one file plus one registry line.

---

## Acceptance criteria

- [x] `src/theme/themes/{dark,light,custom}.ts` typed against a single `Theme` contract
- [x] No hex color literals remain in `src/components`, `src/WheelDashboard.tsx`, `src/constants.ts`, or the CSS files
- [x] Dark theme keeps the current look; near-duplicate shades are collapsed into one token each
- [x] Theme switcher in the top bar; choice saved to localStorage; first paint uses it (no flash)
- [x] Recharts SVG colors follow the theme (resolved literals)
- [x] `theme.test.ts` covers token completeness, var naming, stylesheet scoping, `alpha`, `extendTheme`
- [x] `tsc -b` passes; `npm test` passes except the pre-existing `preTradeCheck` "earnings before expiration" failure (does not touch theme code)
- [x] Manual: toggle DARK / LIGHT / AMBER in `npm run dev` (checked in a browser 2026-09-14)

---

## Out of scope

- Tokenizing spacing, font sizes, and radii
- Migrating inline styles to CSS classes or a CSS-in-JS library

---

## Design notes

- **TypeScript token objects → CSS custom properties** (`--wd-*` under `:root[data-theme]`). This is the common design-token pattern: typed sources, and the browser does the runtime switch without re-rendering React. JSON/DTCG + Style Dictionary was rejected as tooling overkill for one app.
- `vars` mirrors the `Theme` shape with `var(--wd-…)` strings, so components stay static and theme-agnostic.
- `alpha(color, opacity)` uses `color-mix()` because the old `${hex}40` suffix trick cannot work on a `var()`.
- SVG presentation attributes ignore CSS variables, so charts use `useTheme().theme` / `resolve()`.
- The migration was done with a codemod: hex → semantic token map, then fixed by hand for concatenations, charts, and the frame shadow.
