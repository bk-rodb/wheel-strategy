import { useEffect, useMemo, useRef, useState } from "react";
import type { FridayOptionRow } from "../api/fetchFridayOptions";
import { fetchContractSnapshot } from "../api/fetchFridayOptions";
import { buildOsiSymbol } from "../api/optionOrders";
import { preTradeCheck, type OrderAction } from "../api/preTradeCheck";
import { IS_MOCK } from "../config";
import { LEVEL_COLOR } from "../constants";
import { useFridayOptionSuggestions } from "../hooks/useFridayOptionSuggestions";
import { usePendingOptionOrder } from "../hooks/usePendingOptionOrder";
import { useTickerCatalysts } from "../hooks/useTickerCatalysts";
import type { AccountInfo, OptionLeg, WheelPhase } from "../types";
import { fmt } from "../utils/formatters";
import { dteUntil } from "../utils/nextFriday";
import { OptionCard } from "./OptionCard";
import { OrderTicket } from "./OrderTicket";
import { Banner, CardLabel, EmptyState } from "./ui";
import { alpha, vars } from "../theme";

type TicketDraft = {
  action: OrderAction;
  optionType: "call" | "put";
  contractSymbol: string;
  strike: number;
  expiration: string;
  limitPrice: number;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  tradable?: boolean;
  contractMultiplier?: number;
  quoteQuotedAt?: string | null;
  level?: FridayOptionRow["level"];
  /** After close fills, open this sell draft (roll). */
  rollAfter?: Omit<TicketDraft, "rollAfter" | "action"> & { action: "sell_to_open" };
};

interface OpenOptionsSectionProps {
  symbol: string;
  shares: number;
  activeOption?: OptionLeg;
  phase?: WheelPhase;
  account?: AccountInfo | null;
  /** When true, scroll this section into view and briefly highlight. */
  focusSection?: boolean;
  onFocusHandled?: () => void;
  /** Re-fetch account positions after a sell/buy order fills. */
  onPositionRefresh?: () => void;
  /** Per-share cost basis; covered-call strikes must be ≥ basis + $1. */
  costBasis?: number;
}

export function OpenOptionsSection({
  symbol,
  shares,
  activeOption,
  phase = shares >= 100 ? "stock-holding" : "cash-secured-put",
  account = null,
  focusSection = false,
  onFocusHandled,
  onPositionRefresh,
  costBasis,
}: OpenOptionsSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(false);
  const canCoverCall = shares >= 100;
  // Ladder side: covered-call capacity → calls; else puts. Same for roll targets.
  const side: "call" | "put" =
    activeOption?.type === "call" || canCoverCall ? "call" : "put";

  const [selectedExpiration, setSelectedExpiration] = useState<string | null>(null);

  const { data, loading, error, refresh, expirations, defaultExpiration } =
    useFridayOptionSuggestions({
      symbol,
      side,
      shares,
      costBasis,
      expiration: selectedExpiration,
      enabled: true,
    });

  const { events: catalystEvents } = useTickerCatalysts(symbol);

  const pickerExpiration = selectedExpiration ?? defaultExpiration;

  useEffect(() => {
    setSelectedExpiration(null);
    setTicket(null);
    setQty(1);
    setBusy(false);
    setFlashMsg(null);
    setFlashErr(null);
    setRollPending(null);
  }, [symbol, side]);

  const {
    order: pendingOrder,
    phase: orderPhase,
    error: orderHookErr,
    clientOrderId,
    partialFillQty,
    multiOpenCount,
    locked,
    canCancel,
    place,
    cancel,
    reset,
    setDeskPhase,
  } = usePendingOptionOrder({ underlying: symbol, enabled: true });

  useEffect(() => {
    if (!focusSection) return;
    const t0 = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlight(true);
      onFocusHandled?.();
    }, 60);
    const t1 = window.setTimeout(() => setHighlight(false), 2400);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onFocusHandled flips focusSection and must not cancel the fade timer
  }, [focusSection]);

  // After fill or partial fill on cancel, reload positions.
  useEffect(() => {
    if (orderPhase !== "filled" && orderPhase !== "partial_filled") return;
    onPositionRefresh?.();
  }, [orderPhase, onPositionRefresh]);

  const [ticket, setTicket] = useState<TicketDraft | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [flashMsg, setFlashMsg] = useState<string | null>(null);
  const [flashErr, setFlashErr] = useState<string | null>(null);
  const [rollPending, setRollPending] = useState<TicketDraft | null>(null);

  const accent =
    ticket?.action === "buy_to_close"
      ? vars.status.info
      : side === "call" || ticket?.optionType === "call"
        ? vars.status.gain
        : vars.status.warning;

  const check = useMemo(() => {
    if (!ticket) {
      return preTradeCheck({
        action: "sell_to_open",
        optionType: "put",
        contractSymbol: "",
        strike: 0,
        expiration: "2099-01-01",
        qty: 1,
        limitPrice: null,
        bid: null,
        ask: null,
        mid: null,
        shares,
        account,
      });
    }
    return preTradeCheck({
      action: ticket.action,
      optionType: ticket.optionType,
      contractSymbol: ticket.contractSymbol,
      strike: ticket.strike,
      expiration: ticket.expiration,
      qty,
      limitPrice: ticket.limitPrice,
      bid: ticket.bid,
      ask: ticket.ask,
      mid: ticket.mid,
      shares,
      account,
      tradable: ticket.tradable !== false,
      contractMultiplier: ticket.contractMultiplier ?? 100,
      catalystEvents,
      costBasis,
    });
  }, [ticket, qty, shares, account, catalystEvents, costBasis]);

  const sellDraftFor = (
    row: FridayOptionRow,
    expiration: string,
  ): TicketDraft & { action: "sell_to_open" } => ({
    action: "sell_to_open",
    optionType: side,
    contractSymbol: row.contractSymbol,
    strike: row.strike,
    expiration,
    limitPrice: row.sellLimit,
    bid: row.bid,
    ask: row.ask,
    mid: row.mid,
    tradable: row.tradable,
    contractMultiplier: row.multiplier,
    level: row.level,
  });

  const openSellTicket = (row: FridayOptionRow) => {
    if (locked) return;
    setDeskPhase("confirming", `ticket ${row.contractSymbol}`);
    setQty(data?.contracts ?? 1);
    setFlashMsg(null);
    setFlashErr(null);
    setTicket(sellDraftFor(row, data?.expiration ?? ""));
  };

  /** Quote the held leg and open a buy-to-close ticket, optionally chaining a roll sell. */
  const openBuyToCloseTicket = async (
    opt: OptionLeg,
    reason: string,
    rollAfter?: TicketDraft["rollAfter"],
  ) => {
    const contractSymbol = buildOsiSymbol(symbol, opt.expiration, opt.type, opt.strike);
    setDeskPhase("confirming", `${reason} ${contractSymbol}`);
    setQty(opt.contracts);
    setFlashMsg(null);
    setFlashErr(null);
    const quote = await fetchContractSnapshot(contractSymbol);
    setTicket({
      action: "buy_to_close",
      optionType: opt.type,
      contractSymbol,
      strike: opt.strike,
      expiration: opt.expiration,
      limitPrice: quote.mid ?? quote.ask ?? opt.currentOptionPrice,
      bid: quote.bid,
      ask: quote.ask,
      mid: quote.mid,
      quoteQuotedAt: quote.quotedAt,
      contractMultiplier: 100,
      rollAfter,
    });
  };

  const openCloseTicket = async () => {
    if (!activeOption || locked) return;
    await openBuyToCloseTicket(activeOption, "close");
  };

  const openRollTicket = async () => {
    if (!activeOption || locked || !data?.rows.length) return;
    const openRow = data.rows.find((r) => r.level === "regular") ?? data.rows[0];
    await openBuyToCloseTicket(activeOption, "roll close", sellDraftFor(openRow, data.expiration));
  };

  const dismissTicket = () => {
    setTicket(null);
    setRollPending(null);
    if (!locked) setDeskPhase("idle", "ticket dismissed");
  };

  const submitTicket = async () => {
    if (!ticket || locked) return;
    setBusy(true);
    setFlashErr(null);
    setFlashMsg(null);
    try {
      const order = await place({
        contractSymbol: ticket.contractSymbol,
        qty,
        limitPrice: ticket.limitPrice,
        side: ticket.action === "sell_to_open" ? "sell" : "buy",
        positionIntent: ticket.action === "buy_to_close" ? "buy_to_close" : "sell_to_open",
        decisionSnapshot:
          ticket.action === "sell_to_open"
            ? {
                underlying: symbol.toUpperCase(),
                optionRight: ticket.optionType,
                wheelSide: ticket.optionType === "call" ? "cc" : "csp",
                level: ticket.level ?? null,
                modelStrike: ticket.strike,
                snappedStrike: ticket.strike,
                targetDelta: null,
                hmmRegime: data?.hmmRegime ?? null,
                spotAtSubmit: data?.spot ?? null,
                suggestedLimit: ticket.limitPrice,
                midAtSubmit: ticket.mid,
                bidAtSubmit: ticket.bid,
                dte: data?.dte ?? dteUntil(ticket.expiration),
                granularity: "weekly",
                earningsInWindow:
                  catalystEvents?.some(
                    (e) =>
                      e.type === "earnings" &&
                      typeof e.date === "string" &&
                      e.date <= ticket.expiration,
                  ) ?? null,
                empiricalAssignmentProb:
                  data?.rows.find((r) => r.contractSymbol === ticket.contractSymbol)
                    ?.empiricalAssignmentProb ?? null,
                estPremium:
                  data?.rows.find((r) => r.contractSymbol === ticket.contractSymbol)
                    ?.estPremium ?? null,
                contractSymbol: ticket.contractSymbol,
              }
            : undefined,
      });
      if (order) {
        setFlashMsg(
          `${IS_MOCK ? "SIMULATED · " : ""}${ticket.action === "sell_to_open" ? "SELL" : "BUY"} ${order.qty} ${order.symbol} → ${order.status.toUpperCase()}`,
        );
        if (ticket.rollAfter) {
          setRollPending({ ...ticket.rollAfter, action: "sell_to_open" });
        }
        setTicket(null);
      }
    } catch (e) {
      setFlashErr(e instanceof Error ? e.message : "Order failed");
    } finally {
      setBusy(false);
    }
  };

  // After a close fills during roll, open the sell ticket.
  useEffect(() => {
    if (
      !rollPending ||
      orderPhase !== "filled" ||
      pendingOrder?.side !== "buy" ||
      ticket
    ) {
      return;
    }
    const next = rollPending;
    const q = Math.max(1, parseInt(pendingOrder.qty, 10) || 1);
    setRollPending(null);
    setQty(q);
    reset();
    setTicket(next);
  }, [rollPending, orderPhase, pendingOrder, ticket, reset]);

  const onCancelOrder = async () => {
    setBusy(true);
    setFlashErr(null);
    try {
      const final = await cancel();
      if (
        final &&
        (final.status === "canceled" ||
          final.status === "expired" ||
          final.status === "rejected")
      ) {
        const filledQty = Number(final.filled_qty ?? 0);
        if (filledQty > 0 || partialFillQty) {
          setFlashMsg(
            `ORDER CANCELED WITH ${filledQty || partialFillQty} FILLED — refresh positions`,
          );
        } else {
          setFlashMsg(`ORDER ${final.status.toUpperCase()} — actions unlocked`);
        }
        setTicket(null);
        setRollPending(null);
      } else if (final?.status === "filled") {
        setFlashErr("Cancel failed — order filled first");
      }
    } catch (e) {
      setFlashErr(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (() => {
    switch (orderPhase) {
      case "submitting":
        return "SUBMITTING…";
      case "orphan_check":
        return "RECONCILING SUBMISSION…";
      case "ack_pending":
        return "AWAITING VENUE ACCEPTANCE (UNACKED)…";
      case "working":
        return pendingOrder
          ? `WORKING · ${pendingOrder.status.toUpperCase()} (cancelable until filled)`
          : "WORKING";
      case "cancel_requested":
        return "CANCEL REQUESTED…";
      case "cancel_pending":
        return "AWAITING CANCEL CONFIRM…";
      case "filled":
        return "FILLED — no longer cancelable";
      case "partial_filled":
        return partialFillQty
          ? `PARTIAL FILL (${partialFillQty}) — cancel confirmed`
          : "PARTIAL FILL — cancel confirmed";
      case "canceled":
        return "CANCELED";
      case "rejected":
        return "REJECTED";
      case "error":
        return "ERROR";
      default:
        return null;
    }
  })();

  const maxQty =
    ticket?.action === "buy_to_close"
      ? activeOption?.contracts ?? qty
      : ticket?.optionType === "call"
        ? Math.max(1, Math.floor(shares / 100))
        : 20;

  const multiOpenBanner =
    multiOpenCount > 1 ? (
      <div
        style={{
          background: vars.tint.lossSurface,
          border: `1px solid ${alpha(vars.status.loss, 0.314)}`,
          borderRadius: 4,
          padding: "10px 12px",
          marginBottom: 10,
          fontSize: 11,
          fontFamily: vars.font.mono,
          color: vars.status.loss,
        }}
      >
        {multiOpenCount} OPEN OPTION ORDERS for {symbol.toUpperCase()} — cancel extras before
        placing. SELL locked.
      </div>
    ) : null;

  const workingBanner =
    locked && (pendingOrder || orderPhase === "orphan_check" || orderPhase === "ack_pending" || orderPhase === "submitting") ? (
      <div
        style={{
          background: vars.bg.raised,
          border: `1px solid ${alpha(accent, 0.251)}`,
          borderRadius: 4,
          padding: "10px 12px",
          marginBottom: 10,
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ flex: 1, minWidth: 180 }}>
          <div
            style={{
              fontSize: 9,
              fontFamily: vars.font.mono,
              color: vars.text.dim,
              letterSpacing: "0.08em",
            }}
          >
            {pendingOrder ? "WORKING ORDER · OTHER ACTIONS LOCKED" : "ORDER IN FLIGHT · ACTIONS LOCKED"}
          </div>
          {pendingOrder ? (
            <div
              style={{
                fontSize: 11,
                fontFamily: vars.font.mono,
                color: vars.text.strong,
                marginTop: 4,
              }}
            >
              {pendingOrder.side.toUpperCase()} {pendingOrder.qty}× {pendingOrder.symbol}
              {pendingOrder.limit_price ? ` @ $${pendingOrder.limit_price}` : " MKT"}
            </div>
          ) : null}
          <div style={{ fontSize: 10, fontFamily: vars.font.mono, color: accent, marginTop: 2 }}>
            {statusLabel}
            {pendingOrder?.filled_qty && pendingOrder.filled_qty !== "0" && (
              <span style={{ color: vars.text.tertiary }}>
                {" "}
                · filled {pendingOrder.filled_qty}/{pendingOrder.qty}
              </span>
            )}
          </div>
          <div style={{ fontSize: 8, fontFamily: vars.font.mono, color: vars.text.faint, marginTop: 2 }}>
            {pendingOrder ? `id ${pendingOrder.id.slice(0, 8)}…` : "awaiting broker id"}
            {clientOrderId ? ` · client ${clientOrderId.slice(0, 8)}…` : ""}
          </div>
        </div>
        {canCancel && orderPhase !== "filled" && pendingOrder && (
          <button
            type="button"
            disabled={
              busy ||
              orderPhase === "cancel_requested" ||
              orderPhase === "cancel_pending"
            }
            onClick={() => void onCancelOrder()}
            style={{
              cursor: busy ? "default" : "pointer",
              background: "transparent",
              border: `1px solid ${alpha(vars.status.loss, 0.314)}`,
              borderRadius: 3,
              padding: "5px 12px",
              fontSize: 10,
              fontFamily: vars.font.mono,
              fontWeight: 700,
              color: vars.status.loss,
              letterSpacing: "0.04em",
              opacity:
                busy || orderPhase === "cancel_pending" ? 0.5 : 1,
            }}
          >
            {orderPhase === "cancel_requested" || orderPhase === "cancel_pending"
              ? "CANCELING…"
              : "CANCEL ORDER"}
          </button>
        )}
        {(orderPhase === "filled" ||
          orderPhase === "partial_filled" ||
          orderPhase === "rejected" ||
          orderPhase === "error") && (
          <button
            type="button"
            onClick={() => {
              if (reset()) setFlashErr(null);
            }}
            style={{
              cursor: "pointer",
              background: "transparent",
              border: `1px solid ${alpha(vars.status.gain, 0.251)}`,
              borderRadius: 3,
              padding: "5px 12px",
              fontSize: 10,
              fontFamily: vars.font.mono,
              fontWeight: 700,
              color: vars.status.gain,
            }}
          >
            DISMISS
          </button>
        )}
      </div>
    ) : null;

  const flash = (flashMsg || flashErr || orderHookErr) && (
    <div
      style={{
        marginTop: 8,
        marginBottom: 8,
        fontSize: 11,
        fontFamily: vars.font.mono,
        color: flashErr || orderHookErr ? vars.status.loss : vars.status.gain,
      }}
    >
      {flashErr || orderHookErr
        ? `✗ ${flashErr ?? orderHookErr}`
        : `✓ ${flashMsg}`}
    </div>
  );

  const sectionStyle: React.CSSProperties = {
    scrollMarginTop: 24,
    outline: highlight ? `1px solid ${alpha(vars.status.warning, 0.502)}` : "none",
    boxShadow: highlight ? `0 0 0 4px ${alpha(vars.status.warning, 0.094)}` : "none",
    borderRadius: 6,
    transition: "outline 0.3s, box-shadow 0.3s",
  };

  const orderTicket = ticket && (
    <OrderTicket
      action={ticket.action}
      optionType={ticket.optionType}
      contractSymbol={ticket.contractSymbol}
      strike={ticket.strike}
      expiration={ticket.expiration}
      qty={qty}
      onQtyChange={setQty}
      maxQty={maxQty}
      limitPrice={ticket.limitPrice}
      check={check}
      busy={busy}
      onConfirm={() => void submitTicket()}
      onCancel={dismissTicket}
      accent={accent}
      simulate={IS_MOCK}
    />
  );

  // ─── Active option: OptionCard + CLOSE / ROLL ───
  if (activeOption) {
    // For roll we still need Friday ladder data
    const rollEnabled = !locked && !!data?.rows.length;

    return (
      <div ref={sectionRef} id={`open-options-${symbol}`} style={sectionStyle}>
        <CardLabel>OPEN OPTIONS</CardLabel>
        <OptionCard opt={activeOption} phase={phase} />
        {multiOpenBanner}
        {workingBanner}
        {flash}
        {ticket && (
          <div style={{ marginTop: 10 }}>
            {orderTicket}
            {ticket.rollAfter && (
              <div
                style={{
                  fontSize: 9,
                  fontFamily: vars.font.mono,
                  color: vars.text.subtle,
                  marginBottom: 8,
                }}
              >
                ROLL: after close confirms filled, will open{" "}
                {ticket.rollAfter.contractSymbol} sell ticket
              </div>
            )}
          </div>
        )}
        {!ticket && !locked && (
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={() => void openCloseTicket()}
              style={actionBtn(vars.status.info)}
            >
              CLOSE
            </button>
            <button
              type="button"
              disabled={!rollEnabled}
              onClick={() => {
                if (!data) void refresh();
                void openRollTicket();
              }}
              title={
                rollEnabled
                  ? "Buy-to-close then sell next Friday"
                  : "Loading Friday strikes…"
              }
              style={{
                ...actionBtn(vars.status.gain),
                opacity: rollEnabled ? 1 : 0.4,
                cursor: rollEnabled ? "pointer" : "default",
              }}
            >
              ROLL
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── No active option: Friday ladder ───
  const title =
    side === "call"
      ? `NO COVERED CALL · NEXT FRIDAY CALLS`
      : `NO OPEN OPTIONS · NEXT FRIDAY PUTS`;

  return (
    <div ref={sectionRef} id={`open-options-${symbol}`} style={sectionStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <CardLabel marginBottom={0}>{title}</CardLabel>
        <button
          type="button"
          onClick={() => refresh()}
          disabled={loading || locked}
          style={{
            cursor: loading || locked ? "default" : "pointer",
            background: "transparent",
            border: `1px solid ${vars.border.strong}`,
            borderRadius: 3,
            padding: "2px 8px",
            fontSize: 10,
            fontFamily: vars.font.mono,
            color: loading || locked ? vars.text.faint : vars.text.tertiary,
          }}
        >
          ↻
        </button>
      </div>

      {shares > 0 && shares < 100 && (
        <div
          style={{
            fontSize: 9,
            fontFamily: vars.font.mono,
            color: vars.text.subtle,
            marginBottom: 8,
          }}
        >
          Holding {shares} shares — need 100 to sell a covered call. Showing cash-secured puts.
        </div>
      )}

      {multiOpenBanner}
      {workingBanner}
      {flash}

      {orderTicket}

      {loading && !data && (
        <EmptyState>
          <div style={{ fontSize: 18, marginBottom: 6 }}>◌</div>
          LOADING FRIDAY {side.toUpperCase()}S...
        </EmptyState>
      )}

      {error && <Banner tone="error">✗ {error}</Banner>}

      {data && (
        <>
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              fontSize: 10,
              fontFamily: vars.font.mono,
              color: vars.text.subtle,
              marginBottom: 10,
            }}
          >
            <span>
              EXP{" "}
              <select
                value={pickerExpiration}
                disabled={loading || locked || expirations.length === 0}
                onChange={(e) => {
                  setSelectedExpiration(e.target.value);
                  setTicket(null);
                }}
                style={{
                  background: vars.bg.raised,
                  border: `1px solid ${alpha(accent, 0.314)}`,
                  borderRadius: 3,
                  color: accent,
                  fontFamily: vars.font.mono,
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 4px",
                  cursor: loading || locked ? "default" : "pointer",
                }}
              >
                {(expirations.length > 0 ? expirations : [pickerExpiration]).map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                    {exp === defaultExpiration ? " (Fri)" : ""}
                  </option>
                ))}
              </select>
            </span>
            <span>
              DTE <b style={{ color: vars.text.strong }}>{dteUntil(pickerExpiration)}</b>
            </span>
            <span>
              SPOT <b style={{ color: vars.text.strong }}>{fmt.currency(data.spot)}</b>
            </span>
            <span>
              SIDE{" "}
              <b style={{ color: accent }}>SELL {side.toUpperCase()}</b>
            </span>
          </div>

          <div style={gridHeader}>
            <span>HIT</span>
            <span style={{ textAlign: "right" }}>STRIKE</span>
            <span style={{ textAlign: "right" }}>% OTM</span>
            <span style={{ textAlign: "right" }}>ASSIGN</span>
            <span style={{ textAlign: "right" }}>BID / ASK</span>
            <span style={{ textAlign: "right" }}>LIMIT</span>
            <span />
          </div>

          {data.rows.map((row) => {
            const isWorkingRow =
              pendingOrder != null && pendingOrder.symbol === row.contractSymbol;
            const sellDisabled = locked || !!ticket || loading;
            const selected = ticket?.level === row.level && ticket.action === "sell_to_open";

            return (
              <div key={row.level}>
                <div style={{ ...gridRow, opacity: sellDisabled && !isWorkingRow ? 0.4 : 1 }}>
                  <span style={{ color: LEVEL_COLOR[row.level], fontWeight: 700 }}>
                    {row.label}
                  </span>
                  <span style={{ textAlign: "right", color: vars.text.strong, fontWeight: 700 }}>
                    {fmt.currency(row.strike)}
                  </span>
                  <span
                    style={{
                      textAlign: "right",
                      color:
                        side === "put"
                          ? row.pctFromSpot <= 0
                            ? vars.status.gain
                            : vars.status.loss
                          : row.pctFromSpot >= 0
                            ? vars.status.gain
                            : vars.status.loss,
                    }}
                  >
                    {(row.pctFromSpot * 100).toFixed(1)}%
                  </span>
                  <span style={{ textAlign: "right", color: vars.text.secondary }}>
                    {(row.empiricalAssignmentProb * 100).toFixed(0)}% /{" "}
                    {(row.blackScholesAssignmentProb * 100).toFixed(0)}%
                  </span>
                  <span style={{ textAlign: "right", color: vars.text.secondary }}>
                    {row.bid != null ? fmt.currency(row.bid) : "—"} /{" "}
                    {row.ask != null ? fmt.currency(row.ask) : "—"}
                  </span>
                  <span style={{ textAlign: "right", color: vars.text.strong }}>
                    {fmt.currency(row.sellLimit)}
                  </span>
                  <span style={{ textAlign: "right" }}>
                    {isWorkingRow ? (
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: vars.font.mono,
                          fontWeight: 700,
                          color: accent,
                          letterSpacing: "0.04em",
                        }}
                      >
                        WORKING
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={sellDisabled}
                        onClick={() =>
                          selected ? dismissTicket() : openSellTicket(row)
                        }
                        style={{
                          cursor: sellDisabled ? "default" : "pointer",
                          background: selected ? vars.border.default : alpha(accent, 0.094),
                          border: `1px solid ${alpha(accent, 0.314)}`,
                          borderRadius: 3,
                          padding: "3px 8px",
                          fontSize: 10,
                          fontFamily: vars.font.mono,
                          fontWeight: 700,
                          color: sellDisabled ? vars.text.faint : accent,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {selected ? "CANCEL" : "SELL"}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            );
          })}

          {data.rows.length === 0 && (
            <EmptyState>NO FRIDAY {side.toUpperCase()} CONTRACTS FOUND</EmptyState>
          )}

          {data.warnings.length > 0 && (
            <div
              style={{
                marginTop: 8,
                fontSize: 8,
                fontFamily: vars.font.mono,
                color: vars.text.faint,
                lineHeight: 1.6,
              }}
            >
              {data.warnings.map((w, i) => (
                <div key={i}>· {w}</div>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 6,
              fontSize: 8,
              fontFamily: vars.font.mono,
              color: vars.text.faint,
            }}
          >
            Desk flow: ticket ack → submit (client_order_id) → venue accept → cancel until filled
          </div>
        </>
      )}
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    cursor: "pointer",
    background: alpha(color, 0.094),
    border: `1px solid ${alpha(color, 0.314)}`,
    borderRadius: 3,
    padding: "5px 12px",
    fontSize: 10,
    fontFamily: vars.font.mono,
    fontWeight: 700,
    color,
    letterSpacing: "0.06em",
  };
}

const gridHeader: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.55fr 0.9fr 0.7fr 0.9fr 1.1fr 0.7fr 0.7fr",
  gap: 6,
  padding: "6px 4px",
  fontSize: 8,
  fontFamily: vars.font.mono,
  color: vars.text.faint,
  letterSpacing: "0.06em",
  borderBottom: `1px solid ${vars.border.subtle}`,
};

const gridRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "0.55fr 0.9fr 0.7fr 0.9fr 1.1fr 0.7fr 0.7fr",
  gap: 6,
  padding: "8px 4px",
  fontSize: 11,
  fontFamily: vars.font.mono,
  color: vars.text.primary,
  borderBottom: `1px solid ${vars.bg.raised}`,
  alignItems: "center",
};
