import { useEffect, useState } from "react";
import { IS_MOCK } from "../config";
import {
  fetchRetrospective,
  tradeOutcomesCsvUrl,
  type RetrospectiveSummary,
} from "../api/fetchTradeOutcomes";
import { fmt } from "../utils/formatters";

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
        background: "#08081a",
        border: "1px solid #1a1a30",
        borderRadius: 6,
        marginBottom: 20,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #12122a",
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
              color: "#6b6b8a",
              fontFamily: "monospace",
              marginBottom: 4,
            }}
          >
            RETROSPECTIVE · EXPERIENCE LEDGER
          </div>
          <div style={{ fontSize: 13, color: "#c0c0e0" }}>
            Closed-leg outcomes, cohorts, and anomalies feeding the Experience head
          </div>
        </div>
        {!IS_MOCK && (
          <a
            href={tradeOutcomesCsvUrl()}
            style={{ fontSize: 11, color: "#60a5fa", fontFamily: "monospace" }}
          >
            CSV EXPORT
          </a>
        )}
      </div>

      <div style={{ padding: 14 }}>
        {loading && (
          <div style={{ color: "#6b6b8a", fontSize: 12, fontFamily: "monospace" }}>
            Loading outcomes…
          </div>
        )}
        {error && (
          <div style={{ color: "#f87171", fontSize: 12, fontFamily: "monospace" }}>{error}</div>
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
                    (summary.totalRealizedPnL ?? 0) >= 0 ? "#34d399" : "#f87171",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  style={{
                    background: "#0c0c1c",
                    border: "1px solid #16162a",
                    borderRadius: 4,
                    padding: "8px 10px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#6b6b8a",
                      fontFamily: "monospace",
                      marginBottom: 4,
                    }}
                  >
                    {m.label}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: m.color ?? "#c0c0e0",
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
                    color: "#6b6b8a",
                    fontFamily: "monospace",
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
                      fontFamily: "monospace",
                    }}
                  >
                    <thead>
                      <tr style={{ color: "#6b6b8a", textAlign: "left" }}>
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
                        <tr key={c.cohortKey} style={{ color: "#a0a0c0" }}>
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
                    color: "#f59e0b",
                    fontFamily: "monospace",
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
                      fontFamily: "monospace",
                      color: "#c0c0e0",
                      marginBottom: 4,
                    }}
                  >
                    <span style={{ color: "#f59e0b" }}>{a.underlying}</span> · {a.outcomeLabel}
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
                    color: "#6b6b8a",
                    fontFamily: "monospace",
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
                      fontFamily: "monospace",
                      color: "#a0a0c0",
                      marginBottom: 4,
                    }}
                  >
                    {c.underlying} · {c.legCount} legs · prem{" "}
                    {fmt.currency(c.totalPremiumCash ?? 0)} · pnl{" "}
                    <span
                      style={{
                        color: (c.totalRealizedPnL ?? 0) >= 0 ? "#34d399" : "#f87171",
                      }}
                    >
                      {fmt.currency(c.totalRealizedPnL ?? 0)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {summary.totalOutcomes === 0 && (
              <div style={{ color: "#6b6b8a", fontSize: 12, fontFamily: "monospace" }}>
                No closed outcomes yet. Place and resolve fills to train the Experience head.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
