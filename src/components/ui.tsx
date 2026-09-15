import type { CSSProperties, ReactNode } from "react";

/** Shared desk primitives — the card chrome, labels, banners, and placeholders every panel reuses. */

export function Card({
  children,
  marginBottom,
  style,
}: {
  children: ReactNode;
  marginBottom?: number;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "#08081a",
        border: "1px solid #1a1a30",
        borderRadius: 6,
        padding: 14,
        marginBottom,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CardLabel({
  children,
  marginBottom = 8,
}: {
  children: ReactNode;
  marginBottom?: number;
}) {
  return (
    <div
      style={{
        fontSize: 10,
        color: "#4a4a6a",
        fontFamily: "monospace",
        letterSpacing: "0.08em",
        marginBottom,
      }}
    >
      {children}
    </div>
  );
}

const BANNER_TONE = {
  error: { background: "#1a0808", border: "#4a1010", color: "#f87171" },
  warning: { background: "#1a1408", border: "#4a3810", color: "#f59e0b" },
} as const;

export function Banner({
  tone,
  children,
  hint,
  marginBottom,
  style,
}: {
  tone: keyof typeof BANNER_TONE;
  children: ReactNode;
  /** Secondary line under the message (e.g. how to start the backend). */
  hint?: ReactNode;
  marginBottom?: number;
  style?: CSSProperties;
}) {
  const t = BANNER_TONE[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        background: t.background,
        border: `1px solid ${t.border}`,
        borderRadius: 6,
        padding: 12,
        marginBottom,
        fontSize: 12,
        color: t.color,
        fontFamily: "monospace",
        ...style,
      }}
    >
      {children}
      {hint && <div style={{ color: "#7a4a4a", fontSize: 10, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export function LoadingState({
  label,
  padding = 80,
  spinner = true,
}: {
  label: ReactNode;
  padding?: number;
  spinner?: boolean;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding,
        color: "#2a2a4a",
        fontFamily: "monospace",
        fontSize: 12,
      }}
    >
      {spinner && <div style={{ fontSize: 24, marginBottom: 8 }}>◌</div>}
      {label}
    </div>
  );
}

export function EmptyState({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#3a3a5a",
        fontFamily: "monospace",
        padding: "12px 0",
        textAlign: "center",
      }}
    >
      {children}
      {hint && (
        <>
          <br />
          <span style={{ fontSize: 9 }}>{hint}</span>
        </>
      )}
    </div>
  );
}

export function ToggleButton({
  active,
  onClick,
  title,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={active}
      style={{
        cursor: disabled ? "default" : "pointer",
        background: active ? "#34d39920" : "#0d0d1e",
        border: `1px solid ${active ? "#34d39950" : "#1e1e38"}`,
        borderRadius: 4,
        padding: "4px 9px",
        fontSize: 11,
        fontFamily: "monospace",
        fontWeight: 700,
        color: active ? "#34d399" : "#5a5a7a",
      }}
    >
      {children}
    </button>
  );
}
