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

    const params = typeof root.readVizParams === 'function' ? root.readVizParams() : new URLSearchParams();
    let currentCentury = Number(params.get('century') || 21);
    if (!Number.isFinite(currentCentury) && entities.length) {
      const sorted = entities.slice().sort((a, b) => Number(b.century) - Number(a.century));
      const picked = finiteNumber(sorted[0] && sorted[0].century);
      if (Number.isFinite(picked)) currentCentury = Math.max(8, Math.min(21, picked));
    }
    if (!Number.isFinite(currentCentury)) currentCentury = 21;
    currentCentury = Math.max(8, Math.min(21, currentCentury));

    container.innerHTML = [
      '<div class="viz-card viz-map-timeline">',
      '  <div class="viz-toolbar">',
      '    <label>Век:',
      `      <input id="viz-century-range" type="range" min="8" max="21" step="1" value="${String(currentCentury)}">`,
      `      <span id="viz-century-label">${String(currentCentury)}</span>`,
      '    </label>',
      '    <button type="button" id="viz-century-play" class="related-link related-link-btn" aria-pressed="false">Play</button>',
      '    <span id="viz-century-count" class="viz-muted"></span>',
      '  </div>',
      `  <div class="viz-map-canvas"><div id="${mapId}" class="viz-map-leaflet"></div></div>`,
      '</div>',
    ].join('');

    const slider = container.querySelector('#viz-century-range');
    const label = container.querySelector('#viz-century-label');
    const playBtn = container.querySelector('#viz-century-play');
    const countEl = container.querySelector('#viz-century-count');
    const canvas = container.querySelector('.viz-map-canvas');
    const map = root.L.map(mapId, { preferCanvas: true }).setView([46, 28], 3);
    const layer = root.L.layerGroup().addTo(map);
    const fallback = document.createElement('div');
    fallback.className = 'viz-empty-state';
    fallback.classList.add('viz-map-fallback');
    fallback.hidden = true;
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
      fallback.hidden = true;
    });
    tileLayer.on('tileerror', () => {
      tileErrors += 1;
      if (!tileLoaded && tileErrors >= 6) fallback.hidden = false;
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

    let autoplayTimer = null;
    function writeCenturyParams(autoplay) {
      if (typeof root.writeVizParams !== 'function') return;
      root.writeVizParams({
        century: currentCentury,
        autoplay: autoplay ? 1 : null,
      });
    }

    function stopAutoplay(writeState) {
      if (autoplayTimer) clearInterval(autoplayTimer);
      autoplayTimer = null;
      if (playBtn) {
        playBtn.textContent = 'Play';
        playBtn.setAttribute('aria-pressed', 'false');
      }
      if (writeState) writeCenturyParams(false);
    }

    function startAutoplay() {
      if (autoplayTimer) return;
      if (playBtn) {
        playBtn.textContent = 'Pause';
        playBtn.setAttribute('aria-pressed', 'true');
      }
      writeCenturyParams(true);
      autoplayTimer = setInterval(() => {
        const max = slider ? Number(slider.max || 21) : 21;
        if (currentCentury >= max) {
          stopAutoplay(true);
          return;
        }
        currentCentury += 1;
        if (slider) slider.value = String(currentCentury);
        if (label) label.textContent = String(currentCentury);
        redraw(currentCentury);
        writeCenturyParams(true);
      }, 800);
    }

    if (slider) {
      slider.oninput = () => {
        stopAutoplay(false);
        currentCentury = Number(slider.value || currentCentury);
        if (!Number.isFinite(currentCentury)) currentCentury = 21;
        currentCentury = Math.max(8, Math.min(21, currentCentury));
        if (label) label.textContent = String(currentCentury);
        redraw(currentCentury);
        writeCenturyParams(false);
      };
    }
    if (playBtn) {
      playBtn.onclick = () => {
        if (autoplayTimer) stopAutoplay(true);
        else startAutoplay();
      };
    }

    redraw(currentCentury);
    writeCenturyParams(params.get('autoplay') === '1');
    if (params.get('autoplay') === '1') startAutoplay();
    setTimeout(() => {
      try { map.invalidateSize(); } catch (e) {}
    }, 0);

    const onVisibility = () => {
      if (document.hidden) {
        stopAutoplay(true);
        return;
      }
      try { map.invalidateSize(); } catch (e) {}
    };
    document.addEventListener('visibilitychange', onVisibility);
    container.__vizCleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      stopAutoplay(false);
      try { map.remove(); } catch (e) {}
    };
  }

  root.VIZ_MODULES.renderMapTimeline = renderMapTimeline;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
