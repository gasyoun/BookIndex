/**
 * @file geo.js
 * @description Map visualizations (Toponyms, Ethnonyms, Languages)
 */

import { 
  currentEntity, 
  selectedItem, 
  selectedItemType, 
  APP_DATA,
  EPOCH_LABELS,
  EPOCH_COLORS,
  FAMILY_COLORS
} from '../core/state.js';
import { 
  escapeHtml, 
  loadScriptOnce,
  safeColor
} from '../utils/dom.js';

/**
 * Render the Map Panel.
 */
export function renderMapPanel(container) {
  const type = currentEntity;
  const selectedHeadForMap = selectedItemType === type ? String(selectedItem || '').trim() : '';
  let note, items, colorFn, radiusFn;
  
  if (type === 'toponyms') {
    note = 'Топонимы лекций на карте мира. Размер точки — число упоминаний; цвет — историческая эпоха.';
    items = (APP_DATA.toponyms || []).filter(t => Number.isFinite(t.lat));
    colorFn = t => safeColor(EPOCH_COLORS[t.epoch_class], '#888');
    radiusFn = t => 4 + Math.sqrt((t.page_list || []).length) * 1.5;
  } else if (type === 'ethnonyms') {
    note = 'Народы, упоминаемые в лекциях. Размер — число упоминаний.';
    items = (APP_DATA.ethnonyms || []).filter(t => Number.isFinite(t.lat));
    colorFn = t => (t.discussed ? '#c0392b' : '#3a6ea5');
    radiusFn = t => 4 + Math.sqrt((t.page_list || []).length) * 1.5;
  } else if (type === 'languages') {
    note = 'Языки на карте мира. Цвет — языковая семья. Размер — число упоминаний.';
    items = (APP_DATA.languages || []).filter(t => Number.isFinite(t.lat));
    colorFn = l => safeColor(FAMILY_COLORS[l.family], '#888');
    radiusFn = l => 4 + Math.sqrt((l.page_list || []).length) * 1.3;
  } else {
    note = 'Карта'; items = []; colorFn = () => '#888'; radiusFn = () => 6;
  }

  container.innerHTML = `<div class="panel active"><div class="map-container">
    <p class="chart-intro">${note}</p>
    <div id="leaflet-map" class="leaflet-map-host"></div>
  </div></div>`;

  if (typeof L === 'undefined') {
    const mapEl = document.getElementById('leaflet-map');
    if (mapEl) mapEl.textContent = 'Loading map...';
    loadScriptOnce('./vendor/leaflet.js')
      .then(() => {
        if (container && container.isConnected) renderMapPanel(container);
      })
      .catch(() => renderOfflineMap(mapEl, items, colorFn, radiusFn, selectedHeadForMap));
    return;
  }

  // Initialize Leaflet
  setTimeout(() => {
    const mapEl = document.getElementById('leaflet-map');
    if (!mapEl) return;
    
    try {
      const map = L.map('leaflet-map').setView([40, 30], 3);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO'
      }).addTo(map);

      items.forEach(it => {
        const isFocused = selectedHeadForMap && String(it.head || '') === selectedHeadForMap;
        const marker = L.circleMarker([it.lat, it.lon], {
          radius: radiusFn(it),
          color: isFocused ? '#1f2933' : 'white',
          weight: isFocused ? 2.5 : 1.5,
          fillColor: colorFn(it),
          fillOpacity: 0.8,
        }).addTo(map);
        
        marker.bindTooltip(`<strong>${escapeHtml(it.head)}</strong>`, { sticky: true });
      });
    } catch (e) {
      console.error('Leaflet error', e);
      renderOfflineMap(mapEl, items, colorFn, radiusFn, selectedHeadForMap);
    }
  }, 50);
}

function renderOfflineMap(container, items, colorFn, radiusFn, selectedHead) {
  if (!container) return;
  const W = 1100, H = 600;
  function project(lat, lon) {
    const x = ((lon + 180) / 360) * W;
    const y = ((85 - lat) / 145) * H;
    return [x, y];
  }
  
  let svg = `<svg class="offline-map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  items.forEach(it => {
    const [x, y] = project(it.lat, it.lon);
    const isFocused = selectedHead && String(it.head || '') === selectedHead;
    svg += `<circle cx="${x}" cy="${y}" r="${radiusFn(it)}" fill="${colorFn(it)}" fill-opacity="0.7" stroke="${isFocused ? '#000' : '#fff'}" stroke-width="${isFocused ? 2 : 1}">
      <title>${escapeHtml(it.head)}</title>
    </circle>`;
  });
  svg += '</svg>';
  container.innerHTML = svg;
}
