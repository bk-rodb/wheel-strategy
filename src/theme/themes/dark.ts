import type { Theme } from "../types";

/** The desk's original look — deep indigo terminal. Default theme. */

const gain = "#34d399";
const loss = "#f87171";
const warning = "#f59e0b";
const info = "#60a5fa";

export const darkTheme: Theme = {
  name: "dark",
  label: "Dark",
  colorScheme: "dark",

  bg: {
    app: "#030310",
    panel: "#07071a",
    card: "#08081a",
    sunken: "#0a0a18",
    raised: "#0d0d1e",
    overlay: "#101028",
    hover: "#14142a",
  },

  border: {
    subtle: "#12122a",
    default: "#1a1a30",
    strong: "#1e1e38",
    emphasis: "#2a2a3a",
  },

  text: {
    strong: "#e8e8f8",
    primary: "#c0c0e0",
    secondary: "#a0a0c0",
    tertiary: "#8a8aa8",
    muted: "#6b6b8a",
    subtle: "#5a5a7a",
    dim: "#4a4a6a",
    faint: "#3a3a5a",
    ghost: "#2a2a4a",
    onStatus: "#0a0a14",
    onBrand: "#ffffff",
  },

  accent: gain,

  status: {
    gain,
    loss,
    warning,
    info,
    danger: "#ef4444",
    highlight: "#a78bfa",
    neutral: "#94a3b8",
  },

  tint: {
    lossSurface: "#1a0808",
    lossBorder: "#4a1010",
    lossHint: "#7a4a4a",
    warningSurface: "#1a1408",
    warningBorder: "#4a3810",
    warningHint: "#8a6020",
    gainSurface: "#04120c",
  },

  phase: { csp: warning, stock: info, cc: gain },
  level: { safe: gain, regular: "#d8d8f0", risky: loss },

  source: {
    etrade: "#ef4444",
    alpaca: "#8b5cf6",
    polygon: "#3b82f6",
    yfinance: "#10b981",
  },

  broker: {
    alpacaPaper: "#8b5cf6",
    alpacaLive: gain,
    etrade: "#3b82f6",
  },

  font: {
    mono: "monospace",
    code: "'JetBrains Mono', monospace",
    display: "'Syne', 'Trebuchet MS', sans-serif",
  },

  shadow: {
    color: "#000000",
    app: "0 4px 6px #00000040, 0 12px 32px #00000060, 0 32px 64px #00000050, inset 0 1px 0 #ffffff08",
  },
};
