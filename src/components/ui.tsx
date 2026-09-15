import type { CSSProperties, ReactNode } from "react";
import { alpha, vars } from "../theme";

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
        background: vars.bg.card,
        border: `1px solid ${vars.border.default}`,
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
        color: vars.text.dim,
        fontFamily: vars.font.mono,
        letterSpacing: "0.08em",
        marginBottom,
      }}
    >
      {children}
    </div>
  );
}

const BANNER_TONE = {
  error: { background: vars.tint.lossSurface, border: vars.tint.lossBorder, color: vars.status.loss },
  warning: { background: vars.tint.warningSurface, border: vars.tint.warningBorder, color: vars.status.warning },
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
        fontFamily: vars.font.mono,
        ...style,
      }}
    >
      {children}
      {hint && <div style={{ color: vars.tint.lossHint, fontSize: 10, marginTop: 6 }}>{hint}</div>}
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
        color: vars.text.ghost,
        fontFamily: vars.font.mono,
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
        color: vars.text.faint,
        fontFamily: vars.font.mono,
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
        background: active ? alpha(vars.accent, 0.125) : vars.bg.raised,
        border: `1px solid ${active ? alpha(vars.accent, 0.314) : vars.border.strong}`,
        borderRadius: 4,
        padding: "4px 9px",
        fontSize: 11,
        fontFamily: vars.font.mono,
        fontWeight: 700,
        color: active ? vars.accent : vars.text.subtle,
      }}
    >
      {children}
    </button>
  );
}
