(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeNeedle(value) {
    return String(value || '').trim().toLowerCase();
  }

  function openReadingPage(page) {
    const p = Number(page);
    if (!Number.isFinite(p)) return;
    if (typeof root.openReadingNowPage === 'function') {
      root.openReadingNowPage(p);
      return;
    }
    if (typeof root.buildReadingNowHash === 'function') {
      root.location.hash = root.buildReadingNowHash(p);
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
    const params = typeof root.readVizParams === 'function' ? root.readVizParams() : new URLSearchParams();
    let currentTop = Number.isFinite(Number(topTerms)) ? Number(topTerms) : Number(params.get('top') || 15);
    if (currentTop < 5) currentTop = 5;
    if (currentTop > 30) currentTop = 30;
    let searchNeedle = '';

    container.innerHTML = [
      '<div class="viz-card viz-bump">',
      '  <div class="viz-toolbar">',
      '    <label>top terms:',
      `      <input id="viz-bump-top" type="range" min="5" max="30" step="1" value="${String(currentTop)}">`,
      `      <span id="viz-bump-top-label">${String(currentTop)}</span>`,
      '    </label>',
      '    <label>Поиск термина:',
      '      <input id="viz-bump-search" type="text" placeholder="например: энклитика">',
      '    </label>',
      '  </div>',
      '  <svg id="viz-bump-svg" width="100%" height="560" viewBox="0 0 1180 560" preserveAspectRatio="xMidYMid meet"></svg>',
      '  <div id="viz-bump-detail" class="viz-detail viz-detail-spaced"></div>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-bump-svg');
    const topInput = container.querySelector('#viz-bump-top');
    const topLabel = container.querySelector('#viz-bump-top-label');
    const searchInput = container.querySelector('#viz-bump-search');
    const detail = container.querySelector('#viz-bump-detail');
    const width = 1180;
    const height = 560;
    const margin = { top: 20, right: 170, bottom: 80, left: 70 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    function termTotalFreq(term) {
      let sum = 0;
      for (let i = 0; i < chapters.length; i += 1) {
        const row = cache.termFreq[i] || {};
        sum += Number(row[term] || 0);
      }
      return sum;
    }

    function getVisibleTerms(limit, needle) {
      const rankByTerm = cache.termRankByLecture || {};
      const terms = Object.keys(rankByTerm).sort((a, b) => termTotalFreq(b) - termTotalFreq(a));
      const head = terms.slice(0, limit);
      if (!needle) return head;
      const bonus = terms.filter((term) => normalizeNeedle(term).includes(needle));
      const merged = head.slice();
      for (let i = 0; i < bonus.length; i += 1) {
        if (merged.indexOf(bonus[i]) >= 0) continue;
        merged.push(bonus[i]);
      }
      return merged;
    }

    function renderDetail(term, chapterIndex) {
      if (!detail) return;
      const byTerm = cache.termPagesByLecture && cache.termPagesByLecture[term];
      const pages = byTerm && Array.isArray(byTerm[chapterIndex]) ? byTerm[chapterIndex] : [];
      const chapterName = String((chapters[chapterIndex] && chapters[chapterIndex].name) || `Лекция ${chapterIndex + 1}`);
      if (!pages.length) {
        detail.innerHTML = [
          `<h4>${term}</h4>`,
          `<p>${chapterName}</p>`,
          '<p>В этой лекции нет зафиксированных страниц для выбранного термина.</p>',
        ].join('');
        return;
      }
      const links = pages.map((p) => `<a href="#" class="related-link bump-page-link" data-page="${String(p)}">стр. ${String(p)}</a>`).join(' · ');
      detail.innerHTML = [
        `<h4>${term}</h4>`,
        `<p>${chapterName}</p>`,
        `<p>Страницы в этой лекции: ${links}</p>`,
      ].join('');
      const pageLinks = Array.from(detail.querySelectorAll('.bump-page-link'));
      for (let i = 0; i < pageLinks.length; i += 1) {
        pageLinks[i].onclick = (e) => {
          if (e) e.preventDefault();
          openReadingPage(pageLinks[i].dataset.page);
        };
      }
    }

    function redraw(limit) {
      g.selectAll('*').remove();
      const rankByTerm = cache.termRankByLecture || {};
      const selectedTerms = getVisibleTerms(limit, searchNeedle);
      const series = [];
      let maxRank = 1;
      for (let i = 0; i < selectedTerms.length; i += 1) {
        const term = selectedTerms[i];
        const ranks = asArray(rankByTerm[term]);
        const values = [];
        for (let ci = 0; ci < chapters.length; ci += 1) {
          const rank = Number(ranks[ci]);
          if (!Number.isFinite(rank)) continue;
          if (rank > maxRank) maxRank = rank;
          values.push({ term, chapterIndex: ci, rank });
        }
        if (values.length > 1) series.push({ term, values });
      }
      if (!series.length) {
        g.append('text')
          .attr('x', innerW / 2)
          .attr('y', innerH / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--muted)')
          .text('Нет данных для отображения');
        detail.innerHTML = '<p>Выберите другой top-N или очистите поиск.</p>';
        return;
      }

      const x = d3.scalePoint().domain(d3.range(chapters.length)).range([0, innerW]);
      const y = d3.scaleLinear().domain([1, Math.max(2, maxRank)]).range([0, innerH]);
      const color = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3 || []));

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x).tickFormat((i) => String(Number(i) + 1)));
      g.append('g')
        .call(d3.axisLeft(y).ticks(Math.min(12, Math.max(2, maxRank))));

      const line = d3.line()
        .x((d) => x(d.chapterIndex))
        .y((d) => y(d.rank));

      const linesG = g.append('g').attr('class', 'bump-lines');
      const lineSel = linesG.selectAll('path')
        .data(series)
        .join('path')
        .attr('fill', 'none')
        .attr('stroke', (_, i) => color(i))
        .attr('stroke-width', 2.1)
        .attr('d', (d) => line(d.values))
        .style('cursor', 'pointer');

      const pointData = [];
      for (let i = 0; i < series.length; i += 1) {
        for (let j = 0; j < series[i].values.length; j += 1) {
          pointData.push({
            term: series[i].term,
            chapterIndex: series[i].values[j].chapterIndex,
            rank: series[i].values[j].rank,
            color: color(i),
          });
        }
      }
      const pointsSel = g.append('g').selectAll('circle')
        .data(pointData)
        .join('circle')
        .attr('cx', (d) => x(d.chapterIndex))
        .attr('cy', (d) => y(d.rank))
        .attr('r', 4)
        .attr('fill', (d) => d.color)
        .style('cursor', 'pointer')
        .on('click', (_, d) => renderDetail(d.term, d.chapterIndex));

      const labelRows = series
        .map((d, i) => ({
          term: d.term,
          rawY: y(d.values[d.values.length - 1].rank) + 4,
          color: color(i),
        }))
        .sort((a, b) => a.rawY - b.rawY);
      const labelGap = 13;
      for (let i = 1; i < labelRows.length; i += 1) {
        if (labelRows[i].rawY < labelRows[i - 1].rawY + labelGap) {
          labelRows[i].rawY = labelRows[i - 1].rawY + labelGap;
        }
      }
      for (let i = labelRows.length - 1; i >= 0; i -= 1) {
        if (labelRows[i].rawY > innerH) labelRows[i].rawY = innerH;
        if (i > 0 && labelRows[i - 1].rawY > labelRows[i].rawY - labelGap) {
          labelRows[i - 1].rawY = labelRows[i].rawY - labelGap;
        }
      }
      const labelYByTerm = new Map(labelRows.map((row) => [row.term, Math.max(8, Math.min(innerH, row.rawY))]));

      const labels = g.append('g').selectAll('text')
        .data(series)
        .join('text')
        .attr('x', innerW + 6)
        .attr('y', (d) => labelYByTerm.get(d.term) || 12)
        .attr('fill', (_, i) => color(i))
        .attr('font-size', 11)
        .attr('dominant-baseline', 'middle')
        .text((d) => d.term);

      function highlight(term) {
        lineSel.style('opacity', (d) => d.term === term ? 1 : 0.1);
        pointsSel.style('opacity', (d) => d.term === term ? 1 : 0.1);
        labels.style('opacity', (d) => d.term === term ? 1 : 0.15);
      }
      function clearHighlight() {
        lineSel.style('opacity', 0.88);
        pointsSel.style('opacity', 0.9);
        labels.style('opacity', 1);
      }
      lineSel
        .on('mouseenter', (_, d) => highlight(d.term))
        .on('mouseleave', clearHighlight);
      pointsSel
        .on('mouseenter', (_, d) => highlight(d.term))
        .on('mouseleave', clearHighlight);
      clearHighlight();

      renderDetail(series[0].term, series[0].values[0].chapterIndex);
    }

    if (topInput) {
      topInput.oninput = () => {
        currentTop = Number(topInput.value || 15);
        if (!Number.isFinite(currentTop)) currentTop = 15;
        if (topLabel) topLabel.textContent = String(currentTop);
        if (typeof root.writeVizParams === 'function') root.writeVizParams({ top: currentTop });
        redraw(currentTop);
      };
    }
    if (searchInput) {
      searchInput.oninput = () => {
        searchNeedle = normalizeNeedle(searchInput.value);
        if (typeof root.writeVizParams === 'function') root.writeVizParams({ filter: searchNeedle || null, top: currentTop });
        redraw(currentTop);
      };
    }

    const onVisibility = () => {
      if (!document.hidden) return;
      svg.selectAll('*').interrupt();
    };
    document.addEventListener('visibilitychange', onVisibility);
    container.__vizCleanup = () => {
      document.removeEventListener('visibilitychange', onVisibility);
      svg.selectAll('*').interrupt();
    };

    redraw(currentTop);
  }

  root.VIZ_MODULES.renderTermBumpChart = renderTermBumpChart;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
