import type { WheelPosition } from "../types";

export const fmt = {
  currency: (n: number) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        }).format(n)
      : "—",
  compact: (n: number) =>
    Number.isFinite(n)
      ? new Intl.NumberFormat("en-US", {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(n)
      : "—",
  pct: (n: number) =>
    Number.isFinite(n) ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "—",
  /** Format a 0–1 ratio as a percentage (e.g. 0.62 → "+62.00%"). */
  pctFromRatio: (r: number) => (Number.isFinite(r) ? fmt.pct(r * 100) : "—"),
  num: (n: number) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "—"),
};

export const dayChange = (pos: WheelPosition) =>
  pos.currentPrice - pos.previousClose;

export const dayChangePct = (pos: WheelPosition) =>
  ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100;

export const dte = (expiration: string): number => {
  const diff = new Date(`${expiration}T16:00:00`).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
};

/** Relative time for news timestamps (e.g. "3h ago"). */
export function fmtRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
