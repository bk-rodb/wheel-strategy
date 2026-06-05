export function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "5px 0",
        borderBottom: "1px solid #14142a",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "#4a4a6a",
          fontFamily: "monospace",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12,
          fontFamily: "monospace",
          fontWeight: 600,
          color: accent ? "#34d399" : "#c0c0e0",
        }}
      >
        {value}
      </span>
    </div>
  );
}
