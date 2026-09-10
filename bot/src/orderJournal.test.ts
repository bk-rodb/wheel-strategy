import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { isJournalOpen, waitForJournalClear, type OrderJournalEntry } from "./orderJournal.ts";

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

describe("waitForJournalClear", () => {
  afterEach(() => {
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("returns true immediately when no open entries exist", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ entries: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const cleared = await waitForJournalClear("RKLB", { timeoutMs: 5_000, pollMs: 10 });
    assert.equal(cleared, true);
    assert.equal(calls, 1);
  });

  it("returns false once the timeout elapses while an entry stays open", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ entries: [entry("cancel_pending")] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const cleared = await waitForJournalClear("RKLB", { timeoutMs: 30, pollMs: 10 });
    assert.equal(cleared, false);
  });

  it("returns true once a later poll observes the entry has closed", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls++;
      const entries = calls < 3 ? [entry("cancel_pending")] : [];
      return new Response(JSON.stringify({ entries }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;

    const cleared = await waitForJournalClear("RKLB", { timeoutMs: 5_000, pollMs: 10 });
    assert.equal(cleared, true);
    assert.equal(calls, 3);
  });
});
