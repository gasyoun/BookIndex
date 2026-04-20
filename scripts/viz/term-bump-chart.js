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

  function renderTermBumpChart(container, topTerms) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Bump chart unavailable: missing d3/buildVizCache.</div>';
      return;
    }
    const cache = root.buildVizCache(root.APP_DATA || {});
    const chapters = asArray(root.APP_DATA && root.APP_DATA.chapters);
    let currentTop = Number.isFinite(Number(topTerms)) ? Number(topTerms) : 15;
    if (currentTop < 5) currentTop = 5;
    if (currentTop > 30) currentTop = 30;

    container.innerHTML = [
      '<div class="viz-card viz-bump">',
      '  <div class="viz-toolbar">',
      '    <label>top terms:',
      '      <input id="viz-bump-top" type="range" min="5" max="30" step="1" value="' + String(currentTop) + '">',
      '      <span id="viz-bump-top-label">' + String(currentTop) + '</span>',
      '    </label>',
      '  </div>',
      '  <svg id="viz-bump-svg" width="100%" height="560" viewBox="0 0 980 560" preserveAspectRatio="xMidYMid meet"></svg>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-bump-svg');
    const topInput = container.querySelector('#viz-bump-top');
    const topLabel = container.querySelector('#viz-bump-top-label');
    const width = 980;
    const height = 560;
    const margin = { top: 20, right: 40, bottom: 80, left: 60 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    function totalFreq(term) {
      let sum = 0;
      for (let i = 0; i < chapters.length; i += 1) {
        const row = cache.termFreq[i] || {};
        sum += Number(row[term] || 0);
      }
      return sum;
    }

    function buildSeries(limit) {
      const rankByTerm = cache.termRankByLecture || {};
      const terms = Object.keys(rankByTerm)
        .sort(function (a, b) { return totalFreq(b) - totalFreq(a); })
        .slice(0, limit);
      const allRanks = [];
      const series = terms.map(function (term) {
        const ranks = asArray(rankByTerm[term]);
        const values = [];
        for (let i = 0; i < chapters.length; i += 1) {
          const rank = Number(ranks[i]);
          if (!Number.isFinite(rank)) continue;
          values.push({
            term: term,
            chapterIndex: i,
            rank: rank,
          });
          allRanks.push(rank);
        }
        return { term: term, values: values };
      }).filter(function (s) { return s.values.length > 1; });
      return {
        series: series,
        maxRank: allRanks.length ? d3.max(allRanks) : 1,
      };
    }

    function redraw(limit) {
      g.selectAll('*').remove();
      const built = buildSeries(limit);
      const x = d3.scalePoint()
        .domain(d3.range(chapters.length))
        .range([0, innerW]);
      const y = d3.scaleLinear()
        .domain([1, Math.max(2, built.maxRank)])
        .range([0, innerH]);
      const color = d3.scaleOrdinal(d3.schemeTableau10);

      g.append('g')
        .attr('transform', 'translate(0,' + innerH + ')')
        .call(d3.axisBottom(x).tickFormat(function (i) { return String(Number(i) + 1); }));
      g.append('g')
        .call(d3.axisLeft(y).ticks(Math.min(12, Math.max(2, built.maxRank))));

      const line = d3.line()
        .x(function (d) { return x(d.chapterIndex); })
        .y(function (d) { return y(d.rank); });

      const seriesG = g.append('g').attr('class', 'bump-series');
      const lineSel = seriesG.selectAll('.bump-line')
        .data(built.series)
        .join('path')
        .attr('class', 'bump-line')
        .attr('fill', 'none')
        .attr('stroke', function (_, i) { return color(i); })
        .attr('stroke-width', 2.1)
        .attr('d', function (d) { return line(d.values); })
        .style('cursor', 'pointer');

      const pointsG = g.append('g').attr('class', 'bump-points');
      const pointsData = [];
      for (let i = 0; i < built.series.length; i += 1) {
        const s = built.series[i];
        for (let j = 0; j < s.values.length; j += 1) {
          pointsData.push({
            term: s.term,
            chapterIndex: s.values[j].chapterIndex,
            rank: s.values[j].rank,
            color: color(i),
          });
        }
      }

      const pointSel = pointsG.selectAll('circle')
        .data(pointsData)
        .join('circle')
        .attr('cx', function (d) { return x(d.chapterIndex); })
        .attr('cy', function (d) { return y(d.rank); })
        .attr('r', 4)
        .attr('fill', function (d) { return d.color; })
        .style('cursor', 'pointer')
        .on('click', function (_, d) { openSubjectWithFilter(d.term); });

      const labels = g.append('g').selectAll('text')
        .data(built.series)
        .join('text')
        .attr('x', innerW + 6)
        .attr('y', function (d) {
          const last = d.values[d.values.length - 1];
          return y(last.rank) + 4;
        })
        .attr('fill', function (_, i) { return color(i); })
        .attr('font-size', 11)
        .text(function (d) { return d.term; });

      function highlight(term) {
        lineSel.style('opacity', function (d) { return d.term === term ? 1 : 0.1; });
        pointSel.style('opacity', function (d) { return d.term === term ? 1 : 0.1; });
        labels.style('opacity', function (d) { return d.term === term ? 1 : 0.15; });
      }
      function clearHighlight() {
        lineSel.style('opacity', 0.85);
        pointSel.style('opacity', 0.9);
        labels.style('opacity', 1);
      }

      lineSel
        .on('mouseenter', function (_, d) { highlight(d.term); })
        .on('mouseleave', clearHighlight);
      pointSel
        .on('mouseenter', function (_, d) { highlight(d.term); })
        .on('mouseleave', clearHighlight);
      clearHighlight();
    }

    if (topInput) {
      topInput.oninput = function () {
        currentTop = Number(topInput.value || 15);
        if (topLabel) topLabel.textContent = String(currentTop);
        redraw(currentTop);
      };
    }
    redraw(currentTop);
  }

  root.VIZ_MODULES.renderTermBumpChart = renderTermBumpChart;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
