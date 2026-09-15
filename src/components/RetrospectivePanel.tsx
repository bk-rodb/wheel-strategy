import { useEffect, useState } from "react";
import { IS_MOCK } from "../config";
import {
  fetchRetrospective,
  tradeOutcomesCsvUrl,
  type RetrospectiveSummary,
} from "../api/fetchTradeOutcomes";
import { fmt } from "../utils/formatters";
import { vars } from "../theme";

export function RetrospectivePanel() {
  const [summary, setSummary] = useState<RetrospectiveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    fetchRetrospective({ limit: 200, signal: ctrl.signal })
      .then((s) => {
        setSummary(s);
        setError(null);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load retrospective");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, []);

  return (
    <div
      style={{
        background: vars.bg.card,
        border: `1px solid ${vars.border.default}`,
        borderRadius: 6,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: `1px solid ${vars.border.subtle}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.08em",
              color: vars.text.muted,
              fontFamily: vars.font.mono,
              marginBottom: 4,
            }}
          >
            RETROSPECTIVE · EXPERIENCE LEDGER
          </div>
          <div style={{ fontSize: 13, color: vars.text.primary }}>
            Closed-leg outcomes, cohorts, and anomalies feeding the Experience head
          </div>
        </div>
        {!IS_MOCK && (
          <a
            href={tradeOutcomesCsvUrl()}
            style={{ fontSize: 11, color: vars.status.info, fontFamily: vars.font.mono }}
          >
            CSV EXPORT
          </a>
        )}
      </div>

      <div style={{ padding: 14 }}>
        {loading && (
          <div style={{ color: vars.text.muted, fontSize: 12, fontFamily: vars.font.mono }}>
            Loading outcomes…
          </div>
        )}
        {error && (
          <div style={{ color: vars.status.loss, fontSize: 12, fontFamily: vars.font.mono }}>{error}</div>
        )}
        {!loading && !error && summary && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: 10,
                marginBottom: 14,
              }}
            >
              {[
                { label: "OUTCOMES", value: String(summary.totalOutcomes) },
                { label: "RESOLVED", value: String(summary.resolvedCount) },
                { label: "LEARNING N", value: String(summary.learningSampleSize) },
                {
                  label: "ASSIGN RATE",
                  value: `${(summary.overallAssignmentRate * 100).toFixed(0)}%`,
                },
                {
                  label: "PREMIUM",
                  value: fmt.currency(summary.totalPremiumCash ?? 0),
                },
                {
                  label: "REALIZED",
                  value: fmt.currency(summary.totalRealizedPnL ?? 0),
                  color:
                    (summary.totalRealizedPnL ?? 0) >= 0 ? vars.status.gain : vars.status.loss,
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: vars.bg.raised,
                    border: `1px solid ${vars.bg.hover}`,
                    borderRadius: 4,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: vars.text.muted,
                      fontFamily: vars.font.mono,
                      marginBottom: 4,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: vars.font.mono,
                      fontWeight: 700,
                      color: m.color ?? vars.text.primary,
                    }}
                  >
                    {m.value}
                  </div>
                </div>
              ))}
            </div>

            {summary.cohorts.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: vars.text.muted,
                    fontFamily: vars.font.mono,
                    marginBottom: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  COHORTS
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 11,
                      fontFamily: vars.font.mono,
                    }}
                  >
                    <thead>
                      <tr style={{ color: vars.text.muted, textAlign: "left" }}>
                        <th style={{ padding: "4px 6px" }}>KEY</th>
                        <th style={{ padding: "4px 6px" }}>N</th>
                        <th style={{ padding: "4px 6px" }}>ASSIGN</th>
                        <th style={{ padding: "4px 6px" }}>MODEL</th>
                        <th style={{ padding: "4px 6px" }}>CAPTURE</th>
                        <th style={{ padding: "4px 6px" }}>CONDITIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.cohorts.slice(0, 8).map((c) => (
                        <tr key={c.cohortKey} style={{ color: vars.text.secondary }}>
                          <td style={{ padding: "4px 6px", maxWidth: 220 }}>{c.cohortKey}</td>
                          <td style={{ padding: "4px 6px" }}>{c.sampleSize}</td>
                          <td style={{ padding: "4px 6px" }}>
                            {(c.assignmentRate * 100).toFixed(0)}%
                          </td>
                          <td style={{ padding: "4px 6px" }}>
                            {c.modelAssignmentProbAvg != null
                              ? `${(c.modelAssignmentProbAvg * 100).toFixed(0)}%`
                              : "—"}
                          </td>
                          <td style={{ padding: "4px 6px" }}>
                            {c.premiumCaptureRatio != null
                              ? c.premiumCaptureRatio.toFixed(2)
                              : "—"}
                          </td>
                          <td style={{ padding: "4px 6px" }}>
                            {c.recurringConditions.join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {summary.anomalies.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: vars.status.warning,
                    fontFamily: vars.font.mono,
                    marginBottom: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  ANOMALIES
                </div>
                {summary.anomalies.slice(0, 6).map((a) => (
                  <div
                    key={a.clientOrderId}
                    style={{
                      fontSize: 11,
                      fontFamily: vars.font.mono,
                      color: vars.text.primary,
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: vars.status.warning }}>{a.underlying}</span> · {a.outcomeLabel}
                    {" — "}
                    {a.reason ?? "flagged"}
                  </div>
                ))}
              </div>
            )}

            {summary.cycles.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    color: vars.text.muted,
                    fontFamily: vars.font.mono,
                    marginBottom: 6,
                    letterSpacing: "0.06em",
                  }}
                >
                  WHEEL CYCLES
                </div>
                {summary.cycles.slice(0, 5).map((c) => (
                  <div
                    key={c.wheelCycleId}
                    style={{
                      fontSize: 11,
                      fontFamily: vars.font.mono,
                      color: vars.text.secondary,
                      marginBottom: 4,
                    }}
                  >
                    {c.underlying} · {c.legCount} legs · prem{" "}
                    {fmt.currency(c.totalPremiumCash ?? 0)} · pnl{" "}
                    <span
                      style={{
                        color: (c.totalRealizedPnL ?? 0) >= 0 ? vars.status.gain : vars.status.loss,
                      }}
                    >
                      {fmt.currency(c.totalRealizedPnL ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {summary.totalOutcomes === 0 && (
              <div style={{ color: vars.text.muted, fontSize: 12, fontFamily: vars.font.mono }}>
                No closed outcomes yet. Place and resolve fills to train the Experience head.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
