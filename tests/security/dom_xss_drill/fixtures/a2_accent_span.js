// H5106 A2 — PR #141 renderAccentSafe mutation: text escaped, attribute value raw
// input: it
const span = '<span class="' + it.cls + '">' + escapeHtml(it.head) + '</span>';
head.innerHTML = span;
