import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideReprice } from "./reprice.ts";

function order(status: string, filled_qty = "0", qty = "1") {
  return { status, filled_qty, qty };
}

describe("decideReprice", () => {
  it("terminal states are done regardless of repriceEnabled", () => {
    for (const enabled of [true, false]) {
      assert.deepEqual(
        decideReprice({ final: order("filled", "1", "1"), repriceEnabled: enabled, attempt: 1, maxAttempts: 3 }),
        { action: "done" },
      );
      assert.deepEqual(
        decideReprice({ final: order("canceled"), repriceEnabled: enabled, attempt: 1, maxAttempts: 3 }),
        { action: "done" },
      );
      assert.deepEqual(
        decideReprice({ final: order("done_for_day", "0"), repriceEnabled: enabled, attempt: 1, maxAttempts: 3 }),
        { action: "done" },
      );
    }
  });

  it("open order with reprice disabled is done", () => {
    assert.deepEqual(
      decideReprice({ final: order("accepted"), repriceEnabled: false, attempt: 1, maxAttempts: 3 }),
      { action: "done" },
    );
  });

  it("open order with reprice enabled and attempts remaining reprices", () => {
    assert.deepEqual(
      decideReprice({ final: order("accepted"), repriceEnabled: true, attempt: 1, maxAttempts: 3 }),
      { action: "reprice" },
    );
    assert.deepEqual(
      decideReprice({ final: order("accepted"), repriceEnabled: true, attempt: 2, maxAttempts: 3 }),
      { action: "reprice" },
    );
  });

  it("open order with attempts exhausted gives up", () => {
    assert.deepEqual(
      decideReprice({ final: order("accepted"), repriceEnabled: true, attempt: 3, maxAttempts: 3 }),
      { action: "giveUp" },
    );
    assert.deepEqual(
      decideReprice({ final: order("accepted"), repriceEnabled: true, attempt: 4, maxAttempts: 3 }),
      { action: "giveUp" },
    );
  });
});
