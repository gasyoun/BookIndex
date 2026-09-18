// H5106 A1 — PR #141 search head/snippet, pre-C3 mutation: raw concat, no escape
// input: q
const row = getSearchIndexRow();            // SOURCE: query-echoed index row
const frag = '<div class="hit"><mark>' + row.match + '</mark>' + row.snippet + '</div>';
head.innerHTML = frag;
