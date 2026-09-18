// H5106 C1 — PR #294 §2 bootstrap catch: err.message echoes attacker URL into innerHTML
// input: hash
const url = decodeURIComponent(hash.slice(1));   // SOURCE: attacker URL from hash
try {
  const res = await fetch(url);
  boot(res);
} catch (err) {
  content.innerHTML = '<div class="boot-error"><h2>Ошибка запуска</h2><small>' + err.message + '</small></div>';
}
