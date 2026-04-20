(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
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

  function fallbackCenturyMap(entities) {
    let min = -15;
    let max = 21;
    for (let i = 0; i < entities.length; i += 1) {
      const c = Number(entities[i] && entities[i].century);
      if (!Number.isFinite(c)) continue;
      if (c < min) min = c;
      if (c > max) max = c;
    }
    return { min: min, max: max };
  }

  function renderMapTimeline(container) {
    if (!container) return;
    if (!root.L || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Map timeline unavailable: missing Leaflet/buildVizCache.</div>';
      return;
    }
    const cache = root.buildVizCache(root.APP_DATA || {});
    const entities = asArray(cache.geoEntities).filter(function (e) {
      return Number.isFinite(Number(e && e.lat)) && Number.isFinite(Number(e && e.lon));
    });

    const bounds = fallbackCenturyMap(entities);
    const sliderMin = -15;
    const sliderMax = 21;
    let currentCentury = Math.max(sliderMin, Math.min(sliderMax, Number(bounds.max)));
    const mapId = 'viz-century-map-' + String(Date.now()) + '-' + String(Math.floor(Math.random() * 1e6));

    container.innerHTML = [
      '<div class="viz-card viz-map-timeline">',
      '  <div class="viz-toolbar">',
      '    <label>Век:',
      '      <input id="viz-century-range" type="range" min="' + String(sliderMin) + '" max="' + String(sliderMax) + '" step="1" value="' + String(currentCentury) + '">',
      '      <span id="viz-century-label">' + String(currentCentury) + '</span>',
      '    </label>',
      '    <span id="viz-century-count" class="viz-muted"></span>',
      '  </div>',
      '  <div class="viz-map-canvas"><div id="' + mapId + '" style="height:520px;border:1px solid #d4c8b0;border-radius:8px;overflow:hidden;"></div></div>',
      '</div>',
    ].join('');

    const slider = container.querySelector('#viz-century-range');
    const label = container.querySelector('#viz-century-label');
    const countEl = container.querySelector('#viz-century-count');
    const map = root.L.map(mapId, { preferCanvas: true }).setView([40, 30], 3);
    const markersLayer = root.L.layerGroup().addTo(map);

    root.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 9,
      minZoom: 2,
    }).addTo(map);

    function redraw(century) {
      markersLayer.clearLayers();
      const shown = [];
      for (let i = 0; i < entities.length; i += 1) {
        const e = entities[i];
        const c = Number(e.century);
        if (!Number.isFinite(c)) continue;
        if (c !== century) continue;
        shown.push(e);
      }
      if (countEl) countEl.textContent = 'Маркеров: ' + String(shown.length);
      for (let i = 0; i < shown.length; i += 1) {
        const e = shown[i];
        const marker = root.L.circleMarker([Number(e.lat), Number(e.lon)], {
          radius: 6,
          color: '#5a3818',
          weight: 1.3,
          fillColor: '#f0b97c',
          fillOpacity: 0.9,
        }).addTo(markersLayer);
        marker.bindTooltip(
          '<strong>' + String(e.name) + '</strong><br>век: ' + String(e.century) + '<br>эпоха: ' + String(e.epoch),
          { sticky: true }
        );
        marker.on('click', function () {
          openNameCard(e.id || e.name);
        });
      }
    }

    if (slider) {
      slider.oninput = function () {
        currentCentury = Number(slider.value || currentCentury);
        if (!Number.isFinite(currentCentury)) currentCentury = sliderMax;
        if (label) label.textContent = String(currentCentury);
        redraw(currentCentury);
      };
    }
    redraw(currentCentury);
    setTimeout(function () {
      try { map.invalidateSize(); } catch (_) {}
    }, 0);
  }

  root.VIZ_MODULES.renderMapTimeline = renderMapTimeline;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
