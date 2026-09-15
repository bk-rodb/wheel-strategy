import { vars } from "../theme";
export function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: `1px solid ${vars.bg.hover}`,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: vars.text.dim,
          fontFamily: vars.font.mono,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontFamily: vars.font.mono,
          fontWeight: 600,
          color: accent ? vars.status.gain : vars.text.primary,
        }}
      >
        {value}
      </span>
    </div>
  );
}
