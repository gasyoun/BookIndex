// H5106 C3 — PR #294 §2 sibling sink: global error handler into status bar
// input: msg
window.onerror = function (msg) {
  statusbar.innerHTML = '<b>' + msg + '</b>';
};
