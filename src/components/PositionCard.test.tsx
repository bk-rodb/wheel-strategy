import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionCard } from "./PositionCard";
import { MOCK_POSITIONS } from "../data/mockPositions";
import { PHASE_CONFIG } from "../constants";
import type { WheelPosition } from "../types";

vi.mock("./Sparkline", () => ({
  Sparkline: () => <div data-testid="sparkline" />,
}));

function withTicker(base: WheelPosition, patch: Partial<WheelPosition>): WheelPosition {
  return { ...base, ...patch };
}

describe("PositionCard", () => {
  it("renders the same chrome for short and long company names", () => {
    const rklb = withTicker(MOCK_POSITIONS[0], {
      id: "RKLB",
      ticker: "RKLB",
      companyName: "Rocket Lab Corporation Common Stock",
      phase: "cash-secured-put",
    });
    const spcx = withTicker(MOCK_POSITIONS[0], {
      id: "SPCX",
      ticker: "SPCX",
      companyName: "Space Exploration Technologies Corp. Class A Common Stock",
      phase: "cash-secured-put",
    });

    const { rerender } = render(<PositionCard position={rklb} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /RKLB/ })).toBeInTheDocument();
    expect(screen.getByTitle(rklb.companyName)).toHaveStyle({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });

    rerender(<PositionCard position={spcx} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /SPCX/ })).toBeInTheDocument();
    expect(screen.getByTitle(spcx.companyName)).toHaveStyle({
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    expect(screen.getByTestId("position-card-accent")).toHaveStyle({
      background: PHASE_CONFIG["cash-secured-put"].color,
    });
  });

  it("paints the accent from phase, not ticker", () => {
    const cc = withTicker(MOCK_POSITIONS[0], { phase: "covered-call" });
    render(<PositionCard position={cc} onSelect={vi.fn()} />);
    expect(screen.getByTestId("position-card-accent")).toHaveStyle({
      background: PHASE_CONFIG["covered-call"].color,
    });
  });

  it("calls onSelect with the position id", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PositionCard position={MOCK_POSITIONS[1]} onSelect={onSelect} />);
    await user.click(screen.getByRole("button", { name: /NVDA/ }));
    expect(onSelect).toHaveBeenCalledWith("NVDA");
  });
});
