// H5106 C2 — PR #294 §2 post-fix shape: DOM assembly + textContent, same data path
// input: hash
const url = decodeURIComponent(hash.slice(1));   // SOURCE: attacker URL from hash
try {
  const res = await fetch(url);
  boot(res);
} catch (err) {
  const panel = document.createElement('div');
  panel.className = 'boot-error';
  const small = document.createElement('small');
  small.textContent = err.message;          // safe sink construction
  panel.appendChild(small);
  content.appendChild(panel);
}
