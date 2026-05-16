/**
 * @file graph.js
 * @description Graph visualizations (Names and Families)
 */

import { 
  APP_DATA, 
  nameGraphMinEdgeWeight,
  graphStrongOnly,
  setNameGraphMinEdgeWeight,
  setGraphStrongOnly,
  getCachedAggregate,
  getDataSignature,
  COLORS,
  FAMILY_COLORS
} from '../core/state.js';
import { 
  buildItemHash,
  loadScriptOnce,
  nowMs, 
  perfDebug, 
  safeColor 
} from '../utils/dom.js';

let nameGraphWorker = null;
let nameGraphWorkerBlobUrl = null;

/**
 * Render the Names Graph Panel.
 */
export function renderGraphPanel(container) {
  const t0 = nowMs();
  const edgesRaw = APP_DATA.edges || [];
  const maxEdgeWeight = edgesRaw.reduce((mx, e) => Math.max(mx, Number(e.weight) || 0), 0);
  const sliderMax = Math.max(2, Math.ceil(maxEdgeWeight * 10) / 10);
  
  const minWeightLabel = (Math.round(nameGraphMinEdgeWeight * 10) / 10).toFixed(1);

  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Граф связей имён: близость упоминаний в тексте.</p>
    <div class="graph-toolbar">
      <label class="graph-range">порог веса
        <input id="graph-min-weight" type="range" min="0" max="${sliderMax.toFixed(1)}" step="0.1" value="${minWeightLabel}">
        <strong id="graph-min-weight-value">${minWeightLabel}</strong>
      </label>
    </div>
    <div id="graph-status" class="graph-status">Вычисление раскладки...</div>
    <div id="graph-summary" class="graph-summary" aria-live="polite"></div>
    <div id="graph-stage" aria-label="Граф связей имен"></div>
    <div id="graph-tooltip" class="graph-tooltip" hidden></div>
  </div></div>`;

  const slider = document.getElementById('graph-min-weight');
  const sliderValue = document.getElementById('graph-min-weight-value');
  const status = document.getElementById('graph-status');
  const stage = document.getElementById('graph-stage');
  const W = 1200;
  const H = 620;
  
  if (slider) {
    slider.oninput = () => {
      setNameGraphMinEdgeWeight(Number(slider.value));
      if (sliderValue) sliderValue.textContent = slider.value;
      renderGraphPanel(container);
    };
  }

  if (typeof d3 === 'undefined') {
    if (status) status.textContent = 'D3.js недоступен.';
    if (status) status.textContent = 'Loading D3.js...';
    loadScriptOnce('./vendor/d3.v7.min.js')
      .then(() => {
        if (container && container.isConnected) renderGraphPanel(container);
      })
      .catch(() => {
        if (status) status.textContent = 'D3.js unavailable.';
      });
    return;
  }

  runNameGraphLayout(nameGraphMinEdgeWeight, W, H).then(layout => {
    if (!stage) return;
    status.style.display = 'none';
    const summary = document.getElementById('graph-summary');
    if (summary) {
      summary.textContent = `${layout.nodes.length} nodes, ${layout.validEdges.length} links, min weight ${minWeightLabel}`;
    }
    renderNameGraphSvg(stage, layout, W, H);
    perfDebug('render-graph-names', nowMs() - t0, `min=${nameGraphMinEdgeWeight}`);
  }).catch(err => {
    if (status) status.textContent = `Ошибка: ${err.message}`;
  });
}

async function runNameGraphLayout(minWeight, W, H) {
  const key = `${minWeight.toFixed(2)}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-names', key, async () => {
    return new Promise((resolve, reject) => {
      ensureNameGraphWorker();
      const requestId = Math.random().toString(36).slice(2);
      
      const onMsg = (e) => {
        if (e.data.requestId === requestId) {
          nameGraphWorker.removeEventListener('message', onMsg);
          if (e.data.ok) resolve(e.data.layout);
          else reject(new Error(e.data.error || 'worker failed'));
        }
      };
      nameGraphWorker.addEventListener('message', onMsg);
      nameGraphWorker.postMessage({
        requestId,
        minWeight,
        W, H,
        names: APP_DATA.names || [],
        edges: APP_DATA.edges || []
      });
    });
  });
}

function ensureNameGraphWorker() {
  if (nameGraphWorker) return;
  const script = getNameGraphWorkerScript();
  const blob = new Blob([script], { type: 'application/javascript' });
  nameGraphWorkerBlobUrl = URL.createObjectURL(blob);
  nameGraphWorker = new Worker(nameGraphWorkerBlobUrl);
}

function renderNameGraphSvg(host, layout, W, H) {
  const svg = d3.select(host).append('svg')
    .attr('viewBox', [0, 0, W, H])
    .attr('width', '100%')
    .attr('height', 'auto');

  const g = svg.append('g');

  const link = g.append('g')
    .attr('stroke', '#999')
    .attr('stroke-opacity', 0.6)
    .selectAll('line')
    .data(layout.validEdges)
    .join('line')
    .attr('x1', d => layout.nodes[layout.idx[d.source]].x)
    .attr('y1', d => layout.nodes[layout.idx[d.source]].y)
    .attr('x2', d => layout.nodes[layout.idx[d.target]].x)
    .attr('y2', d => layout.nodes[layout.idx[d.target]].y)
    .attr('stroke-width', d => Math.sqrt(d.weight));

  const node = g.append('g')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .selectAll('circle')
    .data(layout.nodes)
    .join('circle')
    .attr('class', 'name-graph-node')
    .attr('tabindex', 0)
    .attr('r', 5)
    .attr('fill', d => safeColor(COLORS[d.subcat], '#888'))
    .attr('cx', d => d.x)
    .attr('cy', d => d.y)
    .on('mouseenter focus', (event, d) => showNameGraphTooltip(event, d))
    .on('mousemove', (event, d) => showNameGraphTooltip(event, d))
    .on('mouseleave blur', hideNameGraphTooltip)
    .on('click', (event, d) => {
      event.preventDefault();
      if (typeof window !== 'undefined') window.location.hash = buildItemHash('names', d.name);
    });

  node.append('title').text(d => d.name);
}

function showNameGraphTooltip(event, node) {
  const tooltip = document.getElementById('graph-tooltip');
  if (!tooltip || !node) return;
  tooltip.hidden = false;
  tooltip.textContent = node.name;
  const x = Number(event?.clientX || 0) + 12;
  const y = Number(event?.clientY || 0) + 12;
  tooltip.style.transform = `translate(${x}px, ${y}px)`;
}

function hideNameGraphTooltip() {
  const tooltip = document.getElementById('graph-tooltip');
  if (tooltip) tooltip.hidden = true;
}

function getNameGraphWorkerScript() {
  return `
function seed(text, salt) {
  var h = (2166136261 ^ salt) >>> 0;
  for (var i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
self.onmessage = function(event) {
  var data = event.data || {};
  var requestId = data.requestId;
  try {
    var minWeight = Number(data.minWeight) || 0;
    var W = Number(data.W) || 1200;
    var H = Number(data.H) || 600;
    var names = data.names || [];
    var edges = (data.edges || []).filter(e => Number(e.weight || 0) >= minWeight);
    var connected = new Set();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    var nodes = names.filter(n => connected.has(n.head)).map(n => ({
      name: n.head,
      subcat: n.subcategory || '',
      weight: Number(n.page_list?.length || 0),
      x: W/2 + (seed(n.head+':x', 11)-0.5)*W*0.8,
      y: H/2 + (seed(n.head+':y', 23)-0.5)*H*0.8,
      vx: 0, vy: 0
    }));
    var idx = {}; nodes.forEach((n, i) => idx[n.name] = i);
    var validEdges = edges.filter(e => idx[e.source] !== undefined && idx[e.target] !== undefined);
    function step() {
      for (var i=0; i<nodes.length; i++) {
        for (var j=i+1; j<nodes.length; j++) {
          var a=nodes[i], b=nodes[j], dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy+0.01, d=Math.sqrt(d2), f=1000/d2;
          a.vx-=dx/d*f; a.vy-=dy/d*f; b.vx+=dx/d*f; b.vy+=dy/d*f;
        }
      }
      validEdges.forEach(e => {
        var a=nodes[idx[e.source]], b=nodes[idx[e.target]], dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01, f=(d-90)*0.01*Math.sqrt(e.weight||0);
        a.vx+=dx/d*f; a.vy+=dy/d*f; b.vx-=dx/d*f; b.vy-=dy/d*f;
      });
      nodes.forEach(n => {
        n.vx+=(W/2-n.x)*0.001; n.vy+=(H/2-n.y)*0.001; n.vx*=0.85; n.vy*=0.85; n.x+=n.vx; n.y+=n.vy;
        n.x=Math.max(40, Math.min(W-40, n.x)); n.y=Math.max(40, Math.min(H-40, n.y));
      });
    }
    for (var s=0; s<300; s++) step();
    self.postMessage({ requestId: requestId, ok: true, layout: { nodes, idx, validEdges } });
  } catch(e) { self.postMessage({ requestId, ok: false, error: e.message }); }
};`;
}

let familiesGraphWorker = null;
let familiesGraphWorkerBlobUrl = null;

/**
 * Render the Families Graph Panel (Canvas).
 */
export function renderFamiliesPanel(container) {
  const t0 = nowMs();
  container.innerHTML = `<div class="panel active"><div class="graph-container">
    <p class="chart-intro">Граф языков: соединены языки, упоминаемые близко в тексте. По умолчанию вес ≥ 10.</p>
    <div class="graph-filter-row"><button class="filter-chip ${graphStrongOnly ? 'active' : ''}" id="lang-strong-btn">только сильные связи (вес ≥ 50)</button></div>
    <div id="families-status" class="graph-status">Рассчитываю расположение узлов…</div>
    <canvas id="graph-canvas" width="1300" height="650"></canvas>
    <div class="legend" id="families-legend"></div></div></div>`;

  const btn = document.getElementById('lang-strong-btn');
  if (btn) {
    btn.onclick = () => {
      setGraphStrongOnly(!graphStrongOnly);
      renderFamiliesPanel(container);
    };
  }

  const canvas = document.getElementById('graph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const status = document.getElementById('families-status');

  runFamiliesGraphLayout(graphStrongOnly, W, H).then(layout => {
    if (status) status.style.display = 'none';
    renderFamiliesGraphCanvas(canvas, ctx, layout, W, H);
    perfDebug('render-graph-families', nowMs() - t0, graphStrongOnly ? 'strong' : 'all');
  }).catch(err => {
    if (status) status.textContent = `Ошибка: ${err.message}`;
  });
}

async function runFamiliesGraphLayout(strongOnly, W, H) {
  const key = `${strongOnly ? 1 : 0}:${W}x${H}:${getDataSignature()}`;
  return getCachedAggregate('graph-families', key, async () => {
    return new Promise((resolve, reject) => {
      ensureFamiliesGraphWorker();
      const requestId = Math.random().toString(36).slice(2);
      const onMsg = (e) => {
        if (e.data.requestId === requestId) {
          familiesGraphWorker.removeEventListener('message', onMsg);
          if (e.data.ok) resolve(e.data.layout);
          else reject(new Error(e.data.error || 'worker failed'));
        }
      };
      familiesGraphWorker.addEventListener('message', onMsg);
      familiesGraphWorker.postMessage({
        requestId,
        strongOnly,
        W, H,
        languages: APP_DATA.languages || [],
        edges: APP_DATA.language_edges || []
      });
    });
  });
}

function ensureFamiliesGraphWorker() {
  if (familiesGraphWorker) return;
  const script = getFamiliesGraphWorkerScript();
  const blob = new Blob([script], { type: 'application/javascript' });
  familiesGraphWorkerBlobUrl = URL.createObjectURL(blob);
  familiesGraphWorker = new Worker(familiesGraphWorkerBlobUrl);
}

function renderFamiliesGraphCanvas(canvas, ctx, layout, W, H) {
  const nodes = layout.nodes;
  const idx = layout.idx;
  const edges = layout.validEdges;

  function draw() {
    ctx.clearRect(0, 0, W, H);
    
    // Draw edges
    ctx.strokeStyle = 'rgba(150,150,150,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const e of edges) {
      const a = nodes[idx[e.source]], b = nodes[idx[e.target]];
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();

    // Draw nodes
    for (const n of nodes) {
      ctx.fillStyle = safeColor(FAMILY_COLORS[n.family], '#888');
      ctx.beginPath();
      ctx.arc(n.x, n.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  draw();
}

function getFamiliesGraphWorkerScript() {
  return `
self.onmessage = function(event) {
  var data = event.data || {};
  var requestId = data.requestId;
  try {
    var strongOnly = !!data.strongOnly;
    var W = data.W || 1300, H = data.H || 650;
    var items = data.languages || [];
    var rawEdges = data.edges || [];
    var edges = rawEdges.filter(e => (e.weight || 0) >= (strongOnly ? 50 : 10));
    var connected = new Set();
    edges.forEach(e => { connected.add(e.source); connected.add(e.target); });
    var nodes = items.filter(l => connected.has(l.head)).map(l => ({
      name: l.head, family: l.family || 'Other', x: W/2, y: H/2, vx: 0, vy: 0
    }));
    var idx = {}; nodes.forEach((n, i) => idx[n.name] = i);
    var validEdges = edges.filter(e => idx[e.source] !== undefined && idx[e.target] !== undefined);
    function step() {
      for (var i=0; i<nodes.length; i++) {
        for (var j=i+1; j<nodes.length; j++) {
          var a=nodes[i], b=nodes[j], dx=b.x-a.x, dy=b.y-a.y, d2=dx*dx+dy*dy+0.01, d=Math.sqrt(d2);
          if (d > 250) continue;
          var f = 800/d2; a.vx-=dx/d*f; a.vy-=dy/d*f; b.vx+=dx/d*f; b.vy+=dy/d*f;
        }
      }
      validEdges.forEach(e => {
        var a=nodes[idx[e.source]], b=nodes[idx[e.target]], dx=b.x-a.x, dy=b.y-a.y, d=Math.sqrt(dx*dx+dy*dy)+0.01, f=(d-60)*0.02;
        a.vx+=dx/d*f; a.vy+=dy/d*f; b.vx-=dx/d*f; b.vy-=dy/d*f;
      });
      nodes.forEach(n => {
        n.vx*=0.8; n.vy*=0.8; n.x+=n.vx; n.y+=n.vy;
        n.x=Math.max(60, Math.min(W-60, n.x)); n.y=Math.max(60, Math.min(H-60, n.y));
      });
    }
    for (var s=0; s<200; s++) step();
    self.postMessage({ requestId, ok: true, layout: { nodes, idx, validEdges } });
  } catch(e) { self.postMessage({ requestId, ok: false, error: e.message }); }
};`;
}
