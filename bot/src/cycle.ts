import { config, type AnalysisLevel } from "./config.js";
import { persistLastCycle, persistRun } from "./botApi.js";
import { sleep, toDateString } from "./calendar.js";
import { fetchRegularLadder, type FridayLadder } from "./fridayLadder.js";
import {
  cancelOrder,
  cycleClientOrderId,
  getOrder,
  getOrderByClientId,
  listOpenOptionOrdersForUnderlying,
  placeSellToOpen,
  pollUntilDone,
  isOrderFilled,
  type AlpacaOrder,
} from "./orders.js";
import { listOpenJournalForUnderlying, waitForJournalClear } from "./orderJournal.js";
import { decideReprice } from "./reprice.js";
import { attachBotDecisionSnapshot } from "./tradeOutcome.js";
import { getAccount, getEquityShares, sideAndQty, type OptionSide } from "./positions.js";
import { preTradeCheck } from "./preTrade.js";
import {
  alreadyCompletedForFriday,
  getNextRetryIndex,
  type LastCycle,
  type RunRecord,
} from "./state.js";

export interface CycleResult {
  record: RunRecord;
}

/** Places (or reconciles an already-placed) sell-to-open order for one clientOrderId. */
async function placeAndReconcile(opts: {
  clientOrderId: string;
  symbol: string;
  side: OptionSide;
  level: AnalysisLevel;
  ladder: FridayLadder;
  signal?: AbortSignal;
}): Promise<AlpacaOrder> {
  const tag = `[cycle:${opts.symbol}]`;
  let order = await getOrderByClientId(opts.clientOrderId, opts.signal);
  if (!order) {
    try {
      await attachBotDecisionSnapshot(
        opts.clientOrderId,
        {
          underlying: opts.symbol.toUpperCase(),
          optionRight: opts.side === "call" ? "call" : "put",
          wheelSide: opts.side === "call" ? "cc" : "csp",
          level: opts.level,
          modelStrike: opts.ladder.row.strike,
          snappedStrike: opts.ladder.row.strike,
          targetDelta: null,
          hmmRegime: opts.ladder.hmmRegime ?? null,
          spotAtSubmit: opts.ladder.spot ?? null,
          suggestedLimit: opts.ladder.row.sellLimit,
          midAtSubmit: opts.ladder.row.mid,
          bidAtSubmit: opts.ladder.row.bid,
          dte: opts.ladder.dte ?? null,
          granularity: "weekly",
          earningsInWindow: null,
          empiricalAssignmentProb: opts.ladder.row.empiricalAssignmentProb,
          estPremium: opts.ladder.row.estPremium ?? null,
          contractSymbol: opts.ladder.row.contractSymbol,
        },
        opts.signal,
      );
      order = await placeSellToOpen({
        contractSymbol: opts.ladder.row.contractSymbol,
        qty: opts.ladder.qty,
        limitPrice: opts.ladder.row.sellLimit,
        clientOrderId: opts.clientOrderId,
        signal: opts.signal,
      });
    } catch (e) {
      order = await getOrderByClientId(opts.clientOrderId, opts.signal);
      if (!order) throw e;
      console.warn(`${tag} Place failed but order found by client_order_id — reconciling`);
    }
  } else {
    console.log(`${tag} Reusing existing order ${order.id} for ${opts.clientOrderId}`);
  }
  console.log(`${tag} Placed order ${order.id} status=${order.status}`);
  return order;
}

function finalRunStatus(final: AlpacaOrder): RunRecord["status"] {
  if (isOrderFilled(final)) return "filled";
  if (final.status === "canceled" || final.status === "expired" || final.status === "rejected") return "canceled";
  return "placed";
}

/**
 * One weekly sell-to-open cycle for the configured symbol / target Friday.
 */
export async function runSellToOpenCycle(opts: {
  symbol: string;
  targetFriday: string;
  level?: AnalysisLevel;
  dryRun?: boolean;
  lastCycle?: LastCycle | null;
  signal?: AbortSignal;
}): Promise<CycleResult> {
  const symbol = opts.symbol;
  const tag = `[cycle:${symbol}]`;
  const level = opts.level ?? config.level;
  const dryRun = opts.dryRun ?? config.dryRun;
  const at = new Date().toISOString();
  const runDate = toDateString(new Date());

  const base: Pick<RunRecord, "at" | "symbol" | "targetFriday" | "dryRun"> = {
    at,
    symbol,
    targetFriday: opts.targetFriday,
    dryRun,
  };

  if (alreadyCompletedForFriday(symbol, opts.targetFriday, opts.lastCycle)) {
    const record: RunRecord = {
      ...base,
      side: "?",
      qty: 0,
      status: "skipped",
      reason: `Already completed a cycle for ${opts.targetFriday}`,
    };
    await persistRun(record, opts.signal);
    console.log(`${tag} ${record.reason}`);
    return { record };
  }

  const openOrders = await listOpenOptionOrdersForUnderlying(symbol, opts.signal);
  if (openOrders.length > 0) {
    const record: RunRecord = {
      ...base,
      side: "?",
      qty: 0,
      status: "skipped",
      reason: `Open option order(s) already exist for ${symbol}: ${openOrders.map((o) => o.id).join(", ")}`,
      orderId: openOrders[0]?.id,
    };
    await persistRun(record, opts.signal);
    console.log(`${tag} ${record.reason}`);
    return { record };
  }

  try {
    const journalOpen = await listOpenJournalForUnderlying(symbol, opts.signal);
    if (journalOpen.length > 0) {
      const j = journalOpen[0]!;
      const record: RunRecord = {
        ...base,
        side: "?",
        qty: 0,
        status: "skipped",
        reason: `Open journal intent for ${symbol}: client_order_id=${j.clientOrderId} deskState=${j.deskState}`,
        orderId: j.alpacaOrderId ?? undefined,
      };
      await persistRun(record, opts.signal);
      console.log(`${tag} ${record.reason}`);
      return { record };
    }
  } catch (e) {
    console.warn(`${tag} Journal check failed (continuing with Alpaca open-order gate):`, e);
  }

  const shares = await getEquityShares(symbol, opts.signal);
  const { side, qty } = sideAndQty(shares);
  console.log(`${tag} shares=${shares} → ${side} x${qty}`);

  let ladder = await fetchRegularLadder({
    symbol,
    side,
    qty,
    expiration: opts.targetFriday,
    level,
    signal: opts.signal,
  });

  for (const w of ladder.warnings) console.warn(`${tag} warn: ${w}`);

  let account = await getAccount(opts.signal);
  let check = preTradeCheck({
    optionType: side,
    contractSymbol: ladder.row.contractSymbol,
    strike: ladder.row.strike,
    expiration: ladder.expiration,
    qty: ladder.qty,
    limitPrice: ladder.row.sellLimit,
    bid: ladder.row.bid,
    ask: ladder.row.ask,
    mid: ladder.row.mid,
    shares,
    account,
    tradable: ladder.row.tradable,
    contractMultiplier: ladder.row.multiplier,
  });

  for (const w of check.warnings) console.warn(`${tag} pretrade: ${w}`);

  if (!check.ok) {
    const record: RunRecord = {
      ...base,
      side,
      qty: ladder.qty,
      status: "blocked",
      reason: "Pre-trade blockers",
      blockers: check.blockers,
      warnings: [...ladder.warnings, ...check.warnings],
      contractSymbol: ladder.row.contractSymbol,
      strike: ladder.row.strike,
      sellLimit: ladder.row.sellLimit,
    };
    await persistRun(record, opts.signal);
    console.error(`${tag} Blocked:`, check.blockers.join("; "));
    return { record };
  }

  const retryIndex = getNextRetryIndex(symbol, opts.targetFriday, opts.lastCycle);
  const clientOrderId = cycleClientOrderId(symbol, opts.targetFriday, side, runDate, retryIndex);

  const ticket = {
    contractSymbol: ladder.row.contractSymbol,
    strike: ladder.row.strike,
    sellLimit: ladder.row.sellLimit,
    qty: ladder.qty,
    side,
    expiration: opts.targetFriday,
    level,
    empiricalAssign: ladder.row.empiricalAssignmentProb,
    bsAssign: ladder.row.blackScholesAssignmentProb,
    bid: ladder.row.bid,
    ask: ladder.row.ask,
    mid: ladder.row.mid,
    clientOrderId,
  };

  console.log(`${tag} Ticket:`, JSON.stringify(ticket, null, 2));

  if (dryRun) {
    const record: RunRecord = {
      ...base,
      side,
      qty: ladder.qty,
      status: "dry_run",
      reason: "BOT_DRY_RUN=true — order not submitted",
      contractSymbol: ladder.row.contractSymbol,
      strike: ladder.row.strike,
      sellLimit: ladder.row.sellLimit,
      clientOrderId,
      warnings: [...ladder.warnings, ...check.warnings],
    };
    await persistRun(record, opts.signal);
    await persistLastCycle(symbol, {
      targetFriday: opts.targetFriday,
      clientOrderId,
      at,
      status: "dry_run",
      retryIndex,
    }, opts.signal);
    console.log(`${tag} Dry-run complete (no order placed).`);
    return { record };
  }

  // Live paper place — reconcile by client_order_id if POST races.
  async function finalize(
    status: RunRecord["status"],
    reason: string,
    finalOrder: AlpacaOrder | undefined,
    activeClientOrderId: string,
    persistCycle: boolean,
  ): Promise<CycleResult> {
    const record: RunRecord = {
      ...base,
      side,
      qty: ladder.qty,
      status,
      reason,
      contractSymbol: ladder.row.contractSymbol,
      strike: ladder.row.strike,
      sellLimit: ladder.row.sellLimit,
      orderId: finalOrder?.id,
      clientOrderId: activeClientOrderId,
      blockers: status === "blocked" ? check.blockers : undefined,
      warnings: [...ladder.warnings, ...check.warnings],
    };
    await persistRun(record, opts.signal);
    if (persistCycle) {
      await persistLastCycle(symbol, {
        targetFriday: opts.targetFriday,
        clientOrderId: activeClientOrderId,
        at: new Date().toISOString(),
        status,
        retryIndex,
      }, opts.signal);
    }
    return { record };
  }

  let activeClientOrderId = clientOrderId;
  let order = await placeAndReconcile({ clientOrderId: activeClientOrderId, symbol, side, level, ladder, signal: opts.signal });

  let attempt = 1;
  for (;;) {
    const deadlineMs = config.repriceEnabled ? Date.now() + config.repriceTimeoutMs : undefined;
    const final = await pollUntilDone({
      orderId: order.id,
      pollMs: config.pollMs,
      deadlineMs,
      signal: opts.signal,
      onTick: (o) =>
        console.log(
          `[${new Date().toISOString()}] ${tag} poll ${o.id} status=${o.status} filled=${o.filled_qty ?? 0}`,
        ),
    });

    const decision = decideReprice({
      final,
      repriceEnabled: config.repriceEnabled,
      attempt,
      maxAttempts: config.repriceMaxAttempts,
    });

    if (decision.action === "done") {
      const status = finalRunStatus(final);
      console.log(`${tag} Done: ${status} (${final.status})`);
      return finalize(status, `Final status=${final.status}`, final, activeClientOrderId, true);
    }

    console.log(
      `[${new Date().toISOString()}] ${tag} Reprice: order ${final.id} unfilled after ${config.repriceTimeoutMs}ms (attempt ${attempt}/${config.repriceMaxAttempts})`,
    );
    try {
      await cancelOrder(final.id, opts.signal);
    } catch (e) {
      console.warn(`${tag} Reprice cancel failed:`, e);
    }

    if (decision.action === "giveUp") {
      console.log(`[${new Date().toISOString()}] ${tag} Reprice: max attempts reached — giving up`);
      return finalize(
        "canceled",
        `Unfilled after ${attempt} reprice attempt(s) — gave up`,
        final,
        activeClientOrderId,
        true,
      );
    }

    // A DELETE alone leaves the desk journal stuck at cancel_pending forever — nothing
    // reconciles it in the background. The backend only reconciles a journal row as a side
    // effect of a follow-up single-order GET (see AlpacaProxyEndpoints.cs), which the proxy's
    // per-underlying open-order gate then requires before it'll accept a resubmit. Force that
    // GET, then confirm the underlying's journal is actually clear before resubmitting.
    await sleep(2_000, opts.signal);
    try {
      const reconciled = await getOrder(final.id, opts.signal);
      console.log(
        `[${new Date().toISOString()}] ${tag} Reprice: post-cancel reconcile — status=${reconciled.status}`,
      );
    } catch (e) {
      console.warn(`${tag} Reprice: post-cancel reconcile GET failed:`, e);
    }

    const journalClear = await waitForJournalClear(symbol, { timeoutMs: 8_000, pollMs: 1_000, signal: opts.signal });
    if (!journalClear) {
      console.warn(
        `[${new Date().toISOString()}] ${tag} Reprice: desk journal still open for ${symbol} after reconcile — giving up`,
      );
      return finalize(
        "canceled",
        "Desk journal still open for this underlying after reconcile — gave up",
        final,
        activeClientOrderId,
        true,
      );
    }

    // Recompute the ladder from scratch — the price/vol that picked the original strike may
    // have moved enough that it's no longer the right one.
    ladder = await fetchRegularLadder({
      symbol,
      side,
      qty,
      expiration: opts.targetFriday,
      level,
      signal: opts.signal,
    });
    account = await getAccount(opts.signal);
    check = preTradeCheck({
      optionType: side,
      contractSymbol: ladder.row.contractSymbol,
      strike: ladder.row.strike,
      expiration: ladder.expiration,
      qty: ladder.qty,
      limitPrice: ladder.row.sellLimit,
      bid: ladder.row.bid,
      ask: ladder.row.ask,
      mid: ladder.row.mid,
      shares,
      account,
      tradable: ladder.row.tradable,
      contractMultiplier: ladder.row.multiplier,
    });

    if (!check.ok) {
      console.log(`[${new Date().toISOString()}] ${tag} Reprice: recomputed ladder now blocked — stopping`);
      console.error(`${tag} Blocked:`, check.blockers.join("; "));
      return finalize("blocked", "Pre-trade blockers (during reprice)", final, activeClientOrderId, false);
    }

    attempt += 1;
    activeClientOrderId = cycleClientOrderId(symbol, opts.targetFriday, side, runDate, retryIndex + attempt - 1);
    order = await placeAndReconcile({ clientOrderId: activeClientOrderId, symbol, side, level, ladder, signal: opts.signal });
    console.log(
      `[${new Date().toISOString()}] ${tag} Reprice: resubmitted ${order.id} at strike=${ladder.row.strike} limit=${ladder.row.sellLimit}`,
    );
  }
}
