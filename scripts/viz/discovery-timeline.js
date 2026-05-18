(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
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
    if (typeof root.navigateToItem === 'function') root.navigateToItem('names', head);
  }

  function renderDiscoveryTimeline(container) {
    if (!container) return;
    if (typeof root.buildVizCache === 'function' && root.APP_DATA) root.buildVizCache(root.APP_DATA);

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
        label: String(ev.event || '').trim(),
        type: 'discovery',
        sub: ev.page ? (`стр. ${String(ev.page)}`) : '',
      });
    }

    for (let i = 0; i < names.length; i += 1) {
      const n = names[i] || {};
      const type = String(n.subcategory || '');
      if (type !== 'linguist' && type !== 'historical') continue;
      const year = Number(n.epoch);
      if (!Number.isFinite(year)) continue;
      const head = String(n.head || '').trim();
      if (!head) continue;
      items.push({
        year,
        label: head,
        type,
        sub: asArray(n.chapters).join(', '),
      });
    }

    const params = typeof root.readVizParams === 'function' ? root.readVizParams() : new URLSearchParams();
    const filterParam = String(params.get('filter') || '').trim();
    const activeFilters = filterParam
      ? new Set(filterParam.split(',').map((x) => x.trim()).filter(Boolean))
      : new Set(['discovery', 'linguist', 'historical']);

    items.sort((a, b) => a.year - b.year);

    container.innerHTML = [
      '<div class="viz-card viz-timeline">',
      '  <div class="viz-toolbar">',
      `    <label><input type="checkbox" data-type="discovery"${activeFilters.has('discovery') ? ' checked' : ''}> discovery</label>`,
      `    <label><input type="checkbox" data-type="linguist"${activeFilters.has('linguist') ? ' checked' : ''}> linguist</label>`,
      `    <label><input type="checkbox" data-type="historical"${activeFilters.has('historical') ? ' checked' : ''}> historical</label>`,
      '  </div>',
      '  <div class="viz-empty-state" hidden>',
      '    <strong>Ничего не выбрано.</strong><br>Включите хотя бы один фильтр (discovery, linguist, historical).',
      '  </div>',
      '  <div class="tl-wrap tl-grid">',
      '  </div>',
      '</div>',
    ].join('');

    const wrap = container.querySelector('.tl-wrap');
    const empty = container.querySelector('.viz-empty-state');
    const checkboxes = Array.from(container.querySelectorAll('.viz-toolbar input[type="checkbox"]'));
    let pendingOpenTimer = null;
    function clearPendingOpen() {
      if (!pendingOpenTimer) return;
      clearTimeout(pendingOpenTimer);
      pendingOpenTimer = null;
    }

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      const card = document.createElement('article');
      card.className = `tl-item tl-item-${item.type}`;
      card.dataset.type = item.type;
      card.innerHTML = [
        `<div class="tl-year">${String(item.year)}</div>`,
        `<div class="tl-label">${String(item.label || '')}</div>`,
        item.sub ? `<div class="tl-sub">${String(item.sub)}</div>` : '',
      ].join('');

      if (item.type === 'linguist' || item.type === 'historical') {
        card.classList.add('clickable');
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        const onOpen = () => {
          clearPendingOpen();
          card.classList.add('tl-focus');
          try {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (e) {}
          pendingOpenTimer = setTimeout(() => {
            card.classList.remove('tl-focus');
            openNameCard(item.label);
          }, 220);
        };
        card.onclick = onOpen;
        card.onkeydown = (e) => {
          if (!e) return;
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          onOpen();
        };
      }

      wrap.appendChild(card);
    }

    const applyFilter = () => {
      const enabled = {};
      for (let i = 0; i < checkboxes.length; i += 1) {
        const cb = checkboxes[i];
        enabled[String(cb.dataset.type || '')] = !!cb.checked;
      }
      const cards = Array.from(wrap.querySelectorAll('.tl-item'));
      let visibleCount = 0;
      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const type = String(card.dataset.type || '');
        const visible = !!enabled[type];
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      }
      if (empty) empty.hidden = !!visibleCount;
      if (typeof root.writeVizParams === 'function') {
        const filter = Object.keys(enabled).filter((type) => enabled[type]).join(',');
        root.writeVizParams({ filter });
      }
    };
    for (let i = 0; i < checkboxes.length; i += 1) {
      checkboxes[i].onchange = applyFilter;
    }
    applyFilter();

    const onVisibility = () => {
      if (!document.hidden) return;
      clearPendingOpen();
    };
    document.addEventListener('visibilitychange', onVisibility);
    container.__vizCleanup = () => {
      clearPendingOpen();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  root.VIZ_MODULES.renderDiscoveryTimeline = renderDiscoveryTimeline;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
