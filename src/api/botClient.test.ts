import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config", () => ({
  IS_MOCK: true,
  API_BASE: "http://localhost:5099",
}));

import {
  clearBotLastCycle,
  fetchBotConfig,
  fetchBotRuns,
  resetMockBotState,
  saveBotConfig,
} from "./fetchBot";

describe("bot client (mock)", () => {
  beforeEach(() => {
    resetMockBotState();
  });

  it("returns seeded config and history", async () => {
    const cfg = await fetchBotConfig();
    expect(cfg.settings.symbols).toEqual(["NVDA", "SPCX", "RKLB"]);
    expect(cfg.settings.dryRun).toBe(true);
    const runs = await fetchBotRuns();
    expect(runs.length).toBeGreaterThan(0);
  });

  it("saves level and re-arms a symbol", async () => {
    const saved = await saveBotConfig({ level: "safe" });
    expect(saved.settings.level).toBe("safe");
    const cleared = await clearBotLastCycle("NVDA");
    expect(cleared).toBe(1);
    const cfg = await fetchBotConfig();
    expect(cfg.lastCycles.find((c) => c.symbol === "NVDA")).toBeUndefined();
  });
});
