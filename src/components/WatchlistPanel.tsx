import { useState, useRef, useEffect, useCallback } from "react";
import { useWatchlist } from "../hooks/useWatchlist";
import { searchAssets, type AssetResult } from "../api/searchAssets";
import { WatchlistItem } from "./WatchlistItem";

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function WatchlistPanel({ onOpenTicker }: { onOpenTicker: (symbol: string) => void }) {
  const { items, add, remove } = useWatchlist();

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<AssetResult[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debouncedQuery = useDebounce(query, 250);

  // Fetch suggestions when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 1) {
      setSuggestions([]);
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    searchAssets(debouncedQuery).then((results) => {
      if (cancelled) return;
      setSuggestions(results);
      setActiveIndex(-1);
      setSearching(false);
    }).catch(() => {
      if (!cancelled) setSearching(false);
    });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const commit = useCallback((symbol: string) => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    if (items.some((i) => i.symbol === sym)) {
      setAddError("Already in watchlist");
      return;
    }
    add(sym);
    setQuery("");
    setSuggestions([]);
    setActiveIndex(-1);
    setAddError(null);
    inputRef.current?.focus();
  }, [add, items]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isFocused || suggestions.length === 0) {
      if (e.key === "Enter") commit(query);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        commit(suggestions[activeIndex].symbol);
      } else {
        commit(query);
      }
    } else if (e.key === "Escape") {
      setSuggestions([]);
      setActiveIndex(-1);
    }
  }

  // Scroll active suggestion into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.children[activeIndex] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderLeft: "1px solid #12122a",
        background: "#07071a",
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Panel header */}
      <div style={{ padding: "12px 14px 10px", borderBottom: "1px solid #12122a" }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            fontWeight: 700,
            color: "#4a4a6a",
            letterSpacing: "0.12em",
            marginBottom: 10,
          }}
        >
          WATCHLIST
        </div>

        {/* Search input + dropdown */}
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value.toUpperCase());
                setAddError(null);
              }}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              placeholder="SEARCH TICKER"
              maxLength={20}
              style={{
                flex: 1,
                background: "#0d0d1e",
                border: `1px solid ${addError ? "#ef444460" : isFocused ? "#34d39940" : "#1e1e38"}`,
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#e0e0f0",
                letterSpacing: "0.08em",
                outline: "none",
              }}
            />
            <button
              onClick={() => commit(activeIndex >= 0 ? suggestions[activeIndex].symbol : query)}
              style={{
                cursor: "pointer",
                background: "#34d39920",
                border: "1px solid #34d39950",
                borderRadius: 4,
                padding: "5px 10px",
                fontSize: 11,
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#34d399",
                letterSpacing: "0.06em",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "#34d39930")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background = "#34d39920")
              }
            >
              + ADD
            </button>
          </div>

          {/* Suggestions dropdown */}
          {isFocused && (suggestions.length > 0 || searching) && (
            <ul
              ref={listRef}
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                right: 0,
                zIndex: 50,
                background: "#0d0d1e",
                border: "1px solid #2a2a3a",
                borderRadius: 6,
                overflow: "hidden",
                boxShadow: "0 8px 24px #00000070",
                listStyle: "none",
                maxHeight: 280,
                overflowY: "auto",
              }}
            >
              {searching && (
                <li
                  style={{
                    padding: "8px 12px",
                    fontSize: 10,
                    fontFamily: "monospace",
                    color: "#3a3a5a",
                    letterSpacing: "0.06em",
                  }}
                >
                  SEARCHING...
                </li>
              )}
              {!searching &&
                suggestions.map((asset, i) => {
                  const isActive = i === activeIndex;
                  const alreadyAdded = items.some((it) => it.symbol === asset.symbol);
                  return (
                    <li
                      key={asset.symbol}
                      onMouseDown={() => commit(asset.symbol)}
                      onMouseEnter={() => setActiveIndex(i)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 12px",
                        cursor: alreadyAdded ? "default" : "pointer",
                        background: isActive ? "#1a1a30" : "transparent",
                        borderBottom: "1px solid #12122a",
                        opacity: alreadyAdded ? 0.4 : 1,
                        transition: "background 0.08s",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          fontWeight: 700,
                          color: isActive ? "#34d399" : "#c0c0e0",
                          minWidth: 52,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {asset.symbol}
                      </span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 9,
                          color: "#4a4a6a",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {asset.name}
                      </span>
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 8,
                          color: "#2a2a4a",
                          letterSpacing: "0.06em",
                          flexShrink: 0,
                        }}
                      >
                        {asset.exchange}
                      </span>
                      {alreadyAdded && (
                        <span style={{ fontSize: 8, color: "#34d399" }}>✓</span>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        {addError && (
          <div
            style={{
              marginTop: 5,
              fontSize: 9,
              fontFamily: "monospace",
              color: "#ef4444",
              letterSpacing: "0.06em",
            }}
          >
            {addError}
          </div>
        )}
      </div>

      {/* Watchlist items */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {items.length === 0 ? (
          <div
            style={{
              padding: "32px 14px",
              textAlign: "center",
              fontSize: 10,
              fontFamily: "monospace",
              color: "#2a2a4a",
              letterSpacing: "0.06em",
              lineHeight: 1.8,
            }}
          >
            NO TICKERS WATCHED
            <br />
            <span style={{ fontSize: 9 }}>SEARCH A SYMBOL ABOVE</span>
          </div>
        ) : (
          items.map((item) => (
            <WatchlistItem key={item.symbol} item={item} onRemove={remove} onOpen={onOpenTicker} />
          ))
        )}
      </div>

      {items.length > 0 && (
        <div
          style={{
            padding: "8px 14px",
            borderTop: "1px solid #12122a",
            fontSize: 9,
            fontFamily: "monospace",
            color: "#2a2a4a",
            letterSpacing: "0.06em",
          }}
        >
          {items.length} SYMBOL{items.length !== 1 ? "S" : ""} · 5MIN DELAYED · REFRESH 5MIN
        </div>
      )}
    </div>
  );
}
