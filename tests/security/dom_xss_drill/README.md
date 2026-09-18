# H5106 — DOM XSS source-to-sink tracing drill

_Created: 18-09-2026 · Last updated: 18-09-2026_

Mutation-based review drill distilled from three merged security PRs (handoff
[H5106](https://github.com/gasyoun/Uprava/blob/main/handoffs/H5106-OxAlpha_Uprava_skill-growth-dom-xss-taint-tracing_18.09.26.md)):

- [PR #141](https://github.com/gasyoun/BookIndex/pull/141) — data-bearing `innerHTML` → textContent/DOM APIs (search/KWIC/cards)
- [PR #294](https://github.com/gasyoun/BookIndex/pull/294) — URL allow-list vs deny-list sanitizers; bootstrap `catch` sink
- [PR #299](https://github.com/gasyoun/BookIndex/pull/299) — dashboard DOM assembly (generator-side rows)

## Layout

| File | Role |
|---|---|
| [corpus.json](corpus.json) | 12 cases: family, source → transforms → sink, expected verdict, PR citation, mutation note |
| [fixtures/](fixtures/) | One restricted-kernel JS fixture per case (source/transform/sink lines) |
| [check_taint.py](check_taint.py) | `--improved` taint walker (capability-aware, context-sensitive) and `--naive` grep baseline |
| [RUNS_H5106.log](RUNS_H5106.log) | Captured canary run + the 4 goal runs |

## Run

```
python3 tests/security/dom_xss_drill/check_taint.py --improved --check   # goal gate, exit 0
python3 tests/security/dom_xss_drill/check_taint.py --naive    --check   # canary, expected exit 1
```

## Result (2026-09-18)

- **Improved method:** GOAL PASS ×4 consecutive runs — 8/8 exploitable sinks detected
  (A1, A2, A4, B1, B2, C1, C3, D1) with source→transform→sink traces; 0 safe
  near-misses labeled P1/P2 (A3 SAFE, B3/B4 INFO-P3 load-only, C2 SAFE).
- **Non-vacuous canary:** naive pattern-match method GOAL FAIL — misses B1
  (deny-list → iframe `data:text/html`) and B2 (`java<TAB>script:` scheme
  bypass via `location.href`), and false-labels safe A3 (constant string) as P1.
- The two P3 cases are context-sensitivity controls: B4's SVG data URL in an
  `<img>` is load-only, while the same payload in an iframe (B1 shape) is P1.

## Delivery (five fields)

- **Changed:** added `tests/security/dom_xss_drill/` — 12-case corpus
  (`corpus.json`), 12 fixtures, `check_taint.py` (improved taint walker +
  naive baseline), `RUNS_H5106.log`. Drill + rubric + fixtures only; no
  production code touched.
- **Unchanged:** production runtime (`src/runtime/`), dashboard generator,
  all data files, CI configuration — PRs #141/#294/#299 already fixed these
  sinks in production; this commit only adds the practice corpus and checker.
- **Checks:** `python3 check_taint.py --improved --check` → `GOAL PASS ... 8/8`,
  exit 0, four consecutive runs (see RUNS_H5106.log); naive canary →
  `GOAL FAIL ... 6/8, FP A3`, exit 1, as designed.
- **Risks:** the checker is a line-statement walker over a restricted fixture
  kernel, not a JS parser — it does not generalize to arbitrary syntax
  (interprocedural flows, `eval`, string-built property names are out of
  scope). Severity labels come from corpus ground truth; the checker
  classifies exploitable vs non-executing context, not CVSS. The C1/C2 catch
  var inherits try-flow taint conservatively (may over-taint in larger
  fixtures).
- **Inspect:** [corpus.json](corpus.json) (source map, every case cites its
  PR) and [RUNS_H5106.log](RUNS_H5106.log) (canary FAIL + 4× GOAL PASS).

_Гасунс_
