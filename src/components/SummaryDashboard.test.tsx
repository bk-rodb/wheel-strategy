import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SummaryDashboard } from "./SummaryDashboard";
import { MOCK_POSITIONS } from "../data/mockPositions";
import { MOCK_ACCOUNT } from "../data/mockAccount";
import type { WheelPosition } from "../types";

vi.mock("./PositionCard", () => ({
  PositionCard: ({
    position,
    onSelect,
  }: {
    position: WheelPosition;
    onSelect: (id: string) => void;
  }) => (
    <button
      type="button"
      data-testid="position-card"
      data-ticker={position.ticker}
      onClick={() => onSelect(position.id)}
    >
      {position.ticker}
    </button>
  ),
}));

vi.mock("./RetrospectivePanel", () => ({
  RetrospectivePanel: () => <div data-testid="retrospective" />,
}));

vi.mock("../hooks/useOpenBlotterOrders", () => ({
  useOpenBlotterOrders: () => [],
}));

describe("SummaryDashboard position tiles", () => {
  it("renders every position through PositionCard", () => {
    const onSelect = vi.fn();
    render(
      <SummaryDashboard
        positions={MOCK_POSITIONS.slice(0, 3)}
        account={MOCK_ACCOUNT}
        activities={[]}
        onSelectTicker={onSelect}
      />,
    );

    const cards = screen.getAllByTestId("position-card");
    expect(cards.map((c) => c.getAttribute("data-ticker"))).toEqual(["TSLA", "NVDA", "AMZN"]);
  });

  it("forwards tile clicks to onSelectTicker", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <SummaryDashboard
        positions={MOCK_POSITIONS.slice(0, 1)}
        account={null}
        activities={[]}
        onSelectTicker={onSelect}
      />,
    );

    await user.click(screen.getByTestId("position-card"));
    expect(onSelect).toHaveBeenCalledWith("TSLA");
  });
});
