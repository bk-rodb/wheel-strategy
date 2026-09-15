import { test } from "node:test";
import assert from "node:assert/strict";
import { callStrikeFloor, snapCallStrike } from "./basisFloor.js";
import { preTradeCheck } from "./preTrade.js";

const chain = [180, 182.5, 185, 187.5, 190].map((k) => ({ strike_price: String(k), symbol: `C${k}` }));

test("floor is basis + $1; null when unknown", () => {
  assert.ok(Math.abs(callStrikeFloor(184.2)! - 185.2) < 1e-9);
  assert.equal(callStrikeFloor(0), null);
});

test("snapCallStrike raises below-floor target to lowest strike ≥ floor", () => {
  assert.equal(snapCallStrike(chain, 181, 185.2)?.strike_price, "187.5");
  assert.equal(snapCallStrike(chain, 188, 185.2)?.strike_price, "187.5");
  assert.equal(snapCallStrike(chain, 181, 191), null);
});

const baseCall = {
  optionType: "call" as const,
  contractSymbol: "NVDA260918C00185000",
  expiration: "2099-09-18",
  qty: 1,
  limitPrice: 1.5,
  bid: 1.4,
  ask: 1.6,
  mid: 1.5,
  shares: 100,
  account: { cash: 10_000, buyingPower: 10_000, optionsBuyingPower: 10_000 },
};

test("preTradeCheck blocks a covered call below basis + $1", () => {
  const r = preTradeCheck({ ...baseCall, strike: 185, costBasis: 184.5 });
  assert.equal(r.ok, false);
  assert.ok(r.blockers.some((b) => b.includes("below basis")));
});

test("preTradeCheck allows a covered call at basis + $1", () => {
  const r = preTradeCheck({ ...baseCall, strike: 185.5, costBasis: 184.5 });
  assert.ok(!r.blockers.some((b) => b.includes("basis")));
});

test("preTradeCheck blocks a covered call when basis is unknown", () => {
  const r = preTradeCheck({ ...baseCall, strike: 185, costBasis: null });
  assert.ok(r.blockers.some((b) => b.includes("Cost basis unknown")));
});
