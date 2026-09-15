/**
 * Covered-call strike floor: a call is never sold below cost basis plus a
 * minimum per-share cushion, so an assignment always locks in a profit.
 * Basis is Alpaca's `avg_entry_price`. Mirrored in bot/src/basisFloor.ts and
 * enforced again by the backend proxy (AlpacaProxyPolicy.ValidateCallStrikeVsBasis).
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
 * A target below the floor therefore resolves to the lowest qualifying strike.
 * Null when no listed strike meets the floor.
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
