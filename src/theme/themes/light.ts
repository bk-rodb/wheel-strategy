import type { Theme } from "../types";

/** Daylight desk — cool paper surfaces, darker status hues for contrast on white. */

const gain = "#059669";
const loss = "#dc2626";
const warning = "#d97706";
const info = "#2563eb";

export const lightTheme: Theme = {
  name: "light",
  label: "Light",
  colorScheme: "light",

  bg: {
    app: "#e6e9f0",
    panel: "#f6f7fb",
    card: "#ffffff",
    sunken: "#f1f3f8",
    raised: "#f4f5f9",
    overlay: "#ffffff",
    hover: "#e9ecf3",
  },

  border: {
    subtle: "#e3e6ee",
    default: "#d7dbe6",
    strong: "#c7ccda",
    emphasis: "#b4bacb",
  },

  text: {
    strong: "#0f1222",
    primary: "#23273a",
    secondary: "#3b4057",
    tertiary: "#50566e",
    muted: "#5f657d",
    subtle: "#6e748c",
    dim: "#80869c",
    faint: "#9a9fb3",
    ghost: "#b3b8c8",
    onStatus: "#ffffff",
    onBrand: "#ffffff",
  },

  accent: gain,

  status: {
    gain,
    loss,
    warning,
    info,
    danger: "#b91c1c",
    highlight: "#7c3aed",
    neutral: "#64748b",
  },

  tint: {
    lossSurface: "#fef2f2",
    lossBorder: "#fecaca",
    lossHint: "#9f4a4a",
    warningSurface: "#fffbeb",
    warningBorder: "#fde68a",
    warningHint: "#92580e",
    gainSurface: "#ecfdf5",
  },

  phase: { csp: warning, stock: info, cc: gain },
  level: { safe: gain, regular: "#23273a", risky: loss },

  source: {
    etrade: "#dc2626",
    alpaca: "#7c3aed",
    polygon: "#2563eb",
    yfinance: "#059669",
  },

  broker: {
    alpacaPaper: "#7c3aed",
    alpacaLive: gain,
    etrade: "#2563eb",
  },

  font: {
    mono: "monospace",
    code: "'JetBrains Mono', monospace",
    display: "'Syne', 'Trebuchet MS', sans-serif",
  },

  shadow: {
    color: "#0f1222",
    app: "0 1px 2px #0f122214, 0 8px 24px #0f12221a, 0 24px 48px #0f122214",
  },
};
