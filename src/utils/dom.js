/**
 * @file dom.js
 * @description DOM manipulation and event binding helpers
 */

export function escapeHtml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  if (url.startsWith('http') || url.startsWith('/') || url.startsWith('./')) return url;
  return '#';
}

export function bindActionWithKeyboard(el, callback) {
  if (!el) return;
  el.onclick = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    callback(e);
  };
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      callback(e);
    }
  };
}

export function announceUiMessage(msg, type = 'info') {
  if (typeof window === 'undefined') return;
  const el = document.getElementById('ui-message-toast');
  if (!el) {
    const toast = document.createElement('div');
    toast.id = 'ui-message-toast';
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.8); color: #fff; padding: 0.5rem 1.5rem;
      border-radius: 20px; z-index: 10000; font-size: 0.9rem; pointer-events: none;
      transition: opacity 0.3s; opacity: 0;
    `;
    document.body.appendChild(toast);
  }
  const toast = document.getElementById('ui-message-toast');
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

export function announceAchievement(achievement) {
  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="ach-icon">${achievement.icon}</div>
    <div class="ach-info">
      <div class="ach-title">Достижение разблокировано!</div>
      <div class="ach-name">${escapeHtml(achievement.title)}</div>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 100);
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 500);
  }, 5000);
}
