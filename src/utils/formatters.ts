import type { WheelPosition } from "../types";

export const fmt = {
  currency: (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n),
  compact: (n: number) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n),
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
  num: (n: number) => n.toLocaleString("en-US"),
};

export const dayChange = (pos: WheelPosition) =>
  pos.currentPrice - pos.previousClose;

export const dayChangePct = (pos: WheelPosition) =>
  ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100;

export const dte = (expiration: string): number => {
  const diff = new Date(expiration).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};
