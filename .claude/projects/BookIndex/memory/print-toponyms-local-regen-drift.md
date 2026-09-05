# Local regen of print/toponyms drifts vs CI (Node 26 vs Node 24)

_Found 05-09-2026, H4051 drain session (OxAlpha/opencode, macOS, Node v26.7.0)._

Running `npm run print:toponyms:check` locally on Node 26 regenerates
`print/toponyms-map.svg`, `print/toponyms-map-c.svg` and
`print/toponyms-map-report.json` with drift against the committed (CI-green)
bytes, even on a docs-only tree:

- last-digit float jitter in metric fields (`max_link_mm …332 → …329`),
- a discrete count flip in ungated `chip_ink_overlap_pairs` (19 → 20).

CI (Ubuntu, Node 24) is byte-green on the same commit — verified on
`f9da5a34d` (all check-runs success, 05-09-2026). So: do NOT trust local
regen diffs for this lane; trust CI. If a real byte-drift investigation is
needed, run it under Node 24 (or in CI). The gated fields (`chip_ink_overlap_max`,
`chip_close_pairs`, `links_drawn`, offset percentiles) were unaffected.
