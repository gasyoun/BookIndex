# Plan — BookIndex interconnection, 2026-08

_Created: 26-08-2026 · Last updated: 26-08-2026_

BookIndex's slice of the spine-interconnection programme. Programme index:
[PLAN_SPINE_INTERCONNECTION_2026H2.md](https://github.com/gasyoun/Uprava/blob/main/docs/PLAN_SPINE_INTERCONNECTION_2026H2.md).

Architecture and verification are **not** restated here (ruling F13) — they are identical for
all fourteen repos and live once in Uprava:

- [ARCHITECTURE_SPINE_INTERCONNECTION.md](https://github.com/gasyoun/Uprava/blob/main/docs/ARCHITECTURE_SPINE_INTERCONNECTION.md) — the five attachment points and the rules governing them
- [IMPLEMENTATION_SPINE_INTERCONNECTION_W1.md](https://github.com/gasyoun/Uprava/blob/main/docs/IMPLEMENTATION_SPINE_INTERCONNECTION_W1.md) — execution order, per-handoff steps, isolation, risks
- [VERIFICATION_SPINE_INTERCONNECTION.md](https://github.com/gasyoun/Uprava/blob/main/docs/VERIFICATION_SPINE_INTERCONNECTION.md) — the five gates and what "done" means

**Nothing here has executed.** The handoff below is 🟡 queued and runs only when a human
launches it.

## Why BookIndex is in scope

A Zenodo-DOI'd citable research platform at v4.15.3 with 59 authored commits in thirty days, which the coverage ledger records as a throwaway scratch workspace. That verdict permanently excludes it from edge registration and is the direct cause of its PROJECT_INTERLINKS count of 2.

## Measured baseline and target

| | Value |
|---|---|
| Wiring score, 26-08-2026 | **48** / 100 |
| Target after this plan | **62** / 100 |
| How the target is reached | +2.5 for the local FINDINGS, +8 for README hub links, ~+4 as the corrected ledger row unblocks edge registration. |

Measured by [`tools/interconnection_audit.py`](https://github.com/gasyoun/Uprava/blob/main/tools/interconnection_audit.py); full row in
[data/interconnection_audit_2026-08-26.json](https://github.com/gasyoun/Uprava/blob/main/data/interconnection_audit_2026-08-26.json);
report [AUDIT_REPO_INTERCONNECTION_2026-08-26.md](https://github.com/gasyoun/Uprava/blob/main/docs/AUDIT_REPO_INTERCONNECTION_2026-08-26.md).

The score counts artefacts, not whether they are true. It is **report-only** by ruling F2 and no
handoff closes on it — verification Gates 2 to 4 are what actually decide, and Gate 4 is read by
a human.

## Rulings that apply here

| Fork | Ruling |
|---|---|
| F9 | The BookIndex `scratch` ledger verdict is factually false and is corrected without a vote. |
| F1 | Local `FINDINGS.md` in exactly four repos; the other eight get a `CLAUDE.md` pointer line. No repo gains the other seven registries. |
| F11 | Every repo with no spine back-links gains a "How this repo is wired" README section. |

Full rulings table with every fork:
[ASK_BATCH_STAGING_REPO_INTERCONNECTION_2026-08.md](https://github.com/gasyoun/Uprava/blob/main/ASK_BATCH_STAGING_REPO_INTERCONNECTION_2026-08.md) Phase 2.

## What this plan does

1. **Prerequisite:** the sibling Uprava handoff H3574 corrects the `scratch` ledger verdict first — wiring registered against a scratch row is inconsistent (F9).
2. Create a local `FINDINGS.md` with at least **two real Zalizniakiada findings** back-filled from its own history (F1); drop it and take the pointer line if two cannot be produced.
3. Add the "How this repo is wired" README section (F11) — it has zero spine back-links today.

## Handoff

- [H3566 (Sonnet 5) — interconnect bookindex findings readme wiring](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3566-Sonnet_BookIndex_interconnect-bookindex-findings-readme-wiring_26.08.26.md) · medium · 🟡 queued

## Autonomy contract

The launching agent may create the files named above, add hub rows, open and merge its PR,
remove its worktree and close its handoff row — without asking.

It must stop and ask if a local `FINDINGS.md` cannot be given two genuine findings (the
documented fallback is to drop the file and take the pointer line, recorded not silent), if a
corpus row would carry an unmasked snapshot or quote a sample, or if a second speculative edge
becomes necessary. It must never turn the wiring score into a failing gate, commit to
`csl-orig`, or add the seven non-FINDINGS registries.

## Open @DECIDE

None. Every fork touching BookIndex was ruled in sitting 1 on 26-08-2026, so the autonomy gate
passes and nothing in the wave-1 path stalls on a human.

_Dr. Mārcis Gasūns_
