import { describe, expect, it } from "vitest";
import type { AccountInfo } from "../types";
import { preTradeCheck } from "./preTradeCheck";

const account: AccountInfo = {
  broker: "alpaca-paper",
  accountNumber: "PA123",
  equity: 100_000,
  lastEquity: 100_000,
  cash: 50_000,
  buyingPower: 80_000,
  longMarketValue: 0,
  dayPnL: 0,
  dayPnLPct: 0,
  costBasis: 0,
  unrealizedPnL: 0,
};

describe("preTradeCheck", () => {
  it("blocks CSP when collateral exceeds buying power", () => {
    const r = preTradeCheck({
      action: "sell_to_open",
      optionType: "put",
      contractSymbol: "SPCX  260724P00100000",
      strike: 100,
      expiration: "2099-07-24",
      qty: 10,
      limitPrice: 0.1,
      bid: 0.1,
      ask: 0.12,
      mid: 0.11,
      shares: 0,
      account: { ...account, buyingPower: 1_000 },
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("collateral"))).toBe(true);
  });

  it("blocks covered call without 100 shares", () => {
    const r = preTradeCheck({
      action: "sell_to_open",
      optionType: "call",
      contractSymbol: "AMZN  260724C00200000",
      strike: 200,
      expiration: "2099-07-24",
      qty: 1,
      limitPrice: 1.5,
      bid: 1.4,
      ask: 1.6,
      mid: 1.5,
      shares: 50,
      account,
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("100 shares"))).toBe(true);
  });

  it("blocks fat-finger limit far from mid", () => {
    const r = preTradeCheck({
      action: "sell_to_open",
      optionType: "put",
      contractSymbol: "SPCX  260724P00100000",
      strike: 100,
      expiration: "2099-07-24",
      qty: 1,
      limitPrice: 5,
      bid: 0.3,
      ask: 0.35,
      mid: 0.325,
      shares: 0,
      account,
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("away from mid"))).toBe(true);
  });

  it("allows a sane CSP sell", () => {
    const r = preTradeCheck({
      action: "sell_to_open",
      optionType: "put",
      contractSymbol: "SPCX  260724P00100000",
      strike: 100,
      expiration: "2099-07-24",
      qty: 1,
      limitPrice: 0.3,
      bid: 0.28,
      ask: 0.32,
      mid: 0.3,
      shares: 0,
      account,
    });
    expect(r.ok).toBe(true);
    expect(r.blockers).toHaveLength(0);
    expect(r.estCashFlow).toBeCloseTo(30, 0);
    expect(r.collateralRequired).toBeGreaterThan(0);
  });

  it("blocks buy-to-close when debit exceeds cash", () => {
    const r = preTradeCheck({
      action: "buy_to_close",
      optionType: "put",
      contractSymbol: "SPCX  260724P00100000",
      strike: 100,
      expiration: "2099-07-24",
      qty: 5,
      limitPrice: 2,
      bid: 1.9,
      ask: 2.1,
      mid: 2,
      shares: 0,
      account: { ...account, cash: 100 },
    });
    expect(r.ok).toBe(false);
    expect(r.blockers.some((b) => b.includes("debit"))).toBe(true);
  });

  it("warns on earnings before expiration", () => {
    const r = preTradeCheck({
      action: "sell_to_open",
      optionType: "put",
      contractSymbol: "AAPL  260724P00100000",
      strike: 100,
      expiration: "2026-08-15",
      qty: 1,
      limitPrice: 0.3,
      bid: 0.28,
      ask: 0.32,
      mid: 0.3,
      shares: 0,
      account,
      catalystEvents: [
        {
          id: "e1",
          type: "earnings",
          scope: "symbol",
          date: "2026-08-01",
          title: "Q3 earnings",
          timing: "amc",
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes("Earnings"))).toBe(true);
  });
});
