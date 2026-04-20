(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function openSubjectWithFilter(term) {
    if (!term) return;
    if (typeof root.navigateTo === 'function') {
      root.navigateTo('subject', 'list', term);
      return;
    }
    if (typeof root.navigateToItem === 'function') {
      root.navigateToItem('subject', term);
    }
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
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
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
    const topOptions = [5, 10, 20, 30];
    let currentTopN = Number.isFinite(Number(topN)) ? Number(topN) : 20;
    if (topOptions.indexOf(currentTopN) < 0) currentTopN = 20;
    let currentTopIndex = topOptions.indexOf(currentTopN);
    if (currentTopIndex < 0) currentTopIndex = 2;

    container.innerHTML = [
      '<div class="viz-card viz-heatmap">',
      '  <div class="viz-toolbar">',
      '    <label>Top-N:',
      '      <input type="range" id="viz-heatmap-topn" min="0" max="3" step="1" value="' + String(currentTopIndex) + '">',
      '      <span id="viz-heatmap-topn-label">' + String(currentTopN) + '</span>',
      '    </label>',
      '    <button type="button" id="viz-heatmap-export" class="related-link related-link-btn">Скачать SVG</button>',
      '  </div>',
      '  <div class="viz-svg-wrap" style="position:relative;">',
      '    <svg id="viz-heatmap-svg" width="100%" height="560" viewBox="0 0 980 560" preserveAspectRatio="xMidYMid meet"></svg>',
      '    <div id="viz-heatmap-tooltip" class="viz-tooltip" style="display:none;position:absolute;"></div>',
      '  </div>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-heatmap-svg');
    const tooltip = container.querySelector('#viz-heatmap-tooltip');
    const topNInput = container.querySelector('#viz-heatmap-topn');
    const topNLabel = container.querySelector('#viz-heatmap-topn-label');
    const exportBtn = container.querySelector('#viz-heatmap-export');
    const margin = { top: 18, right: 14, bottom: 170, left: 180 };
    const width = 980;
    const height = 560;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const rootG = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    const xAxisG = rootG.append('g').attr('class', 'x-axis').attr('transform', 'translate(0,' + innerH + ')');
    const yAxisG = rootG.append('g').attr('class', 'y-axis');
    const cellsG = rootG.append('g').attr('class', 'cells');

    function buildRows(topNValue) {
      const subjects = subjectsAll
        .slice()
        .sort(function (a, b) {
          const aLen = asArray(a && a.page_list).length;
          const bLen = asArray(b && b.page_list).length;
          return bLen - aLen;
        })
        .slice(0, topNValue);
      const subjectHeads = subjects.map(function (s) { return String((s && s.head) || ''); });
      const rows = [];
      let maxVal = 0;
      for (let y = 0; y < chapters.length; y += 1) {
        const rowFreq = cache.termFreq[y] || {};
        const chapterName = String((chapters[y] && chapters[y].name) || ('Лекция ' + (y + 1)));
        for (let x = 0; x < subjectHeads.length; x += 1) {
          const term = subjectHeads[x];
          const value = Number(rowFreq[term] || 0);
          if (value > maxVal) maxVal = value;
          rows.push({
            xKey: term,
            yKey: chapterName,
            chapterIndex: y,
            term: term,
            value: value,
          });
        }
      }
      return { rows: rows, subjects: subjectHeads, chapterNames: chapters.map(function (c, idx) {
        return String((c && c.name) || ('Лекция ' + (idx + 1)));
      }), maxVal: maxVal };
    }

    function showTooltip(event, row) {
      if (!tooltip) return;
      tooltip.style.display = 'block';
      tooltip.textContent = 'Лекция ' + (row.chapterIndex + 1) + ' · ' + row.term + ' · Упоминаний: ' + row.value;
      const hostRect = container.getBoundingClientRect();
      const x = (event && Number.isFinite(event.clientX) ? event.clientX : hostRect.left) - hostRect.left + 8;
      const y = (event && Number.isFinite(event.clientY) ? event.clientY : hostRect.top) - hostRect.top + 8;
      tooltip.style.left = x + 'px';
      tooltip.style.top = y + 'px';
    }

    function hideTooltip() {
      if (!tooltip) return;
      tooltip.style.display = 'none';
    }

    function redraw(nextTopN) {
      const built = buildRows(nextTopN);
      const x = d3.scaleBand().domain(built.subjects).range([0, innerW]).padding(0.04);
      const y = d3.scaleBand().domain(built.chapterNames).range([0, innerH]).padding(0.04);
      const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, Math.max(1, built.maxVal)]);

      xAxisG.call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-35)')
        .style('text-anchor', 'end')
        .style('font-size', '10px');
      yAxisG.call(d3.axisLeft(y))
        .selectAll('text')
        .style('font-size', '11px');

      const cellSel = cellsG.selectAll('rect').data(built.rows, function (d) {
        return d.yKey + '|' + d.xKey;
      });
      cellSel.join(
        function (enter) {
          return enter.append('rect')
            .attr('x', function (d) { return x(d.xKey); })
            .attr('y', function (d) { return y(d.yKey); })
            .attr('width', x.bandwidth())
            .attr('height', y.bandwidth())
            .attr('rx', 2)
            .attr('fill', function (d) { return color(d.value); })
            .style('cursor', 'pointer')
            .on('mousemove', function (event, d) { showTooltip(event, d); })
            .on('mouseleave', hideTooltip)
            .on('click', function (_, d) { openSubjectWithFilter(d.term); });
        },
        function (update) {
          return update
            .transition()
            .duration(180)
            .attr('x', function (d) { return x(d.xKey); })
            .attr('y', function (d) { return y(d.yKey); })
            .attr('width', x.bandwidth())
            .attr('height', y.bandwidth())
            .attr('fill', function (d) { return color(d.value); });
        },
        function (exit) {
          return exit.transition().duration(120).style('opacity', 0).remove();
        }
      );
    }

    if (topNInput) {
      topNInput.oninput = function () {
        currentTopIndex = Number(topNInput.value || 2);
        if (!Number.isFinite(currentTopIndex)) currentTopIndex = 2;
        currentTopIndex = Math.max(0, Math.min(topOptions.length - 1, currentTopIndex));
        currentTopN = topOptions[currentTopIndex];
        if (topNLabel) topNLabel.textContent = String(currentTopN);
        redraw(currentTopN);
      };
    }
    if (exportBtn) {
      exportBtn.onclick = function () {
        const svgNode = container.querySelector('#viz-heatmap-svg');
        downloadSvg(svgNode, 'viz-heatmap.svg');
      };
    }
    redraw(currentTopN);
  }

  root.VIZ_MODULES.renderHeatmapMatrix = renderHeatmapMatrix;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
