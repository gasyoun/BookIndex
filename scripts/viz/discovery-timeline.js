(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function toArray(listLike) {
    if (Array.isArray(listLike)) return listLike;
    if (!listLike) return [];
    if (typeof listLike.length === 'number') return Array.from(listLike);
    return [];
  }

  function safeColor(color, fallback) {
    const raw = String(color || '').trim();
    return raw || fallback;
  }

  function openNameCard(head) {
    if (!head) return;
    if (typeof root.navigateTo === 'function') {
      root.navigateTo('names', 'card', head);
      return;
    }
    if (typeof root.navigateToItem === 'function') {
      root.navigateToItem('names', head);
    }
  }

  function renderDiscoveryTimeline(container) {
    if (!container) return;
    if (typeof root.buildVizCache === 'function' && root.APP_DATA) {
      root.buildVizCache(root.APP_DATA);
    }
    const data = root.APP_DATA || {};
    const colors = data.colors || {};
    const chronology = asArray(data.scholar && data.scholar.chronology);
    const names = asArray(data.names);

    const items = [];
    for (let i = 0; i < chronology.length; i += 1) {
      const ev = chronology[i] || {};
      const year = Number(ev.year);
      if (!Number.isFinite(year)) continue;
      items.push({
        year,
        label: String(ev.event || ''),
        type: 'discovery',
        sub: ev.page ? ('стр. ' + String(ev.page)) : '',
      });
    }
    for (let i = 0; i < names.length; i += 1) {
      const n = names[i] || {};
      const t = String(n.subcategory || '');
      if (t !== 'linguist' && t !== 'historical') continue;
      const year = Number(n.epoch);
      if (!Number.isFinite(year)) continue;
      const chapterHint = asArray(n.chapters).join(', ');
      items.push({
        year,
        label: String(n.head || ''),
        type: t,
        sub: chapterHint,
      });
    }
    items.sort((a, b) => a.year - b.year);

    container.innerHTML = [
      '<div class="viz-card viz-timeline">',
      '  <div class="viz-toolbar">',
      '    <label><input type="checkbox" data-type="discovery" checked> discovery</label>',
      '    <label><input type="checkbox" data-type="linguist" checked> linguist</label>',
      '    <label><input type="checkbox" data-type="historical" checked> historical</label>',
      '  </div>',
      '  <div class="viz-empty" style="display:none;">Нет элементов для текущего фильтра.</div>',
      '  <div class="tl-wrap">',
      '    <div class="tl-line"></div>',
      '  </div>',
      '</div>',
    ].join('');

    const wrap = container.querySelector('.tl-wrap');
    const empty = container.querySelector('.viz-empty');
    const colorByType = {
      discovery: 'var(--primary)',
      linguist: safeColor(colors.linguist, '#3a6ea5'),
      historical: safeColor(colors.historical, '#c0392b'),
    };

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const card = document.createElement('article');
      card.className = 'tl-item';
      card.dataset.type = item.type;
      card.style.borderLeft = '4px solid ' + safeColor(colorByType[item.type], '#5a3818');
      card.innerHTML = [
        '<div class="tl-year">' + String(item.year) + '</div>',
        '<div class="tl-label">' + String(item.label || '') + '</div>',
        item.sub ? ('<div class="tl-sub">' + String(item.sub) + '</div>') : '',
      ].join('');
      if (item.type === 'linguist' || item.type === 'historical') {
        card.classList.add('clickable');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        const open = function () { openNameCard(item.label); };
        card.onclick = open;
        card.onkeydown = function (e) {
          if (!e) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            open();
          }
        };
      }
      wrap.appendChild(card);
    }

    const checkboxes = toArray(container.querySelectorAll('.viz-toolbar input[type="checkbox"]'));
    const applyFilter = function () {
      const enabled = {};
      for (let i = 0; i < checkboxes.length; i += 1) {
        const cb = checkboxes[i];
        enabled[String(cb.dataset.type || '')] = !!cb.checked;
      }
      let visibleCount = 0;
      const cards = toArray(wrap.querySelectorAll('.tl-item'));
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const type = String(card.dataset.type || '');
        const visible = !!enabled[type];
        card.style.display = visible ? '' : 'none';
        if (visible) visibleCount += 1;
      }
      if (empty) empty.style.display = visibleCount ? 'none' : '';
    };
    for (let i = 0; i < checkboxes.length; i += 1) {
      checkboxes[i].onchange = applyFilter;
    }
    applyFilter();
  }

  root.VIZ_MODULES.renderDiscoveryTimeline = renderDiscoveryTimeline;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
