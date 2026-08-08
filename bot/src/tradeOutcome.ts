import { config } from "./config.js";

export interface BotDecisionSnapshot {
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

/** Attach immutable decision snapshot before place (F-001). */
export async function attachBotDecisionSnapshot(
  clientOrderId: string,
  snapshot: BotDecisionSnapshot,
  signal?: AbortSignal,
): Promise<void> {
  const url = `${config.apiBase}/api/trades/outcomes/${encodeURIComponent(clientOrderId)}/snapshot`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snapshot, source: "bot" }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[tradeOutcome] snapshot attach failed ${res.status}: ${text}`);
  }
}
