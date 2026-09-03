# What the bundler levers actually buy — measured now that `src/runtime/` can rebuild the artifact

_Created: 03-09-2026 · Last updated: 03-09-2026_

Follow-on measurement to [H3874 (Opus 5, 🔴3 hard) — reconcile `src/runtime` with `v3_app.js` before bundler work](https://github.com/gasyoun/Uprava/blob/main/handoffs/archive/H3874-Opus_BookIndex_v3-runtime-source-parity-reconcile_02.09.26.md),
executed by Opus 5 (`claude-opus-5`).

H3874 removed the fence: `treeshake`, `minify` and code-splitting were off-limits only
because a rebuild dropped four shipped features. They were never priced. This pass prices
them, and **every configuration was verified by running the full Playwright suite against
the rebuilt runtime**, not against the committed artifact — the check
[FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §5 says a
declaration census cannot replace.

## The numbers

Raw and gzip measured directly (`zlib.gzipSync`, level 9) on `dist-runtime/v3_app.js`:

| configuration | raw | gzip | Δ gzip vs baseline build | parity gate | Playwright |
|---|---:|---:|---:|---|---|
| committed `v3_app.js` (shipped today) | 669 347 B | 158 154 B | — | — | 197/197 |
| baseline build (`minify:false`, `treeshake:false`) | 668 239 B | 155 958 B | 0 | PASS | 197/197 |
| `treeshake: true` | 668 175 B | 155 955 B | **−3 B** | PASS | 197/197 |
| `minify: true` (oxc) | 431 280 B | 120 564 B | **−35 394 B** | **FAIL** (see below) | 197/197 |
| `treeshake` + `minify` | 431 280 B | 120 564 B | −35 394 B | FAIL | not re-run — byte-identical to `minify` |
| code splitting | — | — | — | — | not available, see below |

The repo's own budget check agrees, and shows what it does to the two ceilings:

| `npm run check:perf` | runtime script (ceiling 162 000 B) | standalone HTML (ceiling 192 000 B) |
|---|---|---|
| committed artifact | 154.8 KiB gzip — 97.9 % full | 181.0 KiB gzip — 96.5 % full |
| baseline / `treeshake` build | 152.7 KiB | 178.8 KiB |
| `minify: true` | **118.0 KiB — 74.5 % full** | **143.9 KiB — 76.7 % full** |

## What each lever is worth

**`treeshake` — safe, and worth three bytes.** The lever the whole FINDINGS §3 warning was
written about is now provably harmless: 0 declarations lost, 197/197 green. It is also
pointless. That is not a surprise in hindsight — the artifact was already measured in H2586
to have **0 unreferenced functions out of 489**, so there is nothing for a tree-shaker to
find. Both halves of the old warning are retired: it will not delete features, and it will
not save anything either.

**`minify` — safe, and worth 35.4 KB gzip (22.7 %).** 197/197 green, `node --check` clean.
It roughly triples the headroom under both ceilings. It carries two real costs:

1. **It defeats the parity gate.** `minify: true` mangles top-level names, so
   `check_runtime_parity.mjs` reports 653 declarations "lost" — a gate artefact, not a
   feature loss (the suite is green). Adopting minify means the gate must compare the
   *unminified* reference build against the artifact and check the minified output some
   other way; comparing a mangled bundle by name is meaningless.
2. **It ends the artifact's readability**, which
   [vite.runtime.config.mjs](https://github.com/gasyoun/BookIndex/blob/main/vite.runtime.config.mjs)
   preserves deliberately — its comment says `minify: false` is there to "keep it highly
   readable and reviewable for the user". `v3_app.js` is committed, so every future diff of
   it would become unreadable.

I tried to buy part of the win without the mangling — `minify: { mangle: false, … }` — and
**the object form does not take effect in vite 8.2.2**: three different option objects all
produced byte-identical output of 676 418 B / 157 748 B gzip, *larger* than the plain
baseline. So on this toolchain minify is all-or-nothing.

**Code splitting — not a lever here at all.** Two mechanical facts, not a judgement:
`output.manualChunks` is rejected outright (`"output.manualChunks" cannot be used when
"output.codeSplitting" is set to false` — the IIFE lib format forces it off), and forcing
`codeSplitting: true` still emits a single 668.23 kB file, because the source contains no
dynamic `import()` boundaries to split at. Splitting would first require authoring lazy
imports and giving up the self-contained-file property that
[index.html](https://github.com/gasyoun/BookIndex/blob/main/index.html) advertises for
`aaz-index.html` — H2586's "route 2", a product decision rather than a build flag.

**Free, and separate from all three: 2.1 KiB.** The plain build is already 2 196 B gzip
smaller than the hand-maintained artifact it reproduces, because the reconciled source
formats slightly tighter. Shipping the build instead of the hand-maintained file collects
that without enabling any lever — the trade is re-adding the `console.log` scaffolding and
the three `$1` duplicates H2586 hand-removed.

## How to reproduce

```
npx vite build -c vite.runtime.config.mjs      # baseline
node scripts/check_runtime_parity.mjs --no-build --json
# then, per lever, swap the built file in and prove it on the real app:
cp dist-runtime/v3_app.js v3_app.js && npm run build
npm run check:perf && npx playwright test      # 197 tests
git checkout -- v3_app.js && npm run build     # restore
```

The swap-and-run step is the point. A build that passes the parity gate can still be broken
— that is exactly how H3874's first draft shipped a dead video-detail route past a green
gate.

## What is left for a human

Nothing here is a silent win, so nothing was applied. The open choice is whether 35.4 KB
gzip is worth a `v3_app.js` nobody can read in a diff, plus reworking the parity gate around
a mangled bundle. Recorded in
[.ai_state.md](https://github.com/gasyoun/BookIndex/blob/main/.ai_state.md) as the standing
next action.

_Dr. Mārcis Gasūns_
