import type { AccountInfo } from "../types";
import { fmt } from "../utils/formatters";
import { vars } from "../theme";

export function AccountHeader({ account, loading }: { account: AccountInfo | null; loading: boolean }) {
  if (loading && !account) {
    return (
      <div
        style={{
          borderBottom: `1px solid ${vars.border.subtle}`,
          padding: "10px 24px",
          background: vars.bg.panel,
          color: vars.text.ghost,
          fontFamily: vars.font.mono,
          fontSize: 10,
          letterSpacing: "0.08em",
        }}
      >
        LOADING ACCOUNT...
      </div>
    );
  }

  if (!account) return null;

  const pnlColor = account.dayPnL >= 0 ? vars.status.gain : vars.status.loss;
  const pnlSign = account.dayPnL >= 0 ? "+" : "";

  const stats = [
    { label: "PORTFOLIO VALUE", value: fmt.currency(account.equity), highlight: true },
    {
      label: "DAY P&L",
      value: `${pnlSign}${fmt.currency(account.dayPnL)} (${pnlSign}${account.dayPnLPct.toFixed(2)}%)`,
      color: pnlColor,
    },
    { label: "CASH", value: fmt.currency(account.cash) },
    { label: "BUYING POWER", value: fmt.currency(account.buyingPower) },
    { label: "LONG MKT VALUE", value: fmt.currency(account.longMarketValue) },
    { label: "ACCOUNT", value: account.accountNumber },
  ];

  return (
    <div
      style={{
        borderBottom: `1px solid ${vars.border.subtle}`,
        padding: "0 24px",
        background: vars.bg.panel,
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        overflowX: "auto",
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.label}
          style={{
            padding: "10px 20px",
            borderRight: i < stats.length - 1 ? `1px solid ${vars.border.subtle}` : "none",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 9,
              color: vars.text.faint,
              fontFamily: vars.font.mono,
              letterSpacing: "0.1em",
              marginBottom: 3,
            }}
          >
            {s.label}
          </div>
          <div
            style={{
              fontSize: s.highlight ? 15 : 12,
              fontFamily: vars.font.mono,
              fontWeight: s.highlight ? 700 : 600,
              color: s.color ?? (s.highlight ? vars.text.strong : vars.text.secondary),
              letterSpacing: "-0.01em",
            }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}
