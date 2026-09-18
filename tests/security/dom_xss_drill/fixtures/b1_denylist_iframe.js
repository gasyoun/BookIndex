// H5106 B1 — PR #294 §1 deny-list safeUrl feeding an executing iframe sink
// input: confUrl
const u = safeUrlDenylist(confUrl);         // sanitizer: deny-list (blocks 'javascript:' prefix only)
frame.src = u;                              // 'data:text/html,<script>...' passes
