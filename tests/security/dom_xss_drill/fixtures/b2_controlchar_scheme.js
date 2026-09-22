// H5106 B2 — PR #294 §1 java<TAB>script: control-char scheme bypass
// input: hash
const u = safeUrlDenylist(decodeURIComponent(hash.slice(1)));  // sanitizer: deny-list
location.href = u;                          // browser strips tab/newline from scheme
