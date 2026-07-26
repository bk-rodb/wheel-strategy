import { describe, expect, it } from "vitest";
import { dteUntil, nextFriday, toDateString } from "./nextFriday";

describe("nextFriday", () => {
  it("returns the same day when already Friday", () => {
    // 2026-07-17 is a Friday
    const fri = nextFriday(new Date("2026-07-17T10:00:00"));
    expect(toDateString(fri)).toBe("2026-07-17");
  });

  it("rolls forward from Saturday to the following Friday", () => {
    // 2026-07-18 is a Saturday
    const fri = nextFriday(new Date("2026-07-18T10:00:00"));
    expect(toDateString(fri)).toBe("2026-07-24");
  });

  it("rolls to the next Friday after the 4 PM ET close on Friday", () => {
    // 2026-07-17 is a Friday; 21:00 UTC = 5 PM ET (EDT)
    const fri = nextFriday(new Date("2026-07-17T21:00:00.000Z"));
    expect(toDateString(fri)).toBe("2026-07-24");
  });

  it("computes dteUntil with a floor of 1", () => {
    expect(dteUntil("2026-07-24", new Date("2026-07-18T12:00:00"))).toBe(7);
    expect(dteUntil("2026-07-18", new Date("2026-07-18T12:00:00"))).toBe(1);
  });
});
