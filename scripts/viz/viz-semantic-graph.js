(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function openEntityCard(type, head) {
    if (!head) return;
    if (typeof root.navigateToItem === 'function') {
      root.navigateToItem(type, head);
      return;
    }
  }

  function renderSemanticGraph(container) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || !root.APP_DATA || !root.APP_DATA.semantic_links) {
      container.innerHTML = '<div class="viz-card">Semantic graph unavailable: missing data or d3.</div>';
      return;
    }

    const semanticData = root.APP_DATA.semantic_links;
    let simulation = null;
    let currentFocus = null;

    container.innerHTML = `
      <div class="viz-card viz-semantic-graph">
        <style>
          .viz-semantic-graph { background: #1a1a1a; color: #eee; border-radius: 12px; overflow: hidden; position: relative; }
          .viz-toolbar { position: absolute; top: 20px; left: 20px; z-index: 10; display: flex; gap: 10px; align-items: center; }
          .viz-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 5px 15px; border-radius: 20px; cursor: pointer; transition: 0.2s; font-size: 0.85rem; }
          .viz-btn:hover { background: rgba(128, 222, 234, 0.2); border-color: #80deea; }
          .viz-legend { position: absolute; bottom: 20px; right: 20px; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 8px; font-size: 0.8rem; backdrop-filter: blur(5px); }
          .node-glow { filter: drop-shadow(0 0 5px currentColor); }
          .link-line { stroke-opacity: 0.2; }
          .node-label { font-family: 'Inter', sans-serif; font-weight: 500; pointer-events: none; }
        </style>
        <div class="viz-toolbar">
          <button class="viz-btn" id="viz-reset-zoom">Сбросить зум</button>
          <span id="viz-graph-status" style="font-size: 0.8rem; opacity: 0.7;"></span>
        </div>
        <div class="viz-legend">
          <div style="color:#80deea">● Имена</div>
          <div style="color:#b388ff">● Языки</div>
          <div style="color:#26a69a">● Лексика</div>
        </div>
        <svg id="semantic-graph-svg" width="100%" height="700"></svg>
      </div>
    `;

    const svg = d3.select('#semantic-graph-svg');
    const width = container.clientWidth || 1000;
    const height = 700;
    const g = svg.append('g');

    // Zoom handling
    const zoom = d3.zoom()
      .scaleExtent([0.1, 8])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    document.getElementById('viz-reset-zoom').onclick = () => {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    };

    function buildGraphData() {
      const nodes = new Map();
      const links = [];
      const MAX_TOTAL_LINKS = 400; // Limit for performance

      // Start with a set of interesting entry points or all if small
      const heads = Object.keys(semanticData);
      
      heads.forEach(u => {
        const targets = semanticData[u];
        targets.forEach(v => {
          if (links.length >= MAX_TOTAL_LINKS) return;
          
          if (!nodes.has(u)) nodes.set(u, { id: u, type: root.findEntityTypeByHead ? root.findEntityTypeByHead(u) : 'lexicon' });
          if (!nodes.has(v.head)) nodes.set(v.head, { id: v.head, type: root.findEntityTypeByHead ? root.findEntityTypeByHead(v.head) : 'lexicon' });
          
          links.push({ source: u, target: v.head, value: v.score });
        });
      });

      return { nodes: Array.from(nodes.values()), links };
    }

    const data = buildGraphData();
    document.getElementById('viz-graph-status').textContent = `Связей: ${data.links.length}`;

    const colorMap = {
      names: '#80deea',
      languages: '#b388ff',
      lexicon: '#26a69a',
      toponyms: '#ff8a65',
      ethnonyms: '#ffd54f'
    };

    simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(20));

    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'link-line')
      .attr('stroke', '#555')
      .attr('stroke-width', d => d.value * 5);

    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    node.append('circle')
      .attr('r', 8)
      .attr('fill', d => colorMap[d.type] || '#ccc')
      .attr('class', 'node-glow')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        if (event.defaultPrevented) return;
        openEntityCard(d.type, d.id);
      });

    node.append('text')
      .attr('class', 'node-label')
      .attr('dx', 12)
      .attr('dy', '.35em')
      .text(d => d.id)
      .attr('fill', '#fff')
      .attr('font-size', '10px');

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    container.__vizCleanup = () => {
      if (simulation) simulation.stop();
    };
  }

  root.VIZ_MODULES.renderSemanticGraph = renderSemanticGraph;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
