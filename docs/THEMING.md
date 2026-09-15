# Theming

All desk colors, font stacks, and the frame shadow come from one place: **`src/theme/themes/*.ts`**.
Change a value there and every component follows. Nothing in `src/components` should contain a hex color.

## How it works

```
themes/dark.ts ─┐
themes/light.ts ├─► cssVars.ts ─► <style id="wd-theme-tokens">          ─► components use vars.*
themes/custom.ts┘                  :root[data-theme="dark"]  { --wd-… }      (var(--wd-…))
                                   :root[data-theme="light"] { --wd-… }
```

1. **Token contract** — [`src/theme/types.ts`](../src/theme/types.ts) defines `Theme`: semantic groups
   (`bg`, `border`, `text`, `accent`, `status`, `tint`, `phase`, `level`, `source`, `broker`, `font`, `shadow`).
   Adding a token here makes TypeScript flag every theme that has not defined it.
2. **Themes** — plain typed objects. TypeScript (not JSON/CSS) was chosen so themes are type-checked,
   can share constants, and can extend each other with `extendTheme`.
3. **CSS custom properties** — at startup `initTheme()` (called in `main.tsx` before the first render)
   injects one stylesheet with every theme scoped under `:root[data-theme="<name>"]` and sets the
   attribute. Switching themes changes only that attribute, so the browser restyles the tree without a React re-render.
4. **Components** use `vars` (typed `var(--wd-…)` references):

   ```tsx
   import { alpha, vars } from "../theme";
   <div style={{ background: vars.bg.card, border: `1px solid ${vars.border.default}`, color: vars.text.dim }} />
   <span style={{ background: alpha(vars.status.warning, 0.1) }} />   // translucent tint
   ```

   Plain CSS files use the same variables: `color: var(--wd-text-strong);`.

## Rules

| Need | Use |
|------|-----|
| A color in an inline style | `vars.<group>.<token>` |
| A translucent color | `alpha(color, 0–1)` (emits `color-mix`). **Do not** append hex alpha (`` `${color}40` ``): it breaks on `var()` references. |
| A color in an SVG attribute (Recharts `stroke`, `fill`, `tick`) | `const { theme, resolve } = useTheme()` and use `theme.status.gain` or `resolve(color)`. SVG presentation attributes cannot read CSS variables. |
| A color in a `.css` file | `var(--wd-<group>-<token>)` (camelCase becomes kebab: `alpacaPaper` → `alpaca-paper`) |
| The current theme or switching it | `useTheme()` → `{ theme, themes, setTheme, resolve }` |

`accent` is the desk's brand color (logo, focus ring, active tab, pressed toggles). `status.gain` means
"positive number". They share a value in the dark theme, but a theme can split them.

## Add or edit a theme

- **Restyle an existing theme:** edit `src/theme/themes/dark.ts` (or `light.ts`).
- **Your own theme:** edit `src/theme/themes/custom.ts`. It uses `extendTheme(base, overrides)`, so you
  list only the tokens that differ.
- **Another theme:** create `src/theme/themes/<name>.ts`, then add it to the array in
  `src/theme/themes/index.ts`. The top-bar switcher lists it automatically. `theme.test.ts` fails if it is missing a token.

The choice persists in `localStorage` (`wheel-desk.theme`). With no saved choice, the OS
`prefers-color-scheme: light` setting selects the light theme; otherwise dark.

## Not tokenized (yet)

Spacing, font sizes, and border radii are still inline numbers. They are layout, not theme. Promote them
into `Theme` if a theme ever needs to change density.
