import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isJournalOpen, type OrderJournalEntry } from "./orderJournal.ts";

function entry(deskState: string): OrderJournalEntry {
  return {
    clientOrderId: "c1",
    alpacaOrderId: null,
    underlying: "NVDA",
    symbol: "NVDA250801P00150000",
    side: "sell",
    qty: "1",
    filledQty: "0",
    limitPrice: "1.00",
    deskState,
    brokerStatus: null,
    source: "bot",
    lastError: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terminalAt: null,
  };
}

describe("orderJournal", () => {
  it("treats submitting/working as open", () => {
    assert.equal(isJournalOpen(entry("submitting")), true);
    assert.equal(isJournalOpen(entry("working")), true);
    assert.equal(isJournalOpen(entry("orphan_check")), true);
  });

  it("treats filled/canceled/submit_failed as closed", () => {
    assert.equal(isJournalOpen(entry("filled")), false);
    assert.equal(isJournalOpen(entry("canceled")), false);
    assert.equal(isJournalOpen(entry("submit_failed")), false);
    assert.equal(isJournalOpen(entry("blocked")), false);
  });
});
