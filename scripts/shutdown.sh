#!/usr/bin/env bash
# Tear down local Wheel Strategy desk processes (Vite + analysis API).
# Safe to run when nothing is running — reports what it found and exits 0.
#
# Usage (from repo root or anywhere):
#   ./scripts/shutdown.sh
#   bash scripts/shutdown.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_DIR="$ROOT/backend/WheelStrategy.Api"

# Dev ports from docs/LAUNCH.md
FRONTEND_PORT=5173
API_PORT=5099
PREVIEW_PORT=4173

is_windows() {
  case "$(uname -s 2>/dev/null || echo unknown)" in
    MINGW*|MSYS*|CYGWIN*|Windows_NT) return 0 ;;
    *) return 1 ;;
  esac
}

log()  { printf '  %s\n' "$*"; }
info() { printf '\n==> %s\n' "$*"; }

# Collect PIDs listening on a TCP port (LISTEN only).
pids_on_port() {
  local port="$1"
  local pids=""

  if is_windows; then
    pids="$(
      netstat -ano 2>/dev/null \
        | tr -d '\r' \
        | awk -v p=":$port" '
            $0 ~ /LISTENING/ && ($2 ~ p"$" || $2 ~ p" ") {
              print $NF
            }
          ' \
        | sort -u
    )"
  elif command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
  elif command -v ss >/dev/null 2>&1; then
    pids="$(
      ss -lptn "sport = :$port" 2>/dev/null \
        | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
        | sort -u
    )"
  fi

  printf '%s' "$pids" | tr ' ' '\n' | awk 'NF && $1 ~ /^[0-9]+$/' | sort -u
}

# Extra PIDs for known desk processes (covers orphans not bound to our ports yet).
pids_by_pattern() {
  if is_windows; then
    # Vite / npm run dev
    powershell.exe -NoProfile -Command \
      "Get-CimInstance Win32_Process | Where-Object {
         \$_.CommandLine -match 'vite|WheelStrategy\.Api' -or
         \$_.Name -eq 'WheelStrategy.Api.exe'
       } | Select-Object -ExpandProperty ProcessId" 2>/dev/null \
      | tr -d '\r' \
      | awk 'NF && $1 ~ /^[0-9]+$/'
  else
    pgrep -f 'vite|WheelStrategy\.Api' 2>/dev/null || true
  fi
}

kill_pid() {
  local pid="$1"
  if is_windows; then
    # Graceful first, then force
    taskkill //PID "$pid" >/dev/null 2>&1 || true
    sleep 0.4
    if tasklist //FI "PID eq $pid" 2>/dev/null | grep -q "$pid"; then
      taskkill //PID "$pid" //F >/dev/null 2>&1 || true
    fi
  else
    kill -TERM "$pid" 2>/dev/null || true
    sleep 0.4
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
}

stop_port() {
  local label="$1"
  local port="$2"
  local pids
  pids="$(pids_on_port "$port")"

  if [[ -z "$pids" ]]; then
    log "$label (:$port) — not running"
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue
    log "$label (:$port) — stopping PID $pid"
    kill_pid "$pid"
  done <<< "$pids"
}

checkpoint_sqlite() {
  local db="$API_DIR/wheel.db"
  [[ -f "$db" ]] || return 0

  if ! command -v sqlite3 >/dev/null 2>&1; then
    if [[ -f "$db-wal" ]]; then
      log "SQLite WAL present (sqlite3 not installed — will recover on next API start)"
    fi
    return 0
  fi

  if [[ -f "$db-wal" ]]; then
    log "Checkpointing SQLite WAL → $db"
    sqlite3 "$db" "PRAGMA wal_checkpoint(TRUNCATE);" >/dev/null 2>&1 \
      || log "WAL checkpoint skipped (db may still be locked)"
  else
    log "SQLite — no WAL to checkpoint"
  fi
}

verify_port_free() {
  local port="$1"
  local remaining
  remaining="$(pids_on_port "$port")"
  if [[ -n "$remaining" ]]; then
    log "WARNING: port $port still held by PID(s): $(echo "$remaining" | tr '\n' ' ')"
    return 1
  fi
  return 0
}

main() {
  info "Shutting down Wheel Strategy desk"
  log "repo: $ROOT"

  info "Stopping listeners"
  stop_port "Vite frontend" "$FRONTEND_PORT"
  stop_port "Analysis API"  "$API_PORT"
  stop_port "Vite preview"  "$PREVIEW_PORT"

  info "Sweeping leftover desk processes"
  local extra
  extra="$(pids_by_pattern || true)"
  if [[ -z "${extra//[$'\t\r\n ']/}" ]]; then
    log "none"
  else
    while IFS= read -r pid; do
      [[ -z "$pid" ]] && continue
      # Skip our own shell / powershell helpers
      [[ "$pid" == "$$" ]] && continue
      log "stopping leftover PID $pid"
      kill_pid "$pid"
    done <<< "$extra"
  fi

  sleep 0.5

  info "SQLite cache"
  checkpoint_sqlite

  info "Verify ports free"
  local ok=0
  verify_port_free "$FRONTEND_PORT" || ok=1
  verify_port_free "$API_PORT" || ok=1
  verify_port_free "$PREVIEW_PORT" || ok=1
  if [[ $ok -eq 0 ]]; then
    log "5173 / 5099 / 4173 are free"
  fi

  info "Done"
}

main "$@"
