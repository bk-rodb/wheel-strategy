import type { PricePoint } from "../types";

/** Mean close over the last N trading days (daily bars). */
export function averageClosingPrice(data: PricePoint[], tradingDays: number): number | null {
  if (data.length === 0 || tradingDays <= 0) return null;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < tradingDays) return null;
  const slice = sorted.slice(-tradingDays);
  const sum = slice.reduce((s, p) => s + p.price, 0);
  return sum / slice.length;
}

/** Format as `201.25/198.99` for 1-week (5 sessions) and 1-month (~21 sessions) averages. */
export function formatAveragePricePair(data: PricePoint[]): string {
  const oneWeek = averageClosingPrice(data, 5);
  const oneMonth = averageClosingPrice(data, 21);
  if (oneWeek == null && oneMonth == null) return "—";
  const fmt = (n: number | null) => (n == null ? "—" : n.toFixed(2));
  return `${fmt(oneWeek)}/${fmt(oneMonth)}`;
}
