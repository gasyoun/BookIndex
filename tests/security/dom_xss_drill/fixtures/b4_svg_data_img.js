// H5106 B4 — PR #294 §1 near-miss: data:image/svg+xml with onload into <img>
// input: dataUrl
const u = safeUrlAllowlist(dataUrl);        // sanitizer: allow-list (data:image/* permitted)
img.src = u;                                // scripts do not execute in image context
