(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function downloadSvg(svgNode, filename) {
    if (!svgNode) return;
    const serializer = new XMLSerializer();
    const src = serializer.serializeToString(svgNode);
    const blob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function openReadingForTerm(term, chapterIndex, cache) {
    const byTerm = (cache && cache.termPagesByLecture && cache.termPagesByLecture[term]) || null;
    const pages = byTerm && Array.isArray(byTerm[chapterIndex]) ? byTerm[chapterIndex] : [];
    const page = pages.length ? Number(pages[0]) : null;
    if (Number.isFinite(page)) {
      if (typeof root.openReadingNowPage === 'function') {
        root.openReadingNowPage(page);
        return;
      }
      if (typeof root.buildReadingNowHash === 'function') {
        root.location.hash = root.buildReadingNowHash(page);
        return;
      }
    }
    if (typeof root.navigateTo === 'function') {
      root.navigateTo('subject', 'list', term);
      return;
    }
    if (typeof root.navigateToItem === 'function') root.navigateToItem('subject', term);
  }

  function euclideanDistance(a, b) {
    let sum = 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i += 1) {
      const av = Number(a[i] || 0);
      const bv = Number(b[i] || 0);
      const d = av - bv;
      sum += d * d;
    }
    return Math.sqrt(sum);
  }

  function clusterVectors(vectors) {
    const leaves = vectors.map((vec, idx) => ({
      indices: [idx],
      centroid: vec.slice(),
      left: null,
      right: null,
      height: 0,
      size: 1,
    }));
    if (leaves.length <= 1) return leaves[0] || null;

    let clusters = leaves.slice();
    while (clusters.length > 1) {
      let bestI = 0;
      let bestJ = 1;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let i = 0; i < clusters.length; i += 1) {
        for (let j = i + 1; j < clusters.length; j += 1) {
          const d = euclideanDistance(clusters[i].centroid, clusters[j].centroid);
          if (d < bestDist) {
            bestDist = d;
            bestI = i;
            bestJ = j;
          }
        }
      }
      const a = clusters[bestI];
      const b = clusters[bestJ];
      const size = a.size + b.size;
      const centroid = [];
      const width = Math.max(a.centroid.length, b.centroid.length);
      for (let k = 0; k < width; k += 1) {
        const av = Number(a.centroid[k] || 0);
        const bv = Number(b.centroid[k] || 0);
        centroid[k] = ((av * a.size) + (bv * b.size)) / size;
      }
      const merged = {
        indices: a.indices.concat(b.indices),
        centroid,
        left: a,
        right: b,
        height: bestDist,
        size,
      };
      clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
      clusters.push(merged);
    }
    return clusters[0];
  }

  function flattenLeafOrder(tree, out) {
    if (!tree) return;
    if (!tree.left && !tree.right) {
      out.push(tree.indices[0]);
      return;
    }
    flattenLeafOrder(tree.left, out);
    flattenLeafOrder(tree.right, out);
  }

  function buildTreeSegments(tree, leafPosByIndex, axis) {
    if (!tree) return [];
    const segments = [];
    function walk(node) {
      if (!node) return null;
      if (!node.left && !node.right) {
        const idx = node.indices[0];
        const center = leafPosByIndex[idx];
        return { center, height: node.height || 0 };
      }
      const left = walk(node.left);
      const right = walk(node.right);
      if (!left || !right) return left || right;
      const center = (left.center + right.center) / 2;
      const h = node.height || 0;
      segments.push({
        axis,
        x0: left.center,
        x1: right.center,
        y0: left.height,
        y1: right.height,
        y: h,
      });
      return { center, height: h };
    }
    walk(tree);
    return segments;
  }

  function renderHeatmapMatrix(container, topN) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Heatmap unavailable: missing d3/buildVizCache.</div>';
      return;
    }
    const cache = root.buildVizCache(root.APP_DATA || {});
    const chapters = asArray(root.APP_DATA && root.APP_DATA.chapters);
    const subjectsAll = asArray(root.APP_DATA && root.APP_DATA.subject_index);
    const topOptions = [20, 50, 100];
    let currentTopN = Number.isFinite(Number(topN)) ? Number(topN) : 20;
    if (topOptions.indexOf(currentTopN) < 0) currentTopN = 20;
    let currentTopIndex = topOptions.indexOf(currentTopN);
    if (currentTopIndex < 0) currentTopIndex = 0;

    container.innerHTML = [
      '<div class="viz-card viz-heatmap">',
      '  <div class="viz-toolbar">',
      '    <label>Top-N:',
      `      <input type="range" id="viz-heatmap-topn" min="0" max="${String(topOptions.length - 1)}" step="1" value="${String(currentTopIndex)}">`,
      `      <span id="viz-heatmap-topn-label">${String(currentTopN)}</span>`,
      '    </label>',
      '    <button type="button" id="viz-heatmap-export" class="related-link related-link-btn">Скачать SVG</button>',
      '  </div>',
      '  <div class="viz-svg-wrap" style="position:relative;">',
      '    <svg id="viz-heatmap-svg" width="100%" height="760" viewBox="0 0 1260 760" preserveAspectRatio="xMidYMid meet"></svg>',
      '    <div id="viz-heatmap-tooltip" class="viz-tooltip" style="display:none;position:absolute;"></div>',
      '  </div>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-heatmap-svg');
    const tooltip = container.querySelector('#viz-heatmap-tooltip');
    const topNInput = container.querySelector('#viz-heatmap-topn');
    const topNLabel = container.querySelector('#viz-heatmap-topn-label');
    const exportBtn = container.querySelector('#viz-heatmap-export');

    const width = 1260;
    const height = 760;
    const margin = { top: 170, right: 24, bottom: 210, left: 270 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const dendroTopH = 120;
    const dendroLeftW = 120;

    const rootG = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const cellsG = rootG.append('g').attr('class', 'cells');
    const xAxisG = rootG.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerH})`);
    const yAxisG = rootG.append('g').attr('class', 'y-axis');
    const topDendroG = svg.append('g').attr('class', 'top-dendrogram')
      .attr('transform', `translate(${margin.left},${margin.top - dendroTopH - 12})`);
    const leftDendroG = svg.append('g').attr('class', 'left-dendrogram')
      .attr('transform', `translate(${margin.left - dendroLeftW - 12},${margin.top})`);

    function showTooltip(event, row) {
      if (!tooltip) return;
      tooltip.style.display = 'block';
      tooltip.textContent = `Лекция ${row.chapterIndex + 1} · ${row.term} · Частота: ${row.value}`;
      const hostRect = container.getBoundingClientRect();
      const x = (event && Number.isFinite(event.clientX) ? event.clientX : hostRect.left) - hostRect.left + 8;
      const y = (event && Number.isFinite(event.clientY) ? event.clientY : hostRect.top) - hostRect.top + 8;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.style.display = 'none';
    }

    function buildState(topNValue) {
      const subjects = subjectsAll
        .slice()
        .sort((a, b) => asArray(b && b.page_list).length - asArray(a && a.page_list).length)
        .slice(0, topNValue);
      const terms = subjects.map((s) => String((s && s.head) || ''));
      const chapterNames = chapters.map((c, idx) => String((c && c.name) || `Лекция ${idx + 1}`));

      const matrix = [];
      let maxVal = 0;
      for (let r = 0; r < chapterNames.length; r += 1) {
        const rowFreq = cache.termFreq[r] || {};
        const row = [];
        for (let c = 0; c < terms.length; c += 1) {
          const value = Number(rowFreq[terms[c]] || 0);
          row.push(value);
          if (value > maxVal) maxVal = value;
        }
        matrix.push(row);
      }

      const rowVectors = matrix.map((row) => row.slice());
      const colVectors = terms.map((_, colIdx) => matrix.map((row) => row[colIdx]));
      const rowTree = clusterVectors(rowVectors);
      const colTree = clusterVectors(colVectors);
      const rowOrder = [];
      const colOrder = [];
      flattenLeafOrder(rowTree, rowOrder);
      flattenLeafOrder(colTree, colOrder);
      if (!rowOrder.length) {
        for (let i = 0; i < chapterNames.length; i += 1) rowOrder.push(i);
      }
      if (!colOrder.length) {
        for (let i = 0; i < terms.length; i += 1) colOrder.push(i);
      }

      const rows = [];
      for (let yPos = 0; yPos < rowOrder.length; yPos += 1) {
        const chapterIndex = rowOrder[yPos];
        const chapterName = chapterNames[chapterIndex];
        for (let xPos = 0; xPos < colOrder.length; xPos += 1) {
          const termIndex = colOrder[xPos];
          rows.push({
            xPos,
            yPos,
            chapterIndex,
            chapterName,
            termIndex,
            term: terms[termIndex],
            value: matrix[chapterIndex][termIndex] || 0,
          });
        }
      }

      return {
        terms,
        chapterNames,
        rowOrder,
        colOrder,
        rowTree,
        colTree,
        rows,
        maxVal,
      };
    }

    function redraw(topNValue) {
      const state = buildState(topNValue);
      const orderedTerms = state.colOrder.map((idx) => state.terms[idx]);
      const orderedChapters = state.rowOrder.map((idx) => state.chapterNames[idx]);

      const x = d3.scaleBand().domain(d3.range(orderedTerms.length)).range([0, innerW]).padding(0.04);
      const y = d3.scaleBand().domain(d3.range(orderedChapters.length)).range([0, innerH]).padding(0.04);
      const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, Math.max(1, state.maxVal)]);

      xAxisG.call(
        d3.axisBottom(x).tickFormat((tick) => orderedTerms[tick] || '')
      );
      xAxisG.selectAll('text')
        .attr('transform', 'rotate(-38)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
      yAxisG.call(
        d3.axisLeft(y).tickFormat((tick) => orderedChapters[tick] || '')
      );
      yAxisG.selectAll('text').style('font-size', '11px');

      const cellSel = cellsG.selectAll('rect').data(state.rows, (d) => `${d.chapterIndex}|${d.term}`);
      cellSel.join(
        (enter) => enter.append('rect')
          .attr('x', (d) => x(d.xPos))
          .attr('y', (d) => y(d.yPos))
          .attr('width', x.bandwidth())
          .attr('height', y.bandwidth())
          .attr('rx', 2)
          .attr('fill', (d) => color(d.value))
          .style('cursor', 'pointer')
          .on('mousemove', (event, d) => showTooltip(event, d))
          .on('mouseleave', hideTooltip)
          .on('click', (_, d) => openReadingForTerm(d.term, d.chapterIndex, cache)),
        (update) => update
          .transition()
          .duration(160)
          .attr('x', (d) => x(d.xPos))
          .attr('y', (d) => y(d.yPos))
          .attr('width', x.bandwidth())
          .attr('height', y.bandwidth())
          .attr('fill', (d) => color(d.value)),
        (exit) => exit.remove()
      );

      const rowPos = {};
      for (let i = 0; i < state.rowOrder.length; i += 1) rowPos[state.rowOrder[i]] = y(i) + (y.bandwidth() / 2);
      const colPos = {};
      for (let i = 0; i < state.colOrder.length; i += 1) colPos[state.colOrder[i]] = x(i) + (x.bandwidth() / 2);

      const rowSegments = buildTreeSegments(state.rowTree, rowPos, 'row');
      const colSegments = buildTreeSegments(state.colTree, colPos, 'col');

      const maxRowHeight = Math.max(1, d3.max(rowSegments, (s) => s.y) || 1);
      const maxColHeight = Math.max(1, d3.max(colSegments, (s) => s.y) || 1);
      const rowScale = d3.scaleLinear().domain([0, maxRowHeight]).range([0, dendroLeftW - 8]);
      const colScale = d3.scaleLinear().domain([0, maxColHeight]).range([0, dendroTopH - 8]);

      const rowData = [];
      for (let i = 0; i < rowSegments.length; i += 1) {
        const seg = rowSegments[i];
        rowData.push({ kind: 'h', x1: dendroLeftW - rowScale(seg.y0), y1: seg.x0, x2: dendroLeftW - rowScale(seg.y), y2: seg.x0 });
        rowData.push({ kind: 'h', x1: dendroLeftW - rowScale(seg.y1), y1: seg.x1, x2: dendroLeftW - rowScale(seg.y), y2: seg.x1 });
        rowData.push({ kind: 'v', x1: dendroLeftW - rowScale(seg.y), y1: seg.x0, x2: dendroLeftW - rowScale(seg.y), y2: seg.x1 });
      }
      const colData = [];
      for (let i = 0; i < colSegments.length; i += 1) {
        const seg = colSegments[i];
        colData.push({ kind: 'v', x1: seg.x0, y1: dendroTopH - colScale(seg.y0), x2: seg.x0, y2: dendroTopH - colScale(seg.y) });
        colData.push({ kind: 'v', x1: seg.x1, y1: dendroTopH - colScale(seg.y1), x2: seg.x1, y2: dendroTopH - colScale(seg.y) });
        colData.push({ kind: 'h', x1: seg.x0, y1: dendroTopH - colScale(seg.y), x2: seg.x1, y2: dendroTopH - colScale(seg.y) });
      }

      leftDendroG.selectAll('*').remove();
      leftDendroG.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', dendroLeftW)
        .attr('height', innerH)
        .attr('fill', 'transparent');
      leftDendroG.selectAll('line')
        .data(rowData)
        .join('line')
        .attr('x1', (d) => d.x1)
        .attr('y1', (d) => d.y1)
        .attr('x2', (d) => d.x2)
        .attr('y2', (d) => d.y2)
        .attr('stroke', 'var(--line-strong)')
        .attr('stroke-width', 1);

      topDendroG.selectAll('*').remove();
      topDendroG.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', innerW)
        .attr('height', dendroTopH)
        .attr('fill', 'transparent');
      topDendroG.selectAll('line')
        .data(colData)
        .join('line')
        .attr('x1', (d) => d.x1)
        .attr('y1', (d) => d.y1)
        .attr('x2', (d) => d.x2)
        .attr('y2', (d) => d.y2)
        .attr('stroke', 'var(--line-strong)')
        .attr('stroke-width', 1);
    }

    if (topNInput) {
      topNInput.oninput = () => {
        currentTopIndex = Number(topNInput.value || 0);
        if (!Number.isFinite(currentTopIndex)) currentTopIndex = 0;
        currentTopIndex = Math.max(0, Math.min(topOptions.length - 1, currentTopIndex));
        currentTopN = topOptions[currentTopIndex];
        if (topNLabel) topNLabel.textContent = String(currentTopN);
        redraw(currentTopN);
      };
    }
    if (exportBtn) {
      exportBtn.onclick = () => {
        const svgNode = container.querySelector('#viz-heatmap-svg');
        downloadSvg(svgNode, 'viz-heatmap.svg');
      };
    }

    const onVisibility = () => {
      if (!document.hidden) return;
      svg.selectAll('*').interrupt();
      hideTooltip();
    };
    document.addEventListener('visibilitychange', onVisibility);
    container.__vizCleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      hideTooltip();
      svg.selectAll('*').interrupt();
    };

    redraw(currentTopN);
  }

  root.VIZ_MODULES.renderHeatmapMatrix = renderHeatmapMatrix;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
