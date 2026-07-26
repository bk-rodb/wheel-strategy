import type { AccountInfo, BrokerType } from "../types";
import { trading } from "./alpacaClient";
import type { AlpacaAccount, AlpacaPosition } from "./alpacaTypes";

export async function fetchAlpacaAccount(broker: BrokerType): Promise<AccountInfo> {
  const [raw, positions] = await Promise.all([
    trading.get<AlpacaAccount>("/v2/account"),
    trading.get<AlpacaPosition[]>("/v2/positions"),
  ]);

  const equity = parseFloat(raw.equity);
  const lastEquity = parseFloat(raw.last_equity);
  const dayPnL = equity - lastEquity;

  let costBasis = 0;
  let unrealizedPnL = 0;
  for (const pos of positions) {
    costBasis += Math.abs(parseFloat(pos.cost_basis));
    unrealizedPnL += parseFloat(pos.unrealized_pl);
  }

  return {
    broker,
    accountNumber: raw.account_number,
    equity,
    lastEquity,
    cash: parseFloat(raw.cash),
    buyingPower: parseFloat(raw.buying_power),
    longMarketValue: parseFloat(raw.long_market_value),
    dayPnL,
    dayPnLPct: lastEquity > 0 ? (dayPnL / lastEquity) * 100 : 0,
    costBasis,
    unrealizedPnL,
  };
}
