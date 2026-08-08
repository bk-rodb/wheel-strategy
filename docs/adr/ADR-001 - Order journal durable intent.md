# ADR-001 — Order journal as durable intent

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-08-08 |
| **Related** | [E-003](../work/E-003%20-%20Harden%20Order%20Flow.md) |

## Context

The desk and bot place Alpaca option orders through the credential proxy. The browser blotter (`localStorage`) and bot file run-log are not shared durable completion records. After a lost POST response, tab crash, or new device, the UI can unlock or fail to resume a live venue order.

## Decision

1. **Alpaca remains the source of truth** for whether an order exists and its broker status.
2. **WheelStrategy.Api SQLite order journal** stores durable *intent* and last-known desk state, keyed by `client_order_id`.
3. Proxy **POST/DELETE `/v2/orders`** paths update the journal; ambiguous POST failures **must** reconcile via `GET /v2/orders:by_client_order_id/{id}` before returning an error (or return the found order).
4. At most **one non-terminal journal intent per underlying**; a second place is rejected with 409.
5. Client `orderBlotter` remains an **optimistic UI cache**, not the completion guarantee.

## Consequences

- Resume and bot skip-if-open consult the journal (+ Alpaca open list).
- SSE `trade_updates` relay stays a follow-up; polling + reconcile cover correctness.
- Clearing browser storage no longer loses in-flight intent for sessions that share this API/db.
