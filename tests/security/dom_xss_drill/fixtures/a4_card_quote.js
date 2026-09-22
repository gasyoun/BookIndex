// H5106 A4 — PR #141 card shell: contexts escaped, residual quote field raw
// input: card
const html = '<div class="ctx">' + escapeHtml(card.contexts) + '</div>'
  + '<blockquote>“' + card.quote + '”</blockquote>';
right.innerHTML = html;
