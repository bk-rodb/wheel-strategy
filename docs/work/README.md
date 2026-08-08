# Work items — features, enhancements, bugs

Living change log for planned and shipped work. Each item is one markdown file; the series is the source of truth for *why* we built something, *what* we accepted, and *what* landed.

Roadmap priority still lives in [NEXT_STEPS.md](../NEXT_STEPS.md). Defect findings from the July review stay in [CODE_REVIEW.md](../CODE_REVIEW.md). This folder is for **product/engineering change records** going forward.

---

## Naming

```
{TYPE}-{NNN} - {Short title}.md
```

| Prefix | Meaning | Use when |
|--------|---------|----------|
| `F` | Feature | New capability the desk did not have |
| `E` | Enhancement | Improve or rework existing behavior |
| `B` | Bug | Defect fix (prod or known incorrect behavior) |

- Zero-pad the number to three digits (`001`, `002`, …).
- Numbers are **per-prefix** (there can be both `F-001` and `E-001`).
- Title is Title Case, imperative or noun phrase, ≤ ~60 chars.
- Filename matches the title exactly (spaces and hyphen as shown).

**Examples**

- `F-001 - Paper trade journal export.md`
- `E-001 - Update strike decision engine.md`
- `B-001 - Mock order cancel never reaches canceled.md`

---

## Lifecycle

1. **Plan** — Before (or at the start of) implementation, create the file from [`_TEMPLATE.md`](./_TEMPLATE.md). Capture the user prompt, derived requirements, and acceptance criteria. Status: `planned` or `in-progress`.
2. **Implement** — Keep the file updated if scope or ACs change mid-flight.
3. **Complete** — When the work ships (usually on commit), fill **Completed**, list commits/PRs, key files touched, and any follow-ups. Status: `done`. If abandoned: `cancelled` with reason.
4. **Index** — Add a row to the [Index](#index) table below when creating or closing an item.

Agents and humans: create the work file **when the work is planned**, not as an afterthought after merge.

---

## Status values

| Status | Meaning |
|--------|---------|
| `planned` | Specced; not started |
| `in-progress` | Active implementation |
| `done` | Merged / shipped; completion section filled |
| `cancelled` | Will not ship; reason recorded |

---

## Index

| ID | Title | Status | Opened | Closed | Commits |
|----|-------|--------|--------|--------|---------|
| [E-001](./E-001%20-%20Update%20strike%20decision%20engine.md) | Update strike decision engine | done | 2026-08-08 | 2026-08-08 | `0adfe86` |
| [E-002](./E-002%20-%20Multi-Source%20Decision%20Engine.md) | Multi-Source Decision Engine | planned | 2026-08-08 | — | — |
| [E-003](./E-003%20-%20Harden%20Order%20Flow.md) | Harden Order Flow | done | 2026-08-08 | 2026-08-08 | `428cbe7` |
| [F-001](./F-001%20-%20Trade%20Retrospective%20Learning.md) | Trade Retrospective Learning | done | 2026-08-08 | 2026-08-08 | `a757f43` |

---

## Related knowledge base (recommended series)

Keep these **separate** from work items so ADRs and runbooks are not buried inside ticket files.

| Series | Path | Persist when… |
|--------|------|----------------|
| **Architecture decisions (ADR)** | `docs/adr/ADR-NNN - Title.md` | Choosing among non-obvious designs (proxy allowlist, mock vs live, HMM in strike path, etc.) |
| **Construction notes** | `docs/construction/` | Non-obvious gotchas that will bite the next agent (Alpaca GET + Content-Type, OpenAPI numeric unions, vitest drive-letter, order acceptance ≠ fill) |
| **Runbooks** | `docs/runbooks/` | Operational procedures (paper→live cutover, secret rotation, bot dry-run checklist, cache reset) |
| **Contracts / API notes** | Work item + OpenAPI | Schema changes stay in DTOs + `npm run gen:api`; narrative “why this field exists” can live in the work item or a short ADR |
| **Glossary** | `docs/GLOSSARY.md` | Desk terms that confuse (CSP/CC, DTE, OSI, empirical vs BS assignment, LOW/MED/HIGH vs safe/regular/risky) |
| **Incident / postmortem** | `docs/incidents/` | Wrong orders, bad data, outages — blameless, with detection → fix → prevention |
| **Experiment / backtest notes** | `docs/research/` | Strike-rule experiments, parameter sweeps, “we tried X and rejected it because…” |

Existing anchors to link from work items instead of duplicating:

- Setup: [PRE_LAUNCH.md](../PRE_LAUNCH.md) · [LAUNCH.md](../LAUNCH.md) · [BOT.md](../BOT.md)
- Product gaps: [trading-desk-gaps.md](../trading-desk-gaps.md) · [trading-desk-outline.md](../trading-desk-outline.md)
- Remediation history: [NEXT_STEPS.md](../NEXT_STEPS.md) · [CODE_REVIEW.md](../CODE_REVIEW.md)

---

## What to put in a work item (checklist)

**At create time**

- [ ] Verbatim (or lightly cleaned) user prompt
- [ ] Type + short title + status
- [ ] Derived requirements / acceptance criteria (testable)
- [ ] Out of scope (explicit non-goals)
- [ ] Related docs / prior work items / CODE_REVIEW IDs

**At completion**

- [ ] Summary of what changed (why, not a file dump)
- [ ] Commit hash(es) and PR URL if any
- [ ] Key files / API contract impact
- [ ] How to verify (commands or manual checks)
- [ ] Follow-ups / leftover debt
- [ ] Index row updated
