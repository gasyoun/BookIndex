# CodeQL alert triage contract — BookIndex

_Created: 15-09-2026 · Last updated: 15-09-2026_

_Contract handoff: [H4790](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4790-Codex_BookIndex_security-alert-baseline-exploit-contract_14.09.26.md). Executor: ox-alpha (`z-ai/glm-5.3-flash`)._

Purpose: every remaining or future CodeQL runtime alert on this repo gets ONE
compact classification — baseline → source → sink → disposition → proof — and a
fixed alert is never reopened without new evidence.

## 1. Baseline (point-in-time, 2026-09-15)

**32 alerts recorded, 32 `fixed`, 0 open, 0 dismissed.** (Alert id #23 does not
exist in the code-scanning API — id gap, not a missing row.)

Evidence (re-run to refresh):

```sh
gh api repos/gasyoun/BookIndex/code-scanning/alerts --paginate \
  -q '.[] | [.number, .rule.id, .state, .fixed_at, .most_recent_instance.location.path, .most_recent_instance.location.start_line] | @tsv'
```

| Rule | Count | Sites (representative) | State |
|---|---|---|---|
| `js/xss-through-dom` | 13 | `src/runtime/entry.js:135`, `src/renderers/multimedia.js:22,46`, `pipeline/index.html:174`, artifact copies (`v3_app.js`, `aaz-index.html`) | fixed |
| `js/xss-through-exception` | 2 | `src/runtime/entry.js:135`, `v3_app.js:15171` (artifact) | fixed |
| `js/incomplete-sanitization` | 8 | `v3_app.js:3932-3935,11328` + `aaz-index.html` copies | fixed |
| `js/incomplete-url-scheme-check` | 4 | `src/runtime/core/utils.js:410,415` (`safeUrl`/`safeImageUrl`), artifact copies | fixed |
| `js/incomplete-multi-character-sanitization` | 1 | `v3_app.js:2706` (artifact) | fixed |

Fix provenance (commits, not per-alert attribution):

- `9b9692124` (#253) — nanoid CVE + first hardening of `v3_app.js` alert sites (May 2026 batch).
- `78f173284` (#294, [H4025](https://github.com/gasyoun/Uprava/blob/main/handoffs/archive/H4025-Opus_BookIndex_url-sanitiser-and-boot-xss_03.09.26.md)) — allow-list URL sanitisers (`safeUrl`, `safeImageUrl`) + boot-catch XSS sink in `src/runtime/entry.js`.
- `c3a933602` (#299, H4025 tail) — pipeline dashboard DOM assembly + `safeUrl` allow-list; last alert closed.
- `8bfe1f843` (#292, [H4013](https://github.com/gasyoun/BookIndex/blob/main/CHANGELOG.md)) — `v3_app.js` reclassified as build artifact; CodeQL config ignores artifacts so runtime findings report once, at the `src/runtime/` site.

## 2. Source → sink model (what is untrusted here)

Sources: URL hash fragment (`location.hash` routes/params), embedded app-data
manifest (`#app-data-json`) and fetched module payloads (`data/modules/*.json`),
remote video/multimedia metadata, exception messages (a failed fetch echoes its
URL; `JSON.parse` errors preview input bytes).

Sinks: `innerHTML` assignments, `href`/`src` attributes, `location` assignment,
boot-catch error panel text.

## 3. Helpers of record (never a second implementation — FINDINGS §6)

| Need | Helper | Site |
|---|---|---|
| Escape untrusted text into HTML strings | `escapeHtml` | `src/runtime/core/utils.js:148` |
| Untrusted URL into `href` | `safeUrl` (allow-list: relative, fragment, `http:`, `https:`, `mailto:`, `tel:`) | `src/runtime/core/utils.js:394` |
| Untrusted URL into image `src` | `safeImageUrl` (adds `data:image/*`, `blob:`) | `src/runtime/core/utils.js:417` |
| DOM text/assembly | `createElement`/`textContent`/`append` — not template-string `innerHTML` | C3 / H1607 rule |

## 4. Triage ladder for a NEW alert

1. **Artifact?** If the reported site is a build artifact (`v3_app.js`, `aaz-index.html`, prerendered `all/ names/ toponyms/ …` — see `.github/codeql/codeql-config.yml` `paths-ignore`), classify at the real `src/` site; if CodeQL still scans artifacts, fix the config (H4013 precedent), never the artifact by hand.
2. **Map the flow** — name the source (§2) and sink (§2) in one sentence; if you cannot, the alert is not yet understood.
3. **Disposition** — fix with a helper of record (§3) + DOM assembly; or dismiss with a written evidence quote in the alert (never silently); or a config change for artifact dupes.
4. **Prove it** — every runtime-sink fix lands with a named regression in `tests/e2e/` (safe-render or exploit form) that fails on the vulnerable pattern and passes on main. Add the row to §5.
5. **Close the loop** — verify the alert flips to `fixed` on the next CodeQL run against `main` before declaring the fix done.

**Reopen policy:** a `fixed` alert is reopened only with NEW evidence — a fresh
alert on the same rule, or a code change that reintroduces the sink. Old alert
numbers are history, not a backlog.

## 5. Regression ledger (one row per classified path)

| Date | Alert(s) | Path (source → sink) | Verdict | Proof |
|---|---|---|---|---|
| 15-09-2026 | #25 `js/xss-through-dom`, #27 `js/xss-through-exception`, #29/#30 `js/incomplete-url-scheme-check` | boot: attacker-influenced exception text (failed module fetch echoes its manifest-controlled URL; `JSON.parse` error previews attacker bytes) → boot-catch error panel in `src/runtime/entry.js:135`; plus scheme allow-list in `safeUrl`/`safeImageUrl` | **SAFE** — panel assembles via `createElement`/`textContent`, never `innerHTML`; `<img onerror>` bytes render as inert text, no element, canary `window.__pwned` never set; `javascript:`/`data:`/`vbscript:`/`file:` URLs collapse to fallback | `npx playwright test tests/e2e/security-alert-regression.spec.js` → **5 passed** (normal boot hydration control + allow-list probes + both boot-fail safe-render paths) |

## 6. Worked example — the representative classification

- **Baseline:** alerts #25/#27/#29/#30 against `main` — all `fixed` (see §1).
- **Source:** exception message; two attacker-flavored flavors reproduced in the regression — (a) module fetch 404 echoes the manifest-controlled file URL, (b) `JSON.parse` error previews embedded-manifest bytes `{"names": [ <img src=x onerror=…> …`.
- **Sink:** `src/runtime/entry.js:135` boot-catch panel (`detail.textContent = message`).
- **Exploit regression:** the payload text reaches the panel (asserted — the test would be vacuous otherwise) but stays a text node: 0 `script`/`img`/`iframe` elements, `window.__pwned` undefined.
- **Scheme regression:** `safeUrl('javascript:…')`, `'data:text/html,…'`, `'vbscript:…'`, `'file://…'` (incl. mixed case / leading space) → `'#'`; `safeImageUrl` keeps `data:image/*` + `https` + `blob` only.
- **Stop condition:** 5/5 passing on the first full run; no retries needed.
