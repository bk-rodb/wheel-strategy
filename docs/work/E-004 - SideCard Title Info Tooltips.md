# E-004 — SideCard Title Info Tooltips

| Field | Value |
|-------|-------|
| **ID** | `E-004` |
| **Type** | Enhancement |
| **Status** | planned |
| **Opened** | 2026-08-08 |
| **Closed** | — |
| **Owner** | — |
| **Related** | [`WheelAnalysisPanel.tsx`](../../src/components/WheelAnalysisPanel.tsx) `SideCard` |

---

## Prompt

> These labels are descriptors or explanations. I want to replace them with an information icon/bubble next to the label (e.g. CASH-SECURED PUT [info bubble]).
>
> Current always-visible lines under SideCard titles:
> - `sell put · want price to stay ABOVE strike`
> - `sell call · want price to stay BELOW strike`

---

## Context

In the wheel analysis panel, each `SideCard` shows a title (`CASH-SECURED PUT` / `COVERED CALL`) plus a permanent monospace subtitle that explains the sell-side intent (want price above/below strike). Those lines clutter the header; the same copy is better as on-demand help next to the title.

The panel already uses native browser `title` hints elsewhere (LEVEL / Δ columns). There is no shared tooltip component or icon library.

---

## Requirements

1. Keep SideCard titles as-is (`CASH-SECURED PUT`, `COVERED CALL`).
2. Remove the always-visible subtitle row under each title.
3. Add a small inline info control immediately after each title (same accent-aware header row).
4. Surface the existing subtitle strings on hover via native `title`, with an accessible name (`aria-label` / `aria-describedby`) so keyboard/screen-reader users get the same text.
5. No new dependency; match existing desk monospace / muted `#4a4a6a` styling.
6. Touch only [`src/components/WheelAnalysisPanel.tsx`](../../src/components/WheelAnalysisPanel.tsx): rename `subtitle` prop to something like `hint`, render title + info control, drop the second line.

---

## Acceptance criteria

- [ ] CSP and CC SideCard headers show title + info control; no permanent subtitle line
- [ ] Hover/focus on the info control exposes the prior subtitle copy for each side
- [ ] Info control is keyboard-accessible and exposes the same explanation to assistive tech
- [ ] Visual style fits the existing panel (monospace, muted accent-adjacent header)
- [ ] No new UI dependency; no API / codegen changes
- [ ] Manual verify on Watchlist / analysis panel for both cards
- [ ] Tests / checks: visual/manual only (unit test not required); `npm run lint` / `npm test` green if run as smoke

---

## Out of scope

- Styled custom popovers or click-to-pin bubbles
- Other panels’ subtitles (`TickerDetail`, `WatchlistTickerDetail`)
- ROADMAP / NEXT_STEPS backlog cross-links (unless added later)

---

## Design notes

- Prefer a simple `ⓘ` / circled `i` control with native `title` + aria — consistent with existing LEVEL `title` hints; avoid introducing a tooltip library.
- Implementation sketch: `SideCard` props `hint: string`; header is inline title + info control; remove the second subtitle `<div>`.

---

## Completed

*Fill when status → done.*

### Summary

—

### Commits

| Hash | Message |
|------|---------|
| — | — |

PR: —

### Key changes

- —

### Verification

```bash
# after implementation
```

### Follow-ups

- —
