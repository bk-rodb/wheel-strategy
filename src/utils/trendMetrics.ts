import type { PricePoint } from "../types";

export type TrendChipTone = "positive" | "negative" | "neutral" | "warning";

export interface TrendChip {
  label: string;
  value: string;
  tone: TrendChipTone;
  hint?: string;
}

export interface TrendSnapshot {
  chips: TrendChip[];
}

/** Mean close over the last N trading days (daily bars, sorted ascending). */
export function simpleMovingAverage(data: PricePoint[], period: number): number | null {
  if (data.length === 0 || period <= 0) return null;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const slice = sorted.slice(-Math.min(period, sorted.length));
  if (slice.length < period) return null;
  return slice.reduce((s, p) => s + p.price, 0) / slice.length;
}

/** % distance of price from a reference level. */
export function pctFromLevel(price: number, level: number): number | null {
  if (level <= 0) return null;
  return ((price - level) / level) * 100;
}

/** Linear slope of closes as % change per week over the window. */
export function slopePctPerWeek(data: PricePoint[]): number | null {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 5) return null;
  const n = sorted.length;
  const start = sorted[0].price;
  const end = sorted[n - 1].price;
  if (start <= 0) return null;
  const totalPct = ((end - start) / start) * 100;
  const weeks = Math.max(1, (n - 1) / 5);
  return totalPct / weeks;
}

/** Drawdown from the period high to the latest close, as a negative %. */
export function drawdownFromPeak(data: PricePoint[]): number | null {
  if (data.length === 0) return null;
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const peak = Math.max(...sorted.map((d) => d.price));
  const last = sorted[sorted.length - 1].price;
  if (peak <= 0) return null;
  return ((last - peak) / peak) * 100;
}

function toneFromPct(pct: number, bullishAboveZero = true): TrendChipTone {
  const threshold = 1.5;
  if (Math.abs(pct) < threshold) return "neutral";
  if (bullishAboveZero) return pct > 0 ? "positive" : "negative";
  return pct < 0 ? "positive" : "negative";
}

function fmtSignedPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

/**
 * Build 4–6 trend chips from daily price history for wheel decision context.
 * Uses the last 30 sessions for the chart window; SMA50 uses up to 60 bars when available.
 */
export function buildTrendSnapshot(
  data: PricePoint[],
  currentPrice: number,
  costBasis = 0,
): TrendSnapshot {
  const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
  const window30 = sorted.slice(-30);
  const chips: TrendChip[] = [];

  const sma20 = simpleMovingAverage(window30, 20);
  const sma50 = simpleMovingAverage(sorted, 50);
  const vsSma20 = sma20 != null ? pctFromLevel(currentPrice, sma20) : null;
  const vsSma50 = sma50 != null ? pctFromLevel(currentPrice, sma50) : null;

  if (vsSma20 != null) {
    chips.push({
      label: "vs SMA20",
      value: fmtSignedPct(vsSma20),
      tone: toneFromPct(vsSma20),
      hint: "Above SMA → uptrend; below → assignment risk on CSPs",
    });
  }
  if (vsSma50 != null) {
    chips.push({
      label: "vs SMA50",
      value: fmtSignedPct(vsSma50),
      tone: toneFromPct(vsSma50),
    });
  }

  const slope = slopePctPerWeek(window30);
  if (slope != null) {
    chips.push({
      label: "30D slope",
      value: `${slope >= 0 ? "+" : ""}${slope.toFixed(2)}%/wk`,
      tone: toneFromPct(slope),
    });
  }

  const dd = drawdownFromPeak(window30);
  if (dd != null) {
    chips.push({
      label: "from peak",
      value: fmtSignedPct(dd),
      tone: dd > -3 ? "neutral" : dd > -8 ? "warning" : "negative",
      hint: "Give-back from 30-day high",
    });
  }

  if (costBasis > 0) {
    const vsBasis = pctFromLevel(currentPrice, costBasis);
    if (vsBasis != null) {
      chips.push({
        label: "vs basis",
        value: fmtSignedPct(vsBasis),
        tone: vsBasis >= 0 ? "positive" : "warning",
        hint: "Underwater → roll / assignment context",
      });
    }
  }

  const periodLow = Math.min(...window30.map((d) => d.price));
  const periodHigh = Math.max(...window30.map((d) => d.price));
  if (periodLow > 0) {
    const fromLow = pctFromLevel(currentPrice, periodLow);
    chips.push({
      label: "from 30D low",
      value: fromLow != null ? fmtSignedPct(fromLow) : "—",
      tone: fromLow != null && fromLow > 15 ? "warning" : "neutral",
    });
  }
  if (periodHigh > 0 && chips.length < 6) {
    const fromHigh = pctFromLevel(currentPrice, periodHigh);
    if (fromHigh != null) {
      chips.push({
        label: "from 30D high",
        value: fmtSignedPct(fromHigh),
        tone: fromHigh > -2 ? "positive" : "neutral",
      });
    }
  }

  return { chips: chips.slice(0, 6) };
}
