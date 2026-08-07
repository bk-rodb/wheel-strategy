import { isRegularSession } from "./calendar.js";
import type { AccountSnapshot } from "./positions.js";
import type { OptionSide } from "./positions.js";

export interface PreTradeInput {
  optionType: OptionSide;
  contractSymbol: string;
  strike: number;
  expiration: string;
  qty: number;
  limitPrice: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  shares: number;
  account: AccountSnapshot | null;
  tradable?: boolean;
  contractMultiplier?: number;
}

export interface PreTradeResult {
  ok: boolean;
  blockers: string[];
  warnings: string[];
  estCashFlow: number;
  collateralRequired: number;
  sharesLocked: number;
}

const FAT_FINGER_BAND = 0.35;

/** Pure pre-trade risk gate (desk parity, no catalysts). */
export function preTradeCheck(input: PreTradeInput): PreTradeResult {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const qty = Math.max(0, Math.floor(input.qty));
  const limit = input.limitPrice;
  const mult = input.contractMultiplier ?? 100;
  const mid =
    input.mid ??
    (input.bid != null && input.ask != null ? (input.bid + input.ask) / 2 : null);

  if (qty < 1) blockers.push("Quantity must be at least 1");
  if (!input.contractSymbol) blockers.push("Missing contract symbol");
  if (input.tradable === false) blockers.push("Contract is not tradable");

  const exp = new Date(`${input.expiration}T16:00:00`);
  if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
    blockers.push(`Contract expired (${input.expiration})`);
  }

  if (!isRegularSession()) {
    warnings.push("Market is closed — day order may not fill this session");
  }

  const px = limit ?? mid ?? 0;
  const estCashFlow = px * qty * mult;

  let collateralRequired = 0;
  let sharesLocked = 0;

  if (input.optionType === "call") {
    const maxContracts = Math.floor(input.shares / mult);
    sharesLocked = qty * mult;
    if (maxContracts < 1) {
      blockers.push(`Need at least ${mult} shares to sell a covered call`);
    } else if (qty > maxContracts) {
      blockers.push(
        `Qty ${qty} exceeds covered capacity (${maxContracts} from ${input.shares} shares)`,
      );
    }
  } else {
    collateralRequired = Math.max(0, input.strike * mult * qty - Math.max(0, estCashFlow));
    const bp = input.account?.optionsBuyingPower ?? input.account?.buyingPower ?? null;
    if (bp == null) {
      warnings.push("Options buying power unknown — cannot verify CSP collateral");
    } else if (collateralRequired > bp) {
      blockers.push(
        `CSP collateral ~$${collateralRequired.toFixed(0)} exceeds options buying power $${bp.toFixed(0)}`,
      );
    }
  }

  if (limit != null && mid != null && mid > 0) {
    const band = Math.abs(limit - mid) / mid;
    if (band > FAT_FINGER_BAND) {
      blockers.push(
        `Limit $${limit.toFixed(2)} is ${(band * 100).toFixed(0)}% away from mid $${mid.toFixed(2)}`,
      );
    } else if (band > 0.15) {
      warnings.push(
        `Limit $${limit.toFixed(2)} is ${(band * 100).toFixed(0)}% from mid $${mid.toFixed(2)}`,
      );
    }
  }

  if (input.bid == null && input.ask == null) {
    warnings.push("No live bid/ask — using estimated premium");
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
