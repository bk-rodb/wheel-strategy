import { describe, expect, it } from "vitest";
import { callStrikeBasisBlocker, callStrikeFloor, snapCallStrike } from "./basisFloor";

const chain = [180, 182.5, 185, 187.5, 190].map((k) => ({ strike_price: String(k), symbol: `C${k}` }));

describe("basisFloor", () => {
  it("floor is basis + $1, null when basis unknown", () => {
    expect(callStrikeFloor(184.2)).toBeCloseTo(185.2);
    expect(callStrikeFloor(0)).toBeNull();
    expect(callStrikeFloor(undefined)).toBeNull();
  });

  it("keeps the nearest strike when it already clears the floor", () => {
    expect(snapCallStrike(chain, 188, 185.2)?.strike_price).toBe("187.5");
  });

  it("raises a below-floor target to the lowest strike ≥ floor", () => {
    expect(snapCallStrike(chain, 181, 185.2)?.strike_price).toBe("187.5");
    expect(snapCallStrike(chain, 181, 185)?.strike_price).toBe("185");
  });

  it("returns null when no listed strike meets the floor", () => {
    expect(snapCallStrike(chain, 181, 191)).toBeNull();
  });

  it("blocker text for below floor / unknown basis; null at the floor", () => {
    expect(callStrikeBasisBlocker(185, 184.5)).toMatch(/below basis/);
    expect(callStrikeBasisBlocker(185.5, 184.5)).toBeNull();
    expect(callStrikeBasisBlocker(185, 0)).toMatch(/unknown/);
  });
});
