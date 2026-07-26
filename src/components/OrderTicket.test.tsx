import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PreTradeResult } from "../api/preTradeCheck";
import { OrderTicket } from "./OrderTicket";

const okCheck: PreTradeResult = {
  ok: true,
  blockers: [],
  warnings: [],
  estCashFlow: 120,
  collateralRequired: 15_000,
  sharesLocked: 0,
};

function renderTicket(
  overrides: Partial<ComponentProps<typeof OrderTicket>> = {},
) {
  const onConfirm = vi.fn();
  const onQtyChange = vi.fn();
  const props = {
    action: "sell_to_open" as const,
    optionType: "put" as const,
    contractSymbol: "NVDA  260731P00150000",
    strike: 150,
    expiration: "2026-07-31",
    qty: 1,
    onQtyChange,
    maxQty: 5,
    limitPrice: 1.2,
    check: okCheck,
    busy: false,
    onConfirm,
    onCancel: vi.fn(),
    accent: "#34d399",
    simulate: true,
    ...overrides,
  };
  render(<OrderTicket {...props} />);
  return { onConfirm, onQtyChange };
}

describe("OrderTicket", () => {
  it("keeps SIMULATE disabled until acknowledgement is checked", async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderTicket();

    const submit = screen.getByRole("button", { name: /simulate order/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("resets acknowledgement when qty changes", async () => {
    const user = userEvent.setup();
    const { onQtyChange } = renderTicket();

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: /simulate order/i })).toBeEnabled();

    const qty = screen.getByRole("spinbutton");
    await user.clear(qty);
    await user.type(qty, "2");
    expect(onQtyChange).toHaveBeenCalled();
  });
});
