import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WheelAnalysisPanel } from "./WheelAnalysisPanel";
import { useWheelAnalysis } from "../hooks/useWheelAnalysis";
import { mockWheelAnalysis } from "../test/mockWheelAnalysis";

vi.mock("../hooks/useWheelAnalysis");

describe("WheelAnalysisPanel", () => {
  const refresh = vi.fn();

  beforeEach(() => {
    refresh.mockReset();
    vi.mocked(useWheelAnalysis).mockReturnValue({
      data: mockWheelAnalysis(),
      loading: false,
      error: null,
      refresh,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("defaults to weekly granularity", () => {
    render(<WheelAnalysisPanel symbol="NVDA" />);

    expect(useWheelAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "NVDA", dte: 35, granularity: "weekly" }),
    );
  });

  it("switches to daily granularity when DAILY is clicked", async () => {
    const user = userEvent.setup();
    render(<WheelAnalysisPanel symbol="NVDA" />);

    await user.click(screen.getByRole("button", { name: "DAILY" }));

    expect(useWheelAnalysis).toHaveBeenLastCalledWith(
      expect.objectContaining({ symbol: "NVDA", granularity: "daily" }),
    );
  });

  it("shows weekly helper text for loaded data", () => {
    render(<WheelAnalysisPanel symbol="NVDA" />);

    screen.getByText("~99 overlapping windows · coarser tails");
  });

  it("shows daily helper text when data is daily", () => {
    vi.mocked(useWheelAnalysis).mockReturnValue({
      data: mockWheelAnalysis({ granularity: "daily", sampleCount: 476, horizonPeriods: 25 }),
      loading: false,
      error: null,
      refresh,
    });

    render(<WheelAnalysisPanel symbol="NVDA" />);

    screen.getByText("~476 overlapping windows · tighter empirical percentiles");
  });

  it("shows granularity in loading state", () => {
    vi.mocked(useWheelAnalysis).mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refresh,
    });

    render(<WheelAnalysisPanel symbol="NVDA" />);

    screen.getByText("ANALYZING NVDA · weekly...");
  });
});
