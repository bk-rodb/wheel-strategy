import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  clearBotLastCycle,
  fetchBotConfig,
  fetchBotRuns,
  saveBotConfig,
  type BotConfig,
  type BotLastCycle,
  type BotLevel,
  type BotRun,
} from "../api/fetchBot";
import { nextFriday, toDateString } from "../utils/nextFriday";

const LEVELS: BotLevel[] = ["safe", "regular", "risky"];
const STATUSES = ["", "skipped", "dry_run", "placed", "filled", "canceled", "blocked", "error"];

function completedStatuses(status: string): boolean {
  return status === "placed" || status === "filled" || status === "dry_run";
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function lastFor(cycles: BotLastCycle[], symbol: string): BotLastCycle | undefined {
  return cycles.find((c) => c.symbol === symbol);
}

type ConfirmKind =
  | { kind: "dry_run_off" }
  | { kind: "pause_on" }
  | { kind: "rearm"; symbol?: string };

const card: CSSProperties = {
  background: "#08081a",
  border: "1px solid #1a1a30",
  borderRadius: 6,
  overflow: "hidden",
  marginBottom: 16,
};

const sectionTitle: CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  color: "#6b6b8a",
  fontFamily: "monospace",
};

const btn: CSSProperties = {
  padding: "6px 12px",
  fontSize: 11,
  fontFamily: "monospace",
  fontWeight: 700,
  letterSpacing: "0.04em",
  cursor: "pointer",
  borderRadius: 4,
  border: "1px solid #2a2a4a",
  background: "#101028",
  color: "#c0c0e0",
};

export function BotPanel() {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [runs, setRuns] = useState<BotRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [symbolDraft, setSymbolDraft] = useState("");
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

  const apply = async (patch: Parameters<typeof saveBotConfig>[0]) => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveBotConfig(patch);
      setConfig(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setConfirm(null);
    }
  };

  const addSymbol = () => {
    if (!config) return;
    const sym = symbolDraft.trim().toUpperCase();
    if (!sym || config.settings.symbols.includes(sym)) {
      setSymbolDraft("");
      return;
    }
    void apply({ symbols: [...config.settings.symbols, sym] });
    setSymbolDraft("");
  };

  const removeSymbol = (sym: string) => {
    if (!config || config.settings.symbols.length <= 1) return;
    void apply({ symbols: config.settings.symbols.filter((s) => s !== sym) });
  };

  const requestDryRun = (next: boolean) => {
    if (!next) setConfirm({ kind: "dry_run_off" });
    else void apply({ dryRun: true });
  };

  const requestPaused = (next: boolean) => {
    if (next) setConfirm({ kind: "pause_on" });
    else void apply({ paused: false });
  };

  const doConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === "dry_run_off") {
      await apply({ dryRun: false });
      return;
    }
    if (confirm.kind === "pause_on") {
      await apply({ paused: true });
      return;
    }
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
    return (
      <div style={{ textAlign: "center", padding: 80, color: "#2a2a4a", fontSize: 12 }}>
        LOADING BOT…
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ color: "#f87171", fontSize: 12, fontFamily: "monospace" }}>
        {error ?? "Bot config unavailable"}
      </div>
    );
  }

  const { settings, lastCycles } = config;

  return (
    <div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ ...sectionTitle, marginBottom: 4 }}>BOT · WEEKLY SELL-TO-OPEN</div>
        <div style={{ fontSize: 13, color: "#c0c0e0" }}>
          Shared knobs for the paper worker. Changes apply on the next Mon/Tue cycle — the process
          is still started by Task Scheduler or npm.
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "#1a0808",
            border: "1px solid #4a1010",
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: 12,
            color: "#f87171",
          }}
        >
          {error}
        </div>
      )}

      {confirm && (
        <div
          style={{
            background: "#1a1408",
            border: "1px solid #4a3810",
            borderRadius: 6,
            padding: 12,
            marginBottom: 16,
            fontSize: 12,
            color: "#f59e0b",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>
            {confirm.kind === "dry_run_off" &&
              "Turn dry-run OFF? The next cycle will POST paper sell-to-open orders."}
            {confirm.kind === "pause_on" &&
              "Pause the bot? Task Scheduler still fires; every symbol will skip."}
            {confirm.kind === "rearm" &&
              (confirm.symbol
                ? `Re-arm ${confirm.symbol} for this Friday? The next --once may place again.`
                : "Re-arm ALL symbols for this Friday?")}
          </span>
          <span style={{ display: "flex", gap: 8 }}>
            <button type="button" style={btn} onClick={() => setConfirm(null)} disabled={saving}>
              CANCEL
            </button>
            <button
              type="button"
              style={{ ...btn, borderColor: "#7a3a10", color: "#f59e0b" }}
              onClick={() => void doConfirm()}
              disabled={saving}
            >
              CONFIRM
            </button>
          </span>
        </div>
      )}

      <div style={card}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #12122a" }}>
          <div style={sectionTitle}>STATUS · THIS FRIDAY {thisFriday}</div>
        </div>
        <div style={{ padding: 14, display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 0 }}>
          <Badge
            label="MODE"
            value={settings.paused ? "PAUSED" : "ARMED"}
            color={settings.paused ? "#f59e0b" : "#34d399"}
          />
          <Badge
            label="DRY RUN"
            value={settings.dryRun ? "ON" : "OFF"}
            color={settings.dryRun ? "#60a5fa" : "#f87171"}
          />
          <Badge label="LEVEL" value={settings.level.toUpperCase()} color="#c0c0e0" />
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ color: "#3a3a5a", textAlign: "left" }}>
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
                <tr key={sym} style={{ borderTop: "1px solid #12122a" }}>
                  <td style={{ padding: "8px 14px", color: "#e2e2f0", fontWeight: 700 }}>{sym}</td>
                  <td style={{ padding: "8px 14px" }}>{last?.targetFriday ?? "—"}</td>
                  <td style={{ padding: "8px 14px", color: statusColor(last?.status) }}>
                    {last?.status ?? "—"}
                  </td>
                  <td style={{ padding: "8px 14px" }}>{last ? fmtTime(last.at) : "—"}</td>
                  <td style={{ padding: "8px 14px", color: "#6b6b8a" }}>
                    {last?.clientOrderId ?? "—"}
                  </td>
                  <td style={{ padding: "8px 14px", color: done ? "#34d399" : "#6b6b8a" }}>
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
        <div style={{ padding: "10px 14px", borderTop: "1px solid #12122a" }}>
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
        <div style={{ padding: "12px 14px", borderBottom: "1px solid #12122a" }}>
          <div style={sectionTitle}>CONFIG</div>
        </div>
        <div style={{ padding: 14, display: "grid", gap: 16 }}>
          <div>
            <div style={{ ...sectionTitle, marginBottom: 8 }}>SYMBOLS</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {settings.symbols.map((sym) => (
                <span
                  key={sym}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 8px",
                    border: "1px solid #2a2a4a",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#e2e2f0",
                  }}
                >
                  {sym}
                  <button
                    type="button"
                    aria-label={`Remove ${sym}`}
                    disabled={saving || settings.symbols.length <= 1}
                    onClick={() => removeSymbol(sym)}
                    style={{ color: "#6b6b8a", cursor: "pointer", fontSize: 11 }}
                  >
                    ✕
                  </button>
                </span>
              ))}
              <input
                value={symbolDraft}
                onChange={(e) => setSymbolDraft(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSymbol();
                  }
                }}
                placeholder="ADD"
                disabled={saving}
                style={{
                  width: 80,
                  background: "#101028",
                  border: "1px solid #2a2a4a",
                  color: "#c0c0e0",
                  padding: "4px 8px",
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
              <button type="button" style={btn} disabled={saving || !symbolDraft} onClick={addSymbol}>
                ADD
              </button>
            </div>
          </div>

          <div>
            <div style={{ ...sectionTitle, marginBottom: 8 }}>LEVEL</div>
            <div style={{ display: "flex", gap: 8 }}>
              {LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  disabled={saving}
                  onClick={() => void apply({ level })}
                  style={{
                    ...btn,
                    borderColor: settings.level === level ? "#34d399" : "#2a2a4a",
                    color: settings.level === level ? "#34d399" : "#c0c0e0",
                  }}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={settings.dryRun}
                disabled={saving}
                onChange={(e) => requestDryRun(e.target.checked)}
              />
              DRY RUN
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={settings.paused}
                disabled={saving}
                onChange={(e) => requestPaused(e.target.checked)}
              />
              PAUSED
            </label>
          </div>
        </div>
      </div>

      <div style={card}>
        <div
          style={{
            padding: "12px 14px",
            borderBottom: "1px solid #12122a",
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
          <div style={{ padding: 14, color: "#6b6b8a", fontSize: 12 }}>No runs recorded yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ color: "#3a3a5a", textAlign: "left" }}>
                  {["WHEN", "SYMBOL", "STATUS", "SIDE", "STRIKE", "LIMIT", "REASON"].map((h) => (
                    <th key={h} style={{ padding: "8px 14px", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => (
                  <tr key={`${r.at}-${r.symbol}-${i}`} style={{ borderTop: "1px solid #12122a" }}>
                    <td style={{ padding: "8px 14px" }}>{fmtTime(r.at)}</td>
                    <td style={{ padding: "8px 14px", fontWeight: 700 }}>{r.symbol}</td>
                    <td style={{ padding: "8px 14px", color: statusColor(r.status) }}>{r.status}</td>
                    <td style={{ padding: "8px 14px" }}>{r.side}</td>
                    <td style={{ padding: "8px 14px" }}>{r.strike ?? "—"}</td>
                    <td style={{ padding: "8px 14px" }}>{r.sellLimit ?? "—"}</td>
                    <td style={{ padding: "8px 14px", color: "#6b6b8a" }}>{r.reason ?? "—"}</td>
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
      <div style={{ fontSize: 10, color: "#3a3a5a", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function statusColor(status?: string): string {
  if (status === "filled" || status === "dry_run" || status === "placed") return "#34d399";
  if (status === "blocked" || status === "error") return "#f87171";
  if (status === "canceled" || status === "skipped") return "#f59e0b";
  return "#6b6b8a";
}

const selectStyle: CSSProperties = {
  background: "#101028",
  border: "1px solid #2a2a4a",
  color: "#c0c0e0",
  padding: "4px 8px",
  fontSize: 11,
  fontFamily: "monospace",
};
