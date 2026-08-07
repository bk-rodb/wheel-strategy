/**
 * Scaffold for future covered-call early profit-take + reopen.
 *
 * Intended rule (not implemented):
 *   If a short covered call is profitable to buy-to-close AND the next-week
 *   regular (MED) covered-call still looks like a good sell, close early and
 *   reopen for the following Friday.
 *
 * Not wired into the weekly loop in v1 — sell-to-open only.
 */

export type EarlyCloseAction = "skip" | "close_and_reopen" | "wait";

export interface EarlyCloseCandidate {
  underlying: string;
  /** Short call contract currently held. */
  contractSymbol: string;
  strike: number;
  expiration: string;
  qty: number;
  /** Premium received when opened (per share), if known. */
  openPremium: number | null;
  /** Live ask/mid to buy-to-close. */
  closeDebit: number | null;
  /** Shares of underlying still held (must cover). */
  shares: number;
}

export interface EarlyCloseContext {
  /** Next Friday expiration the reopen would target. */
  nextExpiration: string;
  /** Suggested sell limit for next-week regular CC, if computed. */
  nextWeekSellLimit: number | null;
  /** Empirical assignment prob for next-week regular CC. */
  nextWeekEmpiricalAssign: number | null;
}

export interface EarlyCloseDecision {
  action: EarlyCloseAction;
  reason: string;
  /** Estimated P/L keep if closing now (credit − debit) × 100 × qty. */
  estimatedKeep?: number;
}

/**
 * Evaluate whether to early-close a covered call and reopen next week.
 * v1 stub — always skips.
 */
export function evaluateEarlyCloseCoveredCall(
  _candidate: EarlyCloseCandidate,
  _ctx: EarlyCloseContext,
): EarlyCloseDecision {
  return {
    action: "skip",
    reason: "not implemented",
  };
}
