(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function openEntityCard(type, head) {
    if (!head) return;
    const safeType = ['names', 'languages', 'toponyms', 'ethnonyms'].indexOf(String(type || '')) >= 0
      ? String(type)
      : 'names';
    if (typeof root.navigateTo === 'function') {
      root.navigateTo(safeType, 'card', head);
      return;
    }
    if (typeof root.navigateToItem === 'function') root.navigateToItem(safeType, head);
  }

  function renderMapTimeline(container) {
    if (!container) return;
    if (!root.L || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Map timeline unavailable: missing Leaflet/buildVizCache.</div>';
      return;
    }

    const cache = root.buildVizCache(root.APP_DATA || {});
    const entities = asArray(cache.geoEntities).filter((e) => {
      const century = finiteNumber(e && e.century);
      const lat = finiteNumber(e && e.lat);
      const lon = finiteNumber(e && e.lon);
      if (!Number.isFinite(century) || !Number.isFinite(lat) || !Number.isFinite(lon)) return false;
      return century >= 8 && century <= 21;
    });
    const mapId = `viz-century-map-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

    let currentCentury = 21;
    if (entities.length) {
      const sorted = entities.slice().sort((a, b) => Number(b.century) - Number(a.century));
      const picked = finiteNumber(sorted[0] && sorted[0].century);
      if (Number.isFinite(picked)) currentCentury = Math.max(8, Math.min(21, picked));
    }

    container.innerHTML = [
      '<div class="viz-card viz-map-timeline">',
      '  <div class="viz-toolbar">',
      '    <label>Век:',
      `      <input id="viz-century-range" type="range" min="8" max="21" step="1" value="${String(currentCentury)}">`,
      `      <span id="viz-century-label">${String(currentCentury)}</span>`,
      '    </label>',
      '    <span id="viz-century-count" class="viz-muted"></span>',
      '  </div>',
      `  <div class="viz-map-canvas" style="position:relative;"><div id="${mapId}" style="height:540px;border:1px solid var(--line);border-radius:8px;overflow:hidden;"></div></div>`,
      '</div>',
    ].join('');

    const slider = container.querySelector('#viz-century-range');
    const label = container.querySelector('#viz-century-label');
    const countEl = container.querySelector('#viz-century-count');
    const canvas = container.querySelector('.viz-map-canvas');
    const map = root.L.map(mapId, { preferCanvas: true }).setView([46, 28], 3);
    const layer = root.L.layerGroup().addTo(map);
    const fallback = document.createElement('div');
    fallback.className = 'viz-empty-state';
    fallback.style.position = 'absolute';
    fallback.style.right = '10px';
    fallback.style.top = '10px';
    fallback.style.maxWidth = '280px';
    fallback.style.display = 'none';
    fallback.innerHTML = '<strong>Офлайн-режим карты</strong><br>Тайлы недоступны, но маркеры и навигация работают.';
    if (canvas) canvas.appendChild(fallback);

    const tileLayer = root.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 10,
      minZoom: 2,
    });
    let tileLoaded = false;
    let tileErrors = 0;
    tileLayer.on('load', () => {
      tileLoaded = true;
      tileErrors = 0;
      fallback.style.display = 'none';
    });
    tileLayer.on('tileerror', () => {
      tileErrors += 1;
      if (!tileLoaded && tileErrors >= 6) fallback.style.display = '';
    });
    tileLayer.addTo(map);

    function markerColor(entityType) {
      if (entityType === 'languages') return 'var(--color-gold)';
      if (entityType === 'toponyms') return 'var(--color-orange)';
      if (entityType === 'ethnonyms') return 'var(--color-success)';
      return 'var(--color-primary)';
    }

    function redraw(century) {
      layer.clearLayers();
      const shown = [];
      for (let i = 0; i < entities.length; i += 1) {
        const e = entities[i];
        if (Number(e.century) !== Number(century)) continue;
        shown.push(e);
      }
      if (countEl) countEl.textContent = `Маркеров: ${shown.length}`;
      for (let i = 0; i < shown.length; i += 1) {
        const e = shown[i];
        const marker = root.L.circleMarker([Number(e.lat), Number(e.lon)], {
          radius: 6,
          color: '#fff',
          weight: 1.2,
          fillColor: markerColor(String(e.entityType || 'names')),
          fillOpacity: 0.9,
        }).addTo(layer);
        marker.bindTooltip(
          `<strong>${String(e.name)}</strong><br>век: ${String(e.century)}<br>тип: ${String(e.entityType || 'names')}`,
          { sticky: true }
        );
        marker.on('click', () => openEntityCard(e.entityType, e.id || e.name));
      }
    }

    if (slider) {
      slider.oninput = () => {
        currentCentury = Number(slider.value || currentCentury);
        if (!Number.isFinite(currentCentury)) currentCentury = 21;
        currentCentury = Math.max(8, Math.min(21, currentCentury));
        if (label) label.textContent = String(currentCentury);
        redraw(currentCentury);
      };
    }

    redraw(currentCentury);
    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) {}
    }, 0);

    const onVisibility = () => {
      if (document.hidden) return;
      try { map.invalidateSize(); } catch (e) {}
    };
    document.addEventListener('visibilitychange', onVisibility);
    container.__vizCleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      try { map.remove(); } catch (e) {}
    };
  }

  root.VIZ_MODULES.renderMapTimeline = renderMapTimeline;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
