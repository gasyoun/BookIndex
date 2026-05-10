(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function openEntityCard(type, head) {
    if (typeof root.navigateToItem === 'function') {
      root.navigateToItem(type, head);
    }
  }

  function renderWorldMap(container) {
    if (!container) return;
    if (!root.L) {
      container.innerHTML = '<div class="viz-card">Leaflet not found.</div>';
      return;
    }

    const data = root.APP_DATA || {};
    const entities = [];
    const types = ['toponyms', 'languages', 'names', 'ethnonyms'];
    
    types.forEach(type => {
      (data[type] || []).forEach(it => {
        if (it.lat && (it.lng || it.lon)) {
          entities.push({
            id: it.head,
            type: type,
            head: it.head,
            lat: parseFloat(it.lat),
            lng: parseFloat(it.lng || it.lon),
            desc: it.description || ''
          });
        }
      });
    });

    const mapId = `viz-world-map-${Date.now()}`;
    container.innerHTML = `
      <div class="viz-card viz-world-map-shell" style="height:100%; display:flex; flex-direction:column;">
        <div class="viz-toolbar" style="padding:10px; display:flex; gap:10px; align-items:center; background:rgba(0,0,0,0.05);">
          <strong>Общая карта:</strong>
          <span class="viz-muted">${entities.length} объектов</span>
          <div style="flex:1"></div>
          <div class="map-legend" style="display:flex; gap:15px; font-size:0.8rem;">
            <span><i style="background:var(--color-orange); width:10px; height:10px; display:inline-block; border-radius:50%"></i> Топонимы</span>
            <span><i style="background:var(--color-gold); width:10px; height:10px; display:inline-block; border-radius:50%"></i> Языки</span>
          </div>
        </div>
        <div id="${mapId}" style="flex:1; width:100%; min-height:400px; background:#f0e8d8;"></div>
      </div>
    `;

    const map = root.L.map(mapId).setView([50, 30], 3);
    
    root.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const markers = root.L.layerGroup().addTo(map);

    entities.forEach(e => {
      const color = e.type === 'languages' ? 'var(--color-gold)' : 'var(--color-orange)';
      const marker = root.L.circleMarker([e.lat, e.lng], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 1,
        fillOpacity: 0.8
      }).addTo(markers);

      marker.bindTooltip(`<strong>${e.head}</strong><br><small>${e.type}</small>`, { sticky: true });
      marker.on('click', () => openEntityCard(e.type, e.head));
    });

    // Handle resize
    setTimeout(() => map.invalidateSize(), 100);
    
    container.__vizCleanup = () => {
      map.remove();
    };
  }

  root.VIZ_MODULES.renderWorldMap = renderWorldMap;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
