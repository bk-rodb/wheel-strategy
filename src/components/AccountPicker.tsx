import { useState } from "react";
import type { BrokerType } from "../types";
import { BROKER_ACCOUNTS, BROKER_COLOR } from "../constants";

interface AccountPickerProps {
  selected: BrokerType;
  onChange: (broker: BrokerType) => void;
}

export function AccountPicker({ selected, onChange }: AccountPickerProps) {
  const [open, setOpen] = useState(false);
  const current = BROKER_ACCOUNTS.find((a) => a.id === selected)!;
  const color = BROKER_COLOR[selected];

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "5px 12px",
          border: `1px solid ${color}50`,
          borderRadius: 4,
          background: `${color}12`,
          transition: "all 0.15s",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700, color }}>
          {current.label}
        </span>
        <span style={{ fontSize: 9, color: "#4a4a6a", fontFamily: "monospace" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 199 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              zIndex: 200,
              background: "#0d0d1e",
              border: "1px solid #2a2a3a",
              borderRadius: 6,
              overflow: "hidden",
              minWidth: 200,
              boxShadow: "0 8px 24px #00000060",
            }}
          >
            {BROKER_ACCOUNTS.map((acct) => {
              const c = BROKER_COLOR[acct.id];
              const isSelected = acct.id === selected;
              return (
                <button
                  key={acct.id}
                  disabled={!acct.available}
                  onClick={() => {
                    if (acct.available) {
                      onChange(acct.id);
                      setOpen(false);
                    }
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    cursor: acct.available ? "pointer" : "default",
                    background: isSelected ? `${c}12` : "transparent",
                    borderBottom: "1px solid #14142a",
                    opacity: acct.available ? 1 : 0.4,
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (acct.available)
                      (e.currentTarget as HTMLElement).style.background = `${c}18`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = isSelected
                      ? `${c}12`
                      : "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: isSelected ? c : "#2a2a4a",
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ textAlign: "left" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontFamily: "monospace",
                        fontWeight: 700,
                        color: isSelected ? c : "#8080a0",
                      }}
                    >
                      {acct.label}
                    </div>
                    <div style={{ fontSize: 9, color: "#3a3a5a", fontFamily: "monospace" }}>
                      {acct.sublabel}
                    </div>
                  </div>
                  {isSelected && (
                    <span style={{ marginLeft: "auto", fontSize: 10, color: c }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
