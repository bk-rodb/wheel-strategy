import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  clearBotLastCycle,
  fetchBotConfig,
  fetchBotRuns,
  type BotConfig,
  type BotLastCycle,
  type BotRun,
} from "../api/fetchBot";
import { fmtShortDateTime as fmtTime } from "../utils/formatters";
import { nextFriday, toDateString } from "../utils/nextFriday";
import { Banner, LoadingState } from "./ui";
import { vars } from "../theme";

const STATUSES = ["", "skipped", "dry_run", "placed", "filled", "canceled", "blocked", "error"];

function completedStatuses(status: string): boolean {
  return status === "placed" || status === "filled" || status === "dry_run";
}

function lastFor(cycles: BotLastCycle[], symbol: string): BotLastCycle | undefined {
  return cycles.find((c) => c.symbol === symbol);
}

type ConfirmKind = { kind: "rearm"; symbol?: string };

const card: CSSProperties = {
  background: vars.bg.card,
  border: `1px solid ${vars.border.default}`,
  borderRadius: 6,
  overflow: "hidden",
  marginBottom: 16,
};

const sectionTitle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  color: vars.text.muted,
  fontFamily: vars.font.mono,
};

const btn: CSSProperties = {
  padding: "6px 12px",
  fontSize: 11,
  fontFamily: vars.font.mono,
  fontWeight: 700,
  letterSpacing: "0.04em",
  cursor: "pointer",
  borderRadius: 4,
  border: `1px solid ${vars.text.ghost}`,
  background: vars.bg.overlay,
  color: vars.text.primary,
};

export function BotPanel() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterSymbol, setFilterSymbol] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  const thisFriday = useMemo(() => toDateString(nextFriday()), []);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const [cfg, history] = await Promise.all([
      fetchBotConfig(signal),
      fetchBotRuns({ limit: 100, symbol: filterSymbol || undefined, status: filterStatus || undefined, signal }),
    ]);
    setConfig(cfg);
    setRuns(history);
  }, [filterSymbol, filterStatus]);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    reload(ctrl.signal)
      .then(() => setError(null))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Failed to load bot config");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [reload]);

  const doConfirm = async () => {
    if (!confirm) return;
    setSaving(true);
    setError(null);
    try {
      await clearBotLastCycle(confirm.symbol);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-arm failed");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  if (loading && !config) {
    return <LoadingState label="LOADING BOT…" spinner={false} />;
  }

  if (!config) {
    return <Banner tone="error">✗ {error ?? "Bot config unavailable"}</Banner>;
  }

  const { settings, lastCycles } = config;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...sectionTitle, marginBottom: 4 }}>BOT · WEEKLY SELL-TO-OPEN</div>
        <div style={{ fontSize: 13, color: vars.text.primary }}>
          Mirrors what the worker last self-reported. Symbols, level, dry-run, and paused are
          governed by <code>bot/.env</code> on the machine running the worker — edit it and
          restart to change them; this tab cannot override them.
        </div>
      </div>

      {error && (
        <Banner tone="error" marginBottom={16}>
          ✗ {error}
        </Banner>
      )}

      {confirm && (
        <Banner
          tone="warning"
          marginBottom={16}
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}
        >
          <span>
            {confirm.symbol
              ? `Re-arm ${confirm.symbol} for this Friday? The next --once may place again.`
              : "Re-arm ALL symbols for this Friday?"}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" style={btn} onClick={() => setConfirm(null)} disabled={saving}>
              CANCEL
            </button>
            <button
              type="button"
              style={{ ...btn, borderColor: vars.tint.warningHint, color: vars.status.warning }}
              onClick={() => void doConfirm()}
              disabled={saving}
            >
              CONFIRM
            </button>
          </span>
        </Banner>
      )}

      <div style={card}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${vars.border.subtle}` }}>
          <div style={sectionTitle}>STATUS · THIS FRIDAY {thisFriday}</div>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 0 }}>
          <Badge
            label="MODE"
            value={settings.paused ? "PAUSED" : "ARMED"}
            color={settings.paused ? vars.status.warning : vars.status.gain}
          />
          <Badge
            label="DRY RUN"
            value={settings.dryRun ? "ON" : "OFF"}
            color={settings.dryRun ? vars.status.info : vars.status.loss}
          />
          <Badge label="LEVEL" value={settings.level.toUpperCase()} color={vars.text.primary} />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: vars.text.faint, textAlign: "left" }}>
              {["SYMBOL", "LAST FRIDAY", "STATUS", "WHEN", "CLIENT ORDER", "THIS WEEK", ""].map((h) => (
                <th key={h} style={{ padding: "8px 14px", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {settings.symbols.map((sym) => {
              const last = lastFor(lastCycles, sym);
              const done =
                !!last && last.targetFriday === thisFriday && completedStatuses(last.status);
              return (
                <tr key={sym} style={{ borderTop: `1px solid ${vars.border.subtle}` }}>
                  <td style={{ padding: "8px 14px", color: vars.text.strong, fontWeight: 700 }}>{sym}</td>
                  <td style={{ padding: "8px 14px" }}>{last?.targetFriday ?? "—"}</td>
                  <td style={{ padding: "8px 14px", color: statusColor(last?.status) }}>
                    {last?.status ?? "—"}
                  </td>
                  <td style={{ padding: "8px 14px" }}>{last ? fmtTime(last.at) : "—"}</td>
                  <td style={{ padding: "8px 14px", color: vars.text.muted }}>
                    {last?.clientOrderId ?? "—"}
                  </td>
                  <td style={{ padding: "8px 14px", color: done ? vars.status.gain : vars.text.muted }}>
                    {done ? "COMPLETED" : "OPEN"}
                  </td>
                  <td style={{ padding: "8px 14px" }}>
                    <button
                      type="button"
                      style={{ ...btn, padding: "4px 8px" }}
                      disabled={saving || !last}
                      onClick={() => setConfirm({ kind: "rearm", symbol: sym })}
                    >
                      RE-ARM
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ padding: "10px 14px", borderTop: `1px solid ${vars.border.subtle}` }}>
          <button
            type="button"
            style={btn}
            disabled={saving || lastCycles.length === 0}
            onClick={() => setConfirm({ kind: "rearm" })}
          >
            RE-ARM ALL
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${vars.border.subtle}` }}>
          <div style={sectionTitle}>CONFIG · READ-ONLY (bot/.env)</div>
        </div>
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          <div>
            <div style={{ ...sectionTitle, marginBottom: 8 }}>SYMBOLS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {settings.symbols.map((sym) => (
                <span
                  key={sym}
                  style={{
                    padding: "4px 8px",
                    border: `1px solid ${vars.text.ghost}`,
                    borderRadius: 4,
                    fontSize: 12,
                    color: vars.text.strong,
                  }}
                >
                  {sym}
                </span>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: vars.text.muted }}>
            Last reported {fmtTime(settings.updatedAt)} — LEVEL, DRY RUN, and MODE badges above
            are the current values.
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            padding: "12px 14px",
            borderBottom: `1px solid ${vars.border.subtle}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={sectionTitle}>RUN HISTORY</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              value={filterSymbol}
              onChange={(e) => setFilterSymbol(e.target.value)}
              style={selectStyle}
            >
              <option value="">ALL SYMBOLS</option>
              {settings.symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={selectStyle}
            >
              {STATUSES.map((s) => (
                <option key={s || "all"} value={s}>
                  {s ? s.toUpperCase() : "ALL STATUS"}
                </option>
              ))}
            </select>
          </div>
        </div>
        {runs.length === 0 ? (
          <div style={{ padding: 14, color: vars.text.muted, fontSize: 12 }}>No runs recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: vars.text.faint, textAlign: "left" }}>
                  {["WHEN", "SYMBOL", "STATUS", "SIDE", "STRIKE", "LIMIT", "REASON"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={`${r.at}-${r.symbol}-${i}`} style={{ borderTop: `1px solid ${vars.border.subtle}` }}>
                    <td style={{ padding: "8px 14px" }}>{fmtTime(r.at)}</td>
                    <td style={{ padding: "8px 14px", fontWeight: 700 }}>{r.symbol}</td>
                    <td style={{ padding: "8px 14px", color: statusColor(r.status) }}>{r.status}</td>
                    <td style={{ padding: "8px 14px" }}>{r.side}</td>
                    <td style={{ padding: "8px 14px" }}>{r.strike ?? "—"}</td>
                    <td style={{ padding: "8px 14px" }}>{r.sellLimit ?? "—"}</td>
                    <td style={{ padding: "8px 14px", color: vars.text.muted }}>{r.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Badge({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: vars.text.faint, letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function statusColor(status?: string): string {
  if (status === "filled" || status === "dry_run" || status === "placed") return vars.status.gain;
  if (status === "blocked" || status === "error") return vars.status.loss;
  if (status === "canceled" || status === "skipped") return vars.status.warning;
  return vars.text.muted;
}

const selectStyle: CSSProperties = {
  background: vars.bg.overlay,
  border: `1px solid ${vars.text.ghost}`,
  color: vars.text.primary,
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: vars.font.mono,
};
