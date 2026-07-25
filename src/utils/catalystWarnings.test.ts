import { describe, expect, it } from "vitest";
import { catalystWarningsForExpiry } from "./catalystWarnings";
import type { CatalystEvent } from "../types";

describe("catalystWarningsForExpiry", () => {
  const earnings: CatalystEvent = {
    id: "e1",
    type: "earnings",
    scope: "symbol",
    date: "2026-08-01",
    title: "Earnings",
    timing: "amc",
  };

  it("warns when earnings is before expiration", () => {
    const w = catalystWarningsForExpiry([earnings], "2026-08-15", "put");
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("Earnings");
  });

  it("skips earnings after expiration", () => {
    const w = catalystWarningsForExpiry([earnings], "2026-07-20", "put");
    expect(w).toHaveLength(0);
  });

  it("warns on ex-div for calls", () => {
    const div: CatalystEvent = {
      id: "d1",
      type: "ex_dividend",
      scope: "symbol",
      date: "2026-08-05",
      title: "Ex-dividend",
    };
    const w = catalystWarningsForExpiry([div], "2026-08-15", "call");
    expect(w.some((x) => x.includes("Ex-dividend"))).toBe(true);
  });
});
