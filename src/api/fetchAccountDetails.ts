import type { AccountInfo, BrokerType } from "../types";
import { trading } from "./alpacaClient";
import type { AlpacaAccount } from "./alpacaTypes";

export async function fetchAlpacaAccount(broker: BrokerType): Promise<AccountInfo> {
  const raw = await trading.get<AlpacaAccount>("/v2/account");
  const equity = parseFloat(raw.equity);
  const lastEquity = parseFloat(raw.last_equity);
  const dayPnL = equity - lastEquity;

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
  };
}
