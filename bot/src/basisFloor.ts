/**
 * Covered-call strike floor (mirror of src/utils/basisFloor.ts): a call is never
 * sold below cost basis (Alpaca avg_entry_price) plus a $1/share cushion.
 * The backend proxy enforces the same rule as a last line of defence.
 */
export const MIN_CALL_STRIKE_OVER_BASIS = 1;

const EPS = 1e-9;

/** Lowest acceptable covered-call strike, or null when the basis is unknown. */
export function callStrikeFloor(costBasis: number | null | undefined): number | null {
  if (costBasis == null || !Number.isFinite(costBasis) || costBasis <= 0) return null;
  return costBasis + MIN_CALL_STRIKE_OVER_BASIS;
}

export function meetsCallStrikeFloor(strike: number, floor: number): boolean {
  return strike >= floor - EPS;
}

/**
 * Nearest listed contract to `targetStrike` among those at or above `floor`.
 * A target below the floor resolves to the lowest qualifying strike; null if none.
 */
export function snapCallStrike<T extends { strike_price: string }>(
  contracts: T[],
  targetStrike: number,
  floor: number,
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of contracts) {
    const k = parseFloat(c.strike_price);
    if (!Number.isFinite(k) || !meetsCallStrikeFloor(k, floor)) continue;
    const dist = Math.abs(k - targetStrike);
    if (dist < bestDist) {
      best = c;
      bestDist = dist;
    }
  }
  return best;
}

/** Pre-trade blocker for a covered call, or null when the strike is acceptable. */
export function callStrikeBasisBlocker(
  strike: number,
  costBasis: number | null | undefined,
): string | null {
  const floor = callStrikeFloor(costBasis);
  if (floor == null) {
    return `Cost basis unknown — cannot verify covered-call strike is ≥ basis + $${MIN_CALL_STRIKE_OVER_BASIS.toFixed(2)}`;
  }
  if (meetsCallStrikeFloor(strike, floor)) return null;
  return `Strike $${strike.toFixed(2)} is below basis $${costBasis!.toFixed(2)} + $${MIN_CALL_STRIKE_OVER_BASIS.toFixed(2)} minimum ($${floor.toFixed(2)})`;
}
