import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  decideEntry,
  fridayOfWeek,
  marketOpenEt,
  nextFriday,
  nextMondayOpen,
} from "./calendar.ts";

/** Build a Date that is the given ET wall-clock instant. */
function etInstant(
  y: number,
  m: number,
  d: number,
  hour: number,
  minute: number,
): Date {
  for (let utcHour = 0; utcHour < 24; utcHour++) {
    for (const utcMinute of [0, 30]) {
      const candidate = new Date(Date.UTC(y, m - 1, d, utcHour, utcMinute, 0));
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: false,
      }).formatToParts(candidate);
      const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
      if (
        get("year") === y &&
        get("month") === m &&
        get("day") === d &&
        get("hour") === hour &&
        get("minute") === minute
      ) {
        return candidate;
      }
    }
  }
  throw new Error(`Could not resolve ET instant ${y}-${m}-${d} ${hour}:${minute}`);
}

describe("fridayOfWeek / nextFriday", () => {
  it("Monday maps to that week's Friday", () => {
    const mon = etInstant(2026, 8, 3, 10, 0);
    assert.equal(fridayOfWeek(mon), "2026-08-07");
    assert.equal(nextFriday(mon), "2026-08-07");
  });

  it("Friday before close is same Friday", () => {
    const fri = etInstant(2026, 8, 7, 15, 0);
    assert.equal(nextFriday(fri), "2026-08-07");
  });

  it("Friday after close rolls to next Friday", () => {
    const fri = etInstant(2026, 8, 7, 16, 0);
    assert.equal(nextFriday(fri), "2026-08-14");
  });
});

describe("decideEntry", () => {
  it("Monday after open → run this Friday", () => {
    const mon = etInstant(2026, 8, 3, 10, 0);
    const d = decideEntry(mon);
    assert.equal(d.action, "run");
    if (d.action === "run") {
      assert.equal(d.targetFriday, "2026-08-07");
    }
  });

  it("Monday before open → wait until open", () => {
    const mon = etInstant(2026, 8, 3, 8, 0);
    const d = decideEntry(mon);
    assert.equal(d.action, "wait");
    if (d.action === "wait") {
      assert.equal(d.until.getTime(), marketOpenEt("2026-08-03").getTime());
    }
  });

  it("Tuesday → run this Friday", () => {
    const tue = etInstant(2026, 8, 4, 11, 0);
    const d = decideEntry(tue);
    assert.equal(d.action, "run");
    if (d.action === "run") {
      assert.equal(d.targetFriday, "2026-08-07");
    }
  });

  it("Wednesday → wait until next Monday; next target is following Friday", () => {
    const wed = etInstant(2026, 8, 5, 10, 0);
    const d = decideEntry(wed);
    assert.equal(d.action, "wait");
    if (d.action === "wait") {
      assert.equal(d.until.getTime(), nextMondayOpen(wed).getTime());
      assert.match(d.reason, /2026-08-14/);
    }
  });

  it("Friday → wait until next Monday", () => {
    const fri = etInstant(2026, 8, 7, 10, 0);
    const d = decideEntry(fri);
    assert.equal(d.action, "wait");
    if (d.action === "wait") {
      assert.equal(d.until.getTime(), marketOpenEt("2026-08-10").getTime());
    }
  });

  it("Saturday → wait until Monday open", () => {
    const sat = etInstant(2026, 8, 8, 12, 0);
    const d = decideEntry(sat);
    assert.equal(d.action, "wait");
    if (d.action === "wait") {
      assert.equal(d.until.getTime(), marketOpenEt("2026-08-10").getTime());
    }
  });
});
