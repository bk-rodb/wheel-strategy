import { IS_MOCK } from "../config";
import { dteUntil, nextFriday, toDateString } from "../utils/nextFriday";
import { marketData, trading } from "./alpacaClient";
import type {
  AlpacaOptionContract,
  AlpacaOptionContractsResponse,
  AlpacaOptionSnapshotsResponse,
} from "./alpacaTypes";
import { fetchWheelAnalysis } from "./fetchWheelAnalysis";

/**
 * ATM implied vol from the next-Friday regular-strike put (or call when flat).
 * Returns annualized IV as a decimal (e.g. 0.45 = 45%).
 */
export async function fetchAtmImpliedVol(
  symbol: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const sym = symbol.toUpperCase();
  const expiration = toDateString(nextFriday());
  const dte = dteUntil(expiration);

  const analysis = await fetchWheelAnalysis({ symbol: sym, dte, granularity: "daily" }, signal);
  const regular = analysis.put?.find((s) => s.level === "regular");
  if (!regular) return null;

  if (IS_MOCK) {
    return analysis.realizedVolAnnual != null ? analysis.realizedVolAnnual * 1.25 : null;
  }

  let contracts: AlpacaOptionContract[] = [];
  try {
    const res = await trading.get<AlpacaOptionContractsResponse>(
      "/v2/options/contracts",
      {
        underlying_symbols: sym,
        expiration_date: expiration,
        type: "put",
        status: "active",
        limit: "100",
      },
      { signal },
    );
    contracts = res.option_contracts ?? [];
  } catch {
    return null;
  }

  if (contracts.length === 0) return null;

  let best = contracts[0];
  let bestDist = Math.abs(parseFloat(best.strike_price) - regular.strike);
  for (let i = 1; i < contracts.length; i++) {
    const dist = Math.abs(parseFloat(contracts[i].strike_price) - regular.strike);
    if (dist < bestDist) {
      best = contracts[i];
      bestDist = dist;
    }
  }

  try {
    const snapRes = await marketData.get<AlpacaOptionSnapshotsResponse>(
      "/v1beta1/options/snapshots",
      { symbols: best.symbol },
      { signal },
    );
    const iv = snapRes.snapshots?.[best.symbol]?.impliedVolatility;
    return iv != null && iv > 0 ? iv : null;
  } catch {
    return null;
  }
}
