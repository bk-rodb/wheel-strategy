import type { AccountInfo, CatalystEvent } from "../types";
import { isMarketOpen } from "../utils/marketHours";
import { catalystWarningsForExpiry } from "../utils/catalystWarnings";

export type OrderAction = "sell_to_open" | "buy_to_close";

export interface PreTradeInput {
  action: OrderAction;
  /** call | put for the contract being traded */
  optionType: "call" | "put";
  contractSymbol: string;
  strike: number;
  expiration: string;
  qty: number;
  limitPrice: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  /** Shares of underlying held (for covered-call coverage). */
  shares: number;
  account: AccountInfo | null;
  /** Contract known tradable; default true when unknown. */
  tradable?: boolean;
  /** Upcoming earnings / ex-div events for catalyst warnings. */
  catalystEvents?: CatalystEvent[];
}

export interface PreTradeResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  /** Estimated credit (sell) or debit (buy), dollars. */
  estCashFlow: number;
  /** CSP cash collateral required (strike*100*qty − credit). */
  collateralRequired: number;
  /** Shares locked for covered call. */
  sharesLocked: number;
}

const FAT_FINGER_BAND = 0.35; // 35% away from mid

/**
 * Pure pre-trade risk gate. Blockers prevent CONFIRM; warnings are amber advisories.
 */
export function preTradeCheck(input: PreTradeInput): PreTradeResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const qty = Math.max(0, Math.floor(input.qty));
  const limit = input.limitPrice;
  const mid = input.mid ?? (input.bid != null && input.ask != null
    ? (input.bid + input.ask) / 2
    : null);

  if (qty < 1) blockers.push("Quantity must be at least 1");
  if (!input.contractSymbol) blockers.push("Missing contract symbol");
  if (input.tradable === false) blockers.push("Contract is not tradable");

  const exp = new Date(`${input.expiration}T16:00:00`);
  if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
    blockers.push(`Contract expired (${input.expiration})`);
  }

  if (!isMarketOpen()) {
    warnings.push("Market is closed — order may rest until the next session (day TIF)");
  }

  const px = limit ?? mid ?? 0;
  const estCashFlow = px * qty * 100 * (input.action === "sell_to_open" ? 1 : -1);

  let collateralRequired = 0;
  let sharesLocked = 0;

  if (input.action === "sell_to_open") {
    if (input.optionType === "call") {
      const maxContracts = Math.floor(input.shares / 100);
      sharesLocked = qty * 100;
      if (maxContracts < 1) {
        blockers.push("Need at least 100 shares to sell a covered call");
      } else if (qty > maxContracts) {
        blockers.push(`Qty ${qty} exceeds covered capacity (${maxContracts} contracts from ${input.shares} shares)`);
      }
    } else {
      // Cash-secured put
      collateralRequired = Math.max(0, input.strike * 100 * qty - Math.max(0, estCashFlow));
      const bp = input.account?.buyingPower ?? null;
      if (bp == null) {
        warnings.push("Buying power unknown — cannot verify CSP collateral");
      } else if (collateralRequired > bp) {
        blockers.push(
          `CSP collateral ~$${collateralRequired.toFixed(0)} exceeds buying power $${bp.toFixed(0)}`,
        );
      }
    }
  } else {
    // buy_to_close
    const debit = Math.abs(estCashFlow);
    const cash = input.account?.cash ?? null;
    if (cash == null) {
      warnings.push("Cash unknown — cannot verify close debit coverage");
    } else if (debit > cash) {
      blockers.push(`Close debit ~$${debit.toFixed(2)} exceeds cash $${cash.toFixed(2)}`);
    }
  }

  if (limit != null && mid != null && mid > 0) {
    const band = Math.abs(limit - mid) / mid;
    if (band > FAT_FINGER_BAND) {
      blockers.push(
        `Limit $${limit.toFixed(2)} is ${(band * 100).toFixed(0)}% away from mid $${mid.toFixed(2)} (max ${(FAT_FINGER_BAND * 100).toFixed(0)}%)`,
      );
    } else if (band > 0.15) {
      warnings.push(
        `Limit $${limit.toFixed(2)} is ${(band * 100).toFixed(0)}% from mid $${mid.toFixed(2)}`,
      );
    }
  }

  if (limit == null) {
    warnings.push("Market order — fill price is not guaranteed");
  }

  if (input.bid == null && input.ask == null) {
    warnings.push("No live bid/ask — using estimated premium");
  }

  if (input.action === "sell_to_open" && input.catalystEvents?.length) {
    warnings.push(
      ...catalystWarningsForExpiry(
        input.catalystEvents,
        input.expiration,
        input.optionType,
      ),
    );
  }

  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    estCashFlow,
    collateralRequired,
    sharesLocked,
  };
}
