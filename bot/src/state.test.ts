import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alreadyCompletedForFriday, getNextRetryIndex, type LastCycle } from "./state.ts";

const done: LastCycle = {
  targetFriday: "2026-09-11",
  clientOrderId: "cid-1",
  at: "2026-09-07T13:35:00.000Z",
  status: "dry_run",
  retryIndex: 0,
};

describe("alreadyCompletedForFriday", () => {
  it("treats API null as not completed (desk re-arm)", () => {
    assert.equal(alreadyCompletedForFriday("NVDA", "2026-09-11", null), false);
  });

  it("honors API last-cycle when present", () => {
    assert.equal(alreadyCompletedForFriday("NVDA", "2026-09-11", done), true);
    assert.equal(alreadyCompletedForFriday("NVDA", "2026-09-18", done), false);
  });
});

describe("getNextRetryIndex", () => {
  it("uses API last-cycle for retry bump", () => {
    const canceled: LastCycle = { ...done, status: "canceled", retryIndex: 1 };
    assert.equal(getNextRetryIndex("NVDA", "2026-09-11", canceled), 2);
    assert.equal(getNextRetryIndex("NVDA", "2026-09-11", null), 0);
  });
});
