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
    if (typeof root.navigateToItem === 'function') {
      root.navigateToItem('names', head);
    }
  }

  function renderCooccurrenceGraph(container, minWeight) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3) {
      container.innerHTML = '<div class="viz-card">Graph unavailable: missing d3.</div>';
      return;
    }

    const names = asArray(root.APP_DATA && root.APP_DATA.names);
    const edgesAll = asArray(root.APP_DATA && root.APP_DATA.edges);
    const colors = (root.APP_DATA && root.APP_DATA.colors) || {};
    const categoryByName = new Map();
    for (let i = 0; i < names.length; i += 1) {
      const n = names[i] || {};
      categoryByName.set(String(n.head || ''), String(n.subcategory || 'other'));
    }

    let currentMinWeight = Number.isFinite(Number(minWeight)) ? Number(minWeight) : 10;
    if (currentMinWeight < 1) currentMinWeight = 1;

    container.innerHTML = [
      '<div class="viz-card viz-cograph">',
      '  <div class="viz-toolbar">',
      '    <label>min weight:',
      '      <input id="viz-cograph-weight" type="range" min="1" max="100" step="1" value="' + String(currentMinWeight) + '">',
      '      <span id="viz-cograph-weight-label">' + String(currentMinWeight) + '</span>',
      '    </label>',
      '  </div>',
      '  <div id="viz-cograph-legend" class="viz-legend"></div>',
      '  <svg id="viz-cograph-svg" width="100%" height="580" viewBox="0 0 980 580" preserveAspectRatio="xMidYMid meet"></svg>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-cograph-svg');
    const slider = container.querySelector('#viz-cograph-weight');
    const label = container.querySelector('#viz-cograph-weight-label');
    const legend = container.querySelector('#viz-cograph-legend');
    const width = 980;
    const height = 580;

    function buildGraph(threshold) {
      const links = edgesAll
        .map(function (e) {
          return {
            source: String(e && e.source ? e.source : ''),
            target: String(e && e.target ? e.target : ''),
            weight: Number(e && e.weight ? e.weight : 0) || 0,
          };
        })
        .filter(function (e) {
          return e.source && e.target && e.weight >= threshold;
        });

      const nodesMap = new Map();
      for (let i = 0; i < links.length; i += 1) {
        const l = links[i];
        if (!nodesMap.has(l.source)) {
          nodesMap.set(l.source, {
            id: l.source,
            subcategory: categoryByName.get(l.source) || 'other',
          });
        }
        if (!nodesMap.has(l.target)) {
          nodesMap.set(l.target, {
            id: l.target,
            subcategory: categoryByName.get(l.target) || 'other',
          });
        }
      }
      return {
        nodes: Array.from(nodesMap.values()),
        links: links,
      };
    }

    function renderLegend(nodes) {
      if (!legend) return;
      const seen = new Set();
      const rows = [];
      for (let i = 0; i < nodes.length; i += 1) {
        const key = String(nodes[i].subcategory || 'other');
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push(
          '<span class="viz-legend-item"><span class="viz-legend-dot" style="background:' +
          safeColor(colors[key], '#3a6ea5') +
          ';"></span>' +
          key +
          '</span>'
        );
      }
      legend.innerHTML = rows.join('');
    }

    function redraw(threshold) {
      const graph = buildGraph(threshold);
      renderLegend(graph.nodes);
      svg.selectAll('*').remove();

      if (!graph.nodes.length || !graph.links.length) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#888')
          .attr('font-size', 14)
          .text('Нет рёбер при текущем пороге');
        return;
      }

      const linkWidth = d3.scaleLinear()
        .domain([1, 100])
        .range([1, 8])
        .clamp(true);

      const simulation = d3.forceSimulation(graph.nodes)
        .force('link', d3.forceLink(graph.links).id(function (d) { return d.id; }).distance(90).strength(0.24))
        .force('charge', d3.forceManyBody().strength(-260))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(14));

      const links = svg.append('g')
        .attr('stroke', '#9c8a6f')
        .attr('stroke-opacity', 0.55)
        .selectAll('line')
        .data(graph.links)
        .join('line')
        .attr('stroke-width', function (d) { return linkWidth(d.weight); });

      const nodes = svg.append('g')
        .selectAll('circle')
        .data(graph.nodes)
        .join('circle')
        .attr('r', 8)
        .attr('fill', function (d) {
          return safeColor(colors[d.subcategory], '#3a6ea5');
        })
        .style('cursor', 'pointer')
        .on('dblclick', function (_, d) { openNameCard(d.id); });

      nodes.append('title').text(function (d) { return d.id; });

      const labels = svg.append('g')
        .selectAll('text')
        .data(graph.nodes)
        .join('text')
        .text(function (d) { return d.id; })
        .attr('font-size', 10)
        .attr('fill', '#4a3a2d')
        .attr('pointer-events', 'none');

      nodes.call(
        d3.drag()
          .on('start', function (event, d) {
            if (!event.active) simulation.alphaTarget(0.25).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', function (event, d) {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', function (event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

      simulation.on('tick', function () {
        links
          .attr('x1', function (d) { return d.source.x; })
          .attr('y1', function (d) { return d.source.y; })
          .attr('x2', function (d) { return d.target.x; })
          .attr('y2', function (d) { return d.target.y; });
        nodes
          .attr('cx', function (d) { return d.x; })
          .attr('cy', function (d) { return d.y; });
        labels
          .attr('x', function (d) { return d.x + 10; })
          .attr('y', function (d) { return d.y + 4; });
      });

      setTimeout(function () {
        try { simulation.stop(); } catch (_) {}
      }, 1800);
    }

    if (slider) {
      slider.oninput = function () {
        currentMinWeight = Number(slider.value || 10);
        if (label) label.textContent = String(currentMinWeight);
        redraw(currentMinWeight);
      };
    }
    redraw(currentMinWeight);
  }

  root.VIZ_MODULES.renderCooccurrenceGraph = renderCooccurrenceGraph;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
