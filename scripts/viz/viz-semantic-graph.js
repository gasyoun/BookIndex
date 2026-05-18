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
        <div class="viz-toolbar">
          <button class="viz-btn" id="viz-reset-zoom">Сбросить зум</button>
          <span id="viz-graph-status" class="viz-semantic-status"></span>
        </div>
        <div class="viz-legend viz-semantic-legend">
          <div class="viz-semantic-legend-name">● Имена</div>
          <div class="viz-semantic-legend-lang">● Языки</div>
          <div class="viz-semantic-legend-lex">● Лексика</div>
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
