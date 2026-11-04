# Nightly Bug Hunt — BookIndex — 04.11.2026

_Created: 04-11-2026 · Last updated: 04-11-2026_

Nightly one-repo bug hunt (MG ruling 26-09-2026: nightly, one repo, auto-fix HIGH). Scope: `src/`, `scripts/`, `tests/`, `pipeline/` code paths; vendored copies, lockfiles, node_modules and data giants skipped. Executor: GLM 5.3 (`zai-coding-plan/glm-5.3-flash`).

**Elapsed (Phase 1 hunt + Phase 2 report): ~25 min.** Phase 3 auto-fix landed as a follow-up PR on the same date.

## Ranked findings

### F1 — HIGH (crash): `build_youtube_stats.py` dies with SyntaxError under Python < 3.12

- File: [scripts/crosswalk/build_youtube_stats.py line 149](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/build_youtube_stats.py#L149)
- The conditional expression inside the f-string is split across a raw newline inside a single-quoted f-string. Under the machine-default `python3` (3.9.6) and any interpreter 3.9–3.11 this is an instant `SyntaxError: EOL while scanning string literal` — the script cannot even be imported, so the usage line in its own docstring (`python scripts/crosswalk/build_youtube_stats.py [--live]`) crashes on launch.
- Live evidence run: `python3 -m py_compile scripts/crosswalk/build_youtube_stats.py` → `SyntaxError … line 149` (exit 1) on Python 3.9.6; `/opt/homebrew/bin/python3.12 -c "import ast; ast.parse(...)"` → parses OK (PEP 701 multiline f-string expressions landed in 3.12, which is why CI's pinned 3.12 stays green). A sweep of all 150+ repo Python files found this one as the ONLY syntax failure.
- Verdict: portability crash class. Auto-fixed in this run (see Phase 3 below) — the conditional expression joined onto one line, byte-equivalent output on 3.12, py_compile green on 3.9.6.
- Related sub-note (LOW, reported only): [line 31](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/build_youtube_stats.py#L31) hardcodes a Windows fallback `ENV_PATH = Path(r"C:\Users\user\Documents\GitHub\IndologyScholars\.env")` — dead wiring on macOS/Linux (the env-var path works; the fallback can never exist there).

### F2 — MEDIUM (dead-wired broken feature): v13 modular quiz is unwired and would crash if wired

- Files: [src/core/quiz.js line 65](https://github.com/gasyoun/BookIndex/blob/main/src/core/quiz.js#L65), [src/renderers/scholar.js lines 136–151](https://github.com/gasyoun/BookIndex/blob/main/src/renderers/scholar.js#L136)
- Three broken contracts in the same feature, verified by repo-wide grep:
  1. `renderQuiz()` dereferences `level.title` / `level.questions` with no guard — any `levelId` outside 1–4 gives `const level = QUIZ_LEVELS.find(...)` → `undefined` → TypeError and a blank panel.
  2. Answer buttons emit inline `onclick="handleQuizAnswer(...)"` but `handleQuizAnswer` is defined NOWHERE in the repo (src, scripts, v3_app.js, aaz-index.html all grepped) — every click would throw `ReferenceError: handleQuizAnswer is not defined`.
  3. `renderQuiz` is called by nothing and `checkAnswer` is imported into scholar.js but never used; `scripts/bundle.js` (the only path that would ship this code into `v3_app.js`) is not wired to any npm script — the production build reads `v3_app.js` built from `src/runtime/`.
- Verdict: no production path today, so report-only per the auto-fix fence (MEDIUM). If this surface is ever revived, guard the level lookup and define `handleQuizAnswer` on `window` (or bind via `addEventListener`) first.

### F3 — LOW (dead legacy hazard): unregistered `service-worker.js` caches unversioned data modules forever

- File: [service-worker.js lines 1–44](https://github.com/gasyoun/BookIndex/blob/main/service-worker.js#L1)
- The live app registers `sw.js?v=<buildId>` ([src/runtime/legacy.js line 3000](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/legacy.js#L3000)); nothing registers `service-worker.js`. If it were ever (re)registered it would be a permanent-staleness trap: fetch handler is pure cache-first (`caches.match(request) … || fetch`), there is no `activate` handler to purge old caches, and `./data/modules/*.json` are cached WITHOUT the `?v=<build_id>` busting the live `sw.js` deliberately adds — a new deploy would never reach registered clients. The live `sw.js` was verified sound (version-busted module URLs, activate cleanup, LRU-ish FIFO trims).

### F4 — LOW (cosmetic / dead stubs, bundled)

- [src/runtime/core/utils.js line 38](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/core/utils.js#L38): duplicate object key `'\u043e': 'o'` — same value twice, harmless but a lint-class smell in a frozen map.
- [src/utils/linguistics.js line 24](https://github.com/gasyoun/BookIndex/blob/main/src/utils/linguistics.js#L24): duplicated `иями` alternative in the stemmer regex — dead branch.
- [src/utils/export.js line 46](https://github.com/gasyoun/BookIndex/blob/main/src/utils/export.js#L46): `exportCurrentCardMarkdown()` is an empty stub (`// logic to export single card...`) — a broken contract for any future caller.
- [src/utils/dom.js line 13](https://github.com/gasyoun/BookIndex/blob/main/src/utils/dom.js#L13): this `safeUrl` twin is weaker than the hardened [src/runtime/core/utils.js `safeUrl`](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/core/utils.js#L394) (accepts any string starting with `http`, e.g. `httpfoo:`; no URL parse / length cap). Not exploitable as-is (`javascript:` is still rejected), but the security policy of record names the runtime trio — this legacy twin diverges from it.

## What verified green (evidence actually run)

- `python3 -m py_compile` over every `.py` under `scripts/` (incl. `scripts/print/`, `scripts/viz/`, `scripts/crosswalk/`) + `tests/` + `runtime_test.py`: only F1 failed; all other files compile.
- `npm run check:js` → exit 0 (all 20 gated JS/MJS files parse).
- `node scripts/check_inline_styles.mjs` (`check:ui`) → `OK: checked 20 files with 0/0 inline style attributes`.
- `python3 scripts/check_encoding.py` → `[RESULT] Encoding check passed.` (v3_app.js + app_data.json).
- `python3 scripts/changelog_duplicate_bullets.py` → no duplicated entries; `python3 scripts/changelog_released_headings.py` → unchanged vs HEAD.
- Secrets sweep: no committed API keys / tokens / `.env` files in tracked paths (gitignore guards `.env*` except `.env.example`); credential-pattern grep over src/scripts/tests/package.json clean. The only key-reading code ([build_youtube_stats.py `youtube_key()`](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/build_youtube_stats.py#L34)) reads from env / external repo path, never embeds a key.
- Runtime spot-checks of the hot paths (`src/runtime/core/router.js`, `utils.js`, `data.js`, `legacy.js` storage helpers, `sw.js`): hash-route clamping, localStorage guards, module-manifest fetch error paths, SW cache lifecycle — all correctly hardened; no HIGH finding there.

## Disposition

- F1 (HIGH, code): auto-fixed this run — minimal one-line join, verified `py_compile` green on Python 3.9.6 and `ast.parse` green on 3.12; separate fix PR merged same day.
- F2–F4 (MEDIUM/LOW): report-only per the ruling; no code edits.
- No HIGH credential/infra findings → no GTD row required.

_Dr. Mārcis Gasūns_
