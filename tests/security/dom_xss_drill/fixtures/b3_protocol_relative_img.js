// H5106 B3 — PR #294 §1 near-miss: protocol-relative URL into an image sink
// input: ref
const u = safeUrlAllowlist(ref);            // sanitizer: allow-list (protocol-relative check removed)
img.src = u;                                // load-only sink: no script execution
