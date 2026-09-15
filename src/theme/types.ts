/**
 * Design-token contract every theme must satisfy.
 *
 * Tokens are *semantic* ("text.dim", "status.loss"), never literal ("gray-500", "red"),
 * so a theme can remap them freely and components never need to change. Adding a token
 * here makes TypeScript flag every theme file that has not defined it yet.
 */
export interface Theme {
  /** Stable id — stored in localStorage and written to `<html data-theme="…">`. */
  name: string;
  /** Human label for the theme switcher. */
  label: string;
  /** Tells the browser which native controls / scrollbars to draw. */
  colorScheme: "dark" | "light";

  /** Surfaces, back to front. */
  bg: {
    /** Page background behind the desk frame. */
    app: string;
    /** Desk frame, top bar, tab bar, side panels. */
    panel: string;
    /** Cards and sections. */
    card: string;
    /** Recessed wells inside a card (detail strips, table heads). */
    sunken: string;
    /** Controls and chips sitting on a card (inputs, toggles). */
    raised: string;
    /** Menus, dropdowns, tooltips. */
    overlay: string;
    /** Hover / selected row. */
    hover: string;
  };

  border: {
    subtle: string;
    default: string;
    strong: string;
    emphasis: string;
  };

  /** Text ramp, highest to lowest contrast. */
  text: {
    strong: string;
    primary: string;
    secondary: string;
    tertiary: string;
    muted: string;
    subtle: string;
    dim: string;
    faint: string;
    ghost: string;
    /** Text drawn on a filled status color (regime ribbon glyphs). */
    onStatus: string;
    /** Text drawn on a filled brand badge. */
    onBrand: string;
  };

  /** The desk's primary accent — logo, focus ring, active tab, pressed toggles. */
  accent: string;

  status: {
    gain: string;
    loss: string;
    warning: string;
    info: string;
    danger: string;
    highlight: string;
    neutral: string;
  };

  /** Pre-mixed status surfaces for banners and callouts. */
  tint: {
    lossSurface: string;
    lossBorder: string;
    lossHint: string;
    warningSurface: string;
    warningBorder: string;
    warningHint: string;
    gainSurface: string;
  };

  /** Wheel phase colors (CSP → STOCK → CC). */
  phase: {
    csp: string;
    stock: string;
    cc: string;
  };

  /** Strike suggestion tiers. */
  level: {
    safe: string;
    regular: string;
    risky: string;
  };

  /** Data-source badges. */
  source: {
    etrade: string;
    alpaca: string;
    polygon: string;
    yfinance: string;
  };

  /** Broker account chips. */
  broker: {
    alpacaPaper: string;
    alpacaLive: string;
    etrade: string;
  };

  font: {
    /** Default UI face. */
    mono: string;
    /** Tab labels and dense code-like text. */
    code: string;
    /** Headings and the logotype. */
    display: string;
  };

  shadow: {
    /** Base shadow color; mix with `alpha()` for drop shadows. */
    color: string;
    /** Elevation of the desk frame. */
    app: string;
  };
}

/** Recursive partial — what a custom theme passes to `extendTheme`. */
export type ThemeOverrides = {
  [K in keyof Theme]?: Theme[K] extends object ? Partial<Theme[K]> : Theme[K];
};
