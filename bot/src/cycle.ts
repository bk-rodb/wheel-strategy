import { config } from "./config.js";
import { toDateString } from "./calendar.js";
import { fetchRegularLadder } from "./fridayLadder.js";
import {
  cycleClientOrderId,
  getOrderByClientId,
  listOpenOptionOrdersForUnderlying,
  placeSellToOpen,
  pollUntilDone,
  isOrderFilled,
} from "./orders.js";
import { getAccount, getEquityShares, sideAndQty } from "./positions.js";
import { preTradeCheck } from "./preTrade.js";
import {
  alreadyCompletedForFriday,
  appendRun,
  writeLastCycle,
  type RunRecord,
} from "./state.js";

export interface CycleResult {
  record: RunRecord;
}

/**
 * One weekly sell-to-open cycle for the configured symbol / target Friday.
 */
export async function runSellToOpenCycle(opts: {
  targetFriday: string;
  signal?: AbortSignal;
}): Promise<CycleResult> {
  const symbol = config.symbol;
  const at = new Date().toISOString();
  const runDate = toDateString(new Date());

  const base: Pick<RunRecord, "at" | "symbol" | "targetFriday" | "dryRun"> = {
    at,
    symbol,
    targetFriday: opts.targetFriday,
    dryRun: config.dryRun,
  };

  if (alreadyCompletedForFriday(opts.targetFriday)) {
    const record: RunRecord = {
      ...base,
      side: "?",
      qty: 0,
      status: "skipped",
      reason: `Already completed a cycle for ${opts.targetFriday}`,
    };
    appendRun(record);
    console.log(`[cycle] ${record.reason}`);
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
    appendRun(record);
    console.log(`[cycle] ${record.reason}`);
    return { record };
  }

  const shares = await getEquityShares(symbol, opts.signal);
  const { side, qty } = sideAndQty(shares);
  console.log(`[cycle] ${symbol} shares=${shares} → ${side} x${qty}`);

  const ladder = await fetchRegularLadder({
    symbol,
    side,
    qty,
    expiration: opts.targetFriday,
    level: config.level,
    signal: opts.signal,
  });

  for (const w of ladder.warnings) console.warn(`[cycle] warn: ${w}`);

  const account = await getAccount(opts.signal);
  const check = preTradeCheck({
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

  for (const w of check.warnings) console.warn(`[cycle] pretrade: ${w}`);

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
    appendRun(record);
    console.error(`[cycle] Blocked:`, check.blockers.join("; "));
    return { record };
  }

  const clientOrderId = cycleClientOrderId(symbol, opts.targetFriday, side, runDate);

  const ticket = {
    contractSymbol: ladder.row.contractSymbol,
    strike: ladder.row.strike,
    sellLimit: ladder.row.sellLimit,
    qty: ladder.qty,
    side,
    expiration: opts.targetFriday,
    level: config.level,
    empiricalAssign: ladder.row.empiricalAssignmentProb,
    bsAssign: ladder.row.blackScholesAssignmentProb,
    bid: ladder.row.bid,
    ask: ladder.row.ask,
    mid: ladder.row.mid,
    clientOrderId,
  };

  console.log(`[cycle] Ticket:`, JSON.stringify(ticket, null, 2));

  if (config.dryRun) {
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
    appendRun(record);
    writeLastCycle({
      targetFriday: opts.targetFriday,
      clientOrderId,
      at,
      status: "dry_run",
    });
    console.log(`[cycle] Dry-run complete (no order placed).`);
    return { record };
  }

  // Live paper place — reconcile by client_order_id if POST races
  let order = await getOrderByClientId(clientOrderId, opts.signal);
  if (!order) {
    try {
      order = await placeSellToOpen({
        contractSymbol: ladder.row.contractSymbol,
        qty: ladder.qty,
        limitPrice: ladder.row.sellLimit,
        clientOrderId,
        signal: opts.signal,
      });
    } catch (e) {
      order = await getOrderByClientId(clientOrderId, opts.signal);
      if (!order) throw e;
      console.warn(`[cycle] Place failed but order found by client_order_id — reconciling`);
    }
  } else {
    console.log(`[cycle] Reusing existing order ${order.id} for ${clientOrderId}`);
  }

  console.log(`[cycle] Placed order ${order.id} status=${order.status}`);

  const final = await pollUntilDone({
    orderId: order.id,
    pollMs: config.pollMs,
    signal: opts.signal,
    onTick: (o) => console.log(`[cycle] poll ${o.id} status=${o.status} filled=${o.filled_qty ?? 0}`),
  });

  const status: RunRecord["status"] = isOrderFilled(final)
    ? "filled"
    : final.status === "canceled" || final.status === "expired" || final.status === "rejected"
      ? "canceled"
      : "placed";

  const record: RunRecord = {
    ...base,
    side,
    qty: ladder.qty,
    status,
    reason: `Final status=${final.status}`,
    contractSymbol: ladder.row.contractSymbol,
    strike: ladder.row.strike,
    sellLimit: ladder.row.sellLimit,
    orderId: final.id,
    clientOrderId,
    warnings: [...ladder.warnings, ...check.warnings],
  };
  appendRun(record);
  writeLastCycle({
    targetFriday: opts.targetFriday,
    clientOrderId,
    at: new Date().toISOString(),
    status,
  });
  console.log(`[cycle] Done: ${status} (${final.status})`);
  return { record };
}
