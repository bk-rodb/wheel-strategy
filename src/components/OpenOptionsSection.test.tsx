import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenOptionsSection } from "./OpenOptionsSection";
import { useFridayOptionSuggestions } from "../hooks/useFridayOptionSuggestions";
import { usePendingOptionOrder } from "../hooks/usePendingOptionOrder";
import { useTickerCatalysts } from "../hooks/useTickerCatalysts";
import { MOCK_ACCOUNT } from "../data/mockAccount";
import type { FridayOptionsBundle } from "../api/fetchFridayOptions";

vi.mock("../hooks/useFridayOptionSuggestions");
vi.mock("../hooks/usePendingOptionOrder");
vi.mock("../hooks/useTickerCatalysts");

const bundle: FridayOptionsBundle = {
  symbol: "NVDA",
  side: "put",
  expiration: "2026-07-31",
  dte: 6,
  spot: 170,
  contracts: 1,
  quotedAt: null,
  hmmRegime: null,
  warnings: [],
  rows: [
    {
      level: "regular",
      label: "MED",
      strike: 160,
      pctFromSpot: -0.06,
      empiricalAssignmentProb: 0.3,
      blackScholesAssignmentProb: 0.32,
      estPremium: 2.1,
      contractSymbol: "NVDA  260731P00160000",
      bid: 2.0,
      ask: 2.2,
      mid: 2.1,
      sellLimit: 2.1,
      tradable: true,
      multiplier: 100,
      contractSize: 100,
      rootSymbol: "NVDA",
      openInterest: 100,
    },
  ],
};

describe("OpenOptionsSection", () => {
  beforeEach(() => {
    vi.mocked(useFridayOptionSuggestions).mockReturnValue({
      data: bundle,
      loading: false,
      error: null,
      refresh: vi.fn(),
      expirations: ["2026-07-31"],
      defaultExpiration: "2026-07-31",
      quotedAt: null,
    });

    vi.mocked(usePendingOptionOrder).mockReturnValue({
      order: null,
      phase: "idle",
      error: null,
      clientOrderId: null,
      partialFillQty: null,
      multiOpenCount: 0,
      locked: false,
      canCancel: false,
      place: vi.fn(),
      cancel: vi.fn(),
      reset: vi.fn(),
      refresh: vi.fn(),
      setDeskPhase: vi.fn(),
    });

    vi.mocked(useTickerCatalysts).mockReturnValue({
      events: [],
      news: [],
      loading: false,
      error: null,
      warnings: [],
    });
  });

  it("renders the Friday ladder with a SELL control", () => {
    render(
      <OpenOptionsSection symbol="NVDA" shares={0} account={MOCK_ACCOUNT} />,
    );

    expect(screen.getByText(/open options/i)).toBeInTheDocument();
    expect(screen.getByText(/160/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /sell/i }).length).toBeGreaterThan(0);
  });
});
