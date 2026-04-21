(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function openEntityCard(type, head) {
    if (!head) return;
    const safeType = String(type || '') === 'languages' ? 'languages' : 'names';
    if (typeof root.navigateTo === 'function') {
      root.navigateTo(safeType, 'card', head);
      return;
    }
    if (typeof root.navigateToItem === 'function') root.navigateToItem(safeType, head);
  }

  function renderCooccurrenceGraph(container, minWeight) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Graph unavailable: missing d3/buildVizCache.</div>';
      return;
    }

    const cache = root.buildVizCache(root.APP_DATA || {});
    const lectureMeta = asArray(cache.coGraphLectureMeta);
    const nodeTypeById = cache.coGraphNodeTypeById || {};
    let currentMinWeight = Number.isFinite(Number(minWeight)) ? Number(minWeight) : 2;
    if (currentMinWeight < 1) currentMinWeight = 1;
    let currentLectureId = 'all';
    let simulation = null;

    container.innerHTML = [
      '<div class="viz-card viz-cograph">',
      '  <div class="viz-toolbar">',
      '    <label>Лекция:',
      '      <select id="viz-cograph-lecture"></select>',
      '    </label>',
      '    <label>min weight:',
      `      <input id="viz-cograph-weight" type="range" min="1" max="25" step="1" value="${String(currentMinWeight)}">`,
      `      <span id="viz-cograph-weight-label">${String(currentMinWeight)}</span>`,
      '    </label>',
      '    <span id="viz-cograph-summary" class="viz-note"></span>',
      '  </div>',
      '  <div id="viz-cograph-legend" class="viz-legend"></div>',
      '  <svg id="viz-cograph-svg" width="100%" height="620" viewBox="0 0 1180 620" preserveAspectRatio="xMidYMid meet"></svg>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-cograph-svg');
    const lectureSelect = container.querySelector('#viz-cograph-lecture');
    const slider = container.querySelector('#viz-cograph-weight');
    const label = container.querySelector('#viz-cograph-weight-label');
    const legend = container.querySelector('#viz-cograph-legend');
    const summary = container.querySelector('#viz-cograph-summary');
    const width = 1180;
    const height = 620;
    const colorByType = {
      names: 'var(--color-primary)',
      languages: 'var(--color-gold)',
    };

    if (lectureSelect) {
      lectureSelect.innerHTML = [
        '<option value="all">Все лекции</option>',
        ...lectureMeta.map((l) => `<option value="${String(l.id)}">${String(l.name || `Лекция ${Number(l.index) + 1}`)}</option>`),
      ].join('');
      lectureSelect.value = 'all';
    }

    if (legend) {
      legend.innerHTML = [
        '<span class="viz-legend-item"><span class="viz-legend-dot" style="background:var(--color-primary);"></span>имена</span>',
        '<span class="viz-legend-item"><span class="viz-legend-dot" style="background:var(--color-gold);"></span>языки</span>',
      ].join('');
    }

    function getRawEdges() {
      if (currentLectureId === 'all') return asArray(cache.coGraph);
      return asArray(cache.coGraphByLecture && cache.coGraphByLecture[currentLectureId]);
    }

    function buildGraph() {
      const raw = getRawEdges();
      const links = [];
      for (let i = 0; i < raw.length; i += 1) {
        const edge = raw[i] || {};
        const source = String(edge.source || '').trim();
        const target = String(edge.target || '').trim();
        const weight = Number(edge.weight || 0);
        if (!source || !target || !Number.isFinite(weight) || weight < currentMinWeight) continue;
        const sourceType = String(edge.sourceType || nodeTypeById[source] || 'names');
        const targetType = String(edge.targetType || nodeTypeById[target] || 'names');
        links.push({ source, target, weight, sourceType, targetType });
      }
      const nodesById = new Map();
      for (let i = 0; i < links.length; i += 1) {
        const link = links[i];
        if (!nodesById.has(link.source)) nodesById.set(link.source, { id: link.source, type: link.sourceType });
        if (!nodesById.has(link.target)) nodesById.set(link.target, { id: link.target, type: link.targetType });
      }
      return {
        nodes: Array.from(nodesById.values()),
        links,
      };
    }

    function stopSimulation() {
      if (!simulation) return;
      try { simulation.stop(); } catch (e) {}
      simulation = null;
    }

    function redraw() {
      stopSimulation();
      const graph = buildGraph();
      svg.selectAll('*').remove();

      if (summary) summary.textContent = `Узлов: ${graph.nodes.length} · Рёбер: ${graph.links.length}`;

      if (!graph.nodes.length || !graph.links.length) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--muted)')
          .attr('font-size', 14)
          .text('Нет рёбер под текущие фильтры');
        return;
      }

      const linkWidth = d3.scaleLinear().domain([1, 40]).range([1, 8]).clamp(true);
      simulation = d3.forceSimulation(graph.nodes)
        .force('link', d3.forceLink(graph.links).id((d) => d.id).distance(88).strength(0.26))
        .force('charge', d3.forceManyBody().strength(-230))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(13));

      const links = svg.append('g')
        .attr('stroke', 'var(--line-strong)')
        .attr('stroke-opacity', 0.5)
        .selectAll('line')
        .data(graph.links)
        .join('line')
        .attr('stroke-width', (d) => linkWidth(d.weight));

      const nodes = svg.append('g')
        .selectAll('circle')
        .data(graph.nodes)
        .join('circle')
        .attr('r', 8)
        .attr('fill', (d) => colorByType[d.type] || 'var(--color-primary)')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.2)
        .style('cursor', 'pointer')
        .on('dblclick', (_, d) => openEntityCard(d.type, d.id));

      nodes.append('title').text((d) => d.id);

      const labels = svg.append('g')
        .selectAll('text')
        .data(graph.nodes)
        .join('text')
        .text((d) => d.id)
        .attr('font-size', 10)
        .attr('fill', 'var(--text)')
        .attr('pointer-events', 'none');

      nodes.call(
        d3.drag()
          .on('start', (event, d) => {
            if (!event.active && simulation) simulation.alphaTarget(0.2).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active && simulation) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

      simulation.on('tick', () => {
        links
          .attr('x1', (d) => d.source.x)
          .attr('y1', (d) => d.source.y)
          .attr('x2', (d) => d.target.x)
          .attr('y2', (d) => d.target.y);
        nodes
          .attr('cx', (d) => d.x)
          .attr('cy', (d) => d.y);
        labels
          .attr('x', (d) => d.x + 10)
          .attr('y', (d) => d.y + 4);
      });
    }

    if (lectureSelect) {
      lectureSelect.onchange = () => {
        currentLectureId = String(lectureSelect.value || 'all');
        redraw();
      };
    }
    if (slider) {
      slider.oninput = () => {
        currentMinWeight = Number(slider.value || 2);
        if (!Number.isFinite(currentMinWeight)) currentMinWeight = 2;
        if (label) label.textContent = String(currentMinWeight);
        redraw();
      };
    }

    const onVisibility = () => {
      if (!document.hidden) return;
      stopSimulation();
    };
    document.addEventListener('visibilitychange', onVisibility);
    container.__vizCleanup = () => {
      stopSimulation();
      document.removeEventListener('visibilitychange', onVisibility);
    };

    redraw();
  }

  root.VIZ_MODULES.renderCooccurrenceGraph = renderCooccurrenceGraph;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
