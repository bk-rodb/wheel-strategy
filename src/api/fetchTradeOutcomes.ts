import { API_BASE, IS_MOCK } from "../config";
import { DEFAULT_TIMEOUT_MS } from "./alpacaClient";

export interface DecisionSnapshot {
  underlying: string;
  optionRight: string;
  wheelSide: string;
  level?: string | null;
  modelStrike?: number | null;
  snappedStrike?: number | null;
  targetDelta?: number | null;
  hmmRegime?: string | null;
  spotAtSubmit?: number | null;
  suggestedLimit?: number | null;
  midAtSubmit?: number | null;
  bidAtSubmit?: number | null;
  dte?: number | null;
  granularity?: string | null;
  earningsInWindow?: boolean | null;
  empiricalAssignmentProb?: number | null;
  estPremium?: number | null;
  contractSymbol?: string | null;
}

export interface TradeOutcome {
  clientOrderId: string;
  alpacaOrderId: string | null;
  wheelCycleId: string | null;
  underlying: string;
  symbol: string;
  side: string;
  optionRight: string;
  wheelSide: string;
  qty: string;
  filledQty: string;
  limitPrice: string | null;
  filledAvgPrice: string | null;
  premiumCash: number | null;
  fees: number | null;
  realizedPnL: number | null;
  outcomeLabel: string;
  source: string;
  snapshot: DecisionSnapshot | null;
  level: string | null;
  hmmRegime: string | null;
  cohortKey: string | null;
  isAnomaly: boolean;
  anomalyReason: string | null;
  createdAt: string;
  updatedAt: string;
  filledAt: string | null;
  resolvedAt: string | null;
}

export interface CohortStat {
  cohortKey: string;
  sampleSize: number;
  assignmentRate: number;
  avgPremiumCash: number | null;
  avgEstPremium: number | null;
  premiumCaptureRatio: number | null;
  modelAssignmentProbAvg: number | null;
  recurringConditions: string[];
}

export interface AnomalyItem {
  clientOrderId: string;
  underlying: string;
  outcomeLabel: string;
  reason: string | null;
  cohortKey: string | null;
  realizedPnL: number | null;
  resolvedAt: string | null;
}

export interface WheelCycleSummary {
  wheelCycleId: string;
  underlying: string;
  legCount: number;
  totalPremiumCash: number | null;
  totalRealizedPnL: number | null;
  clientOrderIds: string[];
}

export interface RetrospectiveSummary {
  totalOutcomes: number;
  resolvedCount: number;
  learningSampleSize: number;
  overallAssignmentRate: number;
  totalPremiumCash: number | null;
  totalRealizedPnL: number | null;
  cohorts: CohortStat[];
  anomalies: AnomalyItem[];
  cycles: WheelCycleSummary[];
}

function requestSignal(signal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([signal, timeout]);
  return signal;
}

const mockOutcomes: TradeOutcome[] = [];

/** @internal */
export const __mockTradeOutcomes = {
  clear() {
    mockOutcomes.length = 0;
  },
  push(row: TradeOutcome) {
    mockOutcomes.push(row);
  },
};

export async function attachDecisionSnapshot(
  clientOrderId: string,
  snapshot: DecisionSnapshot,
  source: "desk" | "bot" = "desk",
  signal?: AbortSignal,
): Promise<TradeOutcome | null> {
  if (IS_MOCK) {
    const row: TradeOutcome = {
      clientOrderId,
      alpacaOrderId: null,
      wheelCycleId: null,
      underlying: snapshot.underlying.toUpperCase(),
      symbol: snapshot.contractSymbol ?? "",
      side: "sell",
      optionRight: snapshot.optionRight,
      wheelSide: snapshot.wheelSide,
      qty: "1",
      filledQty: "0",
      limitPrice: snapshot.suggestedLimit != null ? String(snapshot.suggestedLimit) : null,
      filledAvgPrice: null,
      premiumCash: null,
      fees: null,
      realizedPnL: null,
      outcomeLabel: "pending",
      source,
      snapshot,
      level: snapshot.level ?? null,
      hmmRegime: snapshot.hmmRegime ?? null,
      cohortKey: null,
      isAnomaly: false,
      anomalyReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      filledAt: null,
      resolvedAt: null,
    };
    const idx = mockOutcomes.findIndex((o) => o.clientOrderId === clientOrderId);
    if (idx >= 0) mockOutcomes[idx] = row;
    else mockOutcomes.push(row);
    return row;
  }

  const url = `${API_BASE}/api/trades/outcomes/${encodeURIComponent(clientOrderId)}/snapshot`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot, source }),
    signal: requestSignal(signal),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trade outcome snapshot → ${res.status}: ${text}`);
  }
  return (await res.json()) as TradeOutcome;
}

export async function fetchTradeOutcomes(opts: {
  underlying?: string;
  outcomeLabel?: string;
  resolvedOnly?: boolean;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TradeOutcome[]> {
  if (IS_MOCK) {
    let rows = [...mockOutcomes];
    if (opts.underlying) {
      const u = opts.underlying.toUpperCase();
      rows = rows.filter((r) => r.underlying === u);
    }
    if (opts.resolvedOnly) {
      rows = rows.filter((r) =>
        ["expired_otm", "assigned", "bought_to_close", "canceled_before_fill"].includes(
          r.outcomeLabel,
        ),
      );
    }
    return rows.slice(0, opts.limit ?? 100);
  }

  const url = new URL(`${API_BASE}/api/trades/outcomes`);
  if (opts.underlying) url.searchParams.set("underlying", opts.underlying);
  if (opts.outcomeLabel) url.searchParams.set("outcomeLabel", opts.outcomeLabel);
  if (opts.resolvedOnly != null) url.searchParams.set("resolvedOnly", String(opts.resolvedOnly));
  if (opts.limit != null) url.searchParams.set("limit", String(opts.limit));

  const res = await fetch(url.toString(), { signal: requestSignal(opts.signal) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trade outcomes → ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { items: TradeOutcome[] };
  return body.items ?? [];
}

export async function fetchRetrospective(opts?: {
  underlying?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<RetrospectiveSummary> {
  if (IS_MOCK) {
    const rows = await fetchTradeOutcomes({
      underlying: opts?.underlying,
      limit: opts?.limit ?? 500,
    });
    const learning = rows.filter((r) =>
      ["expired_otm", "assigned", "bought_to_close"].includes(r.outcomeLabel),
    );
    const assigned = learning.filter((r) => r.outcomeLabel === "assigned").length;
    return {
      totalOutcomes: rows.length,
      resolvedCount: rows.filter((r) =>
        ["expired_otm", "assigned", "bought_to_close", "canceled_before_fill"].includes(
          r.outcomeLabel,
        ),
      ).length,
      learningSampleSize: learning.length,
      overallAssignmentRate: learning.length ? assigned / learning.length : 0,
      totalPremiumCash: rows.reduce((s, r) => s + (r.premiumCash ?? 0), 0),
      totalRealizedPnL: rows.reduce((s, r) => s + (r.realizedPnL ?? 0), 0),
      cohorts: [],
      anomalies: rows
        .filter((r) => r.isAnomaly)
        .map((r) => ({
          clientOrderId: r.clientOrderId,
          underlying: r.underlying,
          outcomeLabel: r.outcomeLabel,
          reason: r.anomalyReason,
          cohortKey: r.cohortKey,
          realizedPnL: r.realizedPnL,
          resolvedAt: r.resolvedAt,
        })),
      cycles: [],
    };
  }

  const url = new URL(`${API_BASE}/api/trades/retrospective`);
  if (opts?.underlying) url.searchParams.set("underlying", opts.underlying);
  if (opts?.limit != null) url.searchParams.set("limit", String(opts.limit));
  const res = await fetch(url.toString(), { signal: requestSignal(opts?.signal) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trade retrospective → ${res.status}: ${text}`);
  }
  return (await res.json()) as RetrospectiveSummary;
}

export function tradeOutcomesCsvUrl(underlying?: string): string {
  const url = new URL(`${API_BASE}/api/trades/outcomes.csv`);
  if (underlying) url.searchParams.set("underlying", underlying);
  return url.toString();
}
