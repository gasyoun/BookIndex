(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function renderLangChord(container, minVal) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Chord unavailable: missing d3/buildVizCache.</div>';
      return;
    }

    const cache = root.buildVizCache(root.APP_DATA || {});
    const topLangs = asArray(cache.topLangs);
    const matrixByName = cache.langCoMatrix || {};
    const langFreq = cache.langFreq || {};
    let currentMinFreq = Number.isFinite(Number(minVal)) ? Number(minVal) : 20;
    if (currentMinFreq < 0) currentMinFreq = 0;
    const hidden = new Set();

    container.innerHTML = [
      '<div class="viz-card viz-chord">',
      '  <div class="viz-toolbar">',
      '    <label>min frequency:',
      `      <input id="viz-chord-min" type="range" min="0" max="120" step="1" value="${String(currentMinFreq)}">`,
      `      <span id="viz-chord-min-label">${String(currentMinFreq)}</span>`,
      '    </label>',
      '    <span id="viz-chord-summary" class="viz-note"></span>',
      '  </div>',
      '  <div id="viz-chord-legend" class="viz-legend"></div>',
      '  <svg id="viz-chord-svg" width="100%" height="700" viewBox="0 0 980 700" preserveAspectRatio="xMidYMid meet"></svg>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-chord-svg');
    const slider = container.querySelector('#viz-chord-min');
    const label = container.querySelector('#viz-chord-min-label');
    const summary = container.querySelector('#viz-chord-summary');
    const legend = container.querySelector('#viz-chord-legend');
    const width = 980;
    const height = 700;
    const outerRadius = Math.min(width, height) * 0.42;
    const innerRadius = outerRadius - 22;
    const color = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3 || []));

    function getActiveLangs() {
      return topLangs.filter((lang) => {
        const freq = Number(langFreq[lang] || 0);
        if (freq < currentMinFreq) return false;
        if (hidden.has(lang)) return false;
        return true;
      });
    }

    function buildMatrix(langs) {
      const matrix = [];
      for (let i = 0; i < langs.length; i += 1) {
        const row = [];
        for (let j = 0; j < langs.length; j += 1) {
          if (i === j) {
            row.push(0);
            continue;
          }
          const v = Number(((matrixByName[langs[i]] || {})[langs[j]]) || 0);
          row.push(v);
        }
        matrix.push(row);
      }
      return matrix;
    }

    function renderLegend(activeLangs) {
      if (!legend) return;
      legend.innerHTML = topLangs.map((lang, idx) => {
        const isActive = activeLangs.indexOf(lang) >= 0;
        const disabledByFreq = Number(langFreq[lang] || 0) < currentMinFreq;
        const inactive = !isActive;
        const title = `${lang} · freq ${Number(langFreq[lang] || 0)}`;
        const suffix = disabledByFreq ? ' (ниже порога)' : '';
        return [
          `<span class="viz-legend-item toggleable${inactive ? ' inactive' : ''}" data-lang="${lang}" title="${title}">`,
          `  <span class="viz-legend-dot" style="background:${color(idx)};"></span>${lang}${suffix}`,
          '</span>',
        ].join('');
      }).join('');
      const items = Array.from(legend.querySelectorAll('.viz-legend-item.toggleable[data-lang]'));
      for (let i = 0; i < items.length; i += 1) {
        const el = items[i];
        el.onclick = () => {
          const lang = String(el.dataset.lang || '');
          if (!lang) return;
          if (hidden.has(lang)) hidden.delete(lang);
          else hidden.add(lang);
          redraw();
        };
      }
    }

    function redraw() {
      svg.selectAll('*').remove();
      const langs = getActiveLangs();
      renderLegend(langs);
      if (summary) summary.textContent = `Языков: ${langs.length}`;

      if (langs.length < 2) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--muted)')
          .text('Недостаточно языков после фильтрации');
        return;
      }

      const matrix = buildMatrix(langs);
      const total = matrix.reduce((acc, row) => acc + row.reduce((x, y) => x + y, 0), 0);
      if (!total) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--muted)')
          .text('Нет связей между выбранными языками');
        return;
      }

      const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
      const chord = d3.chord().padAngle(0.04).sortSubgroups(d3.descending)(matrix);
      const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
      const ribbon = d3.ribbon().radius(innerRadius);

      const group = g.append('g').selectAll('g').data(chord.groups).join('g');
      group.append('path')
        .attr('d', arc)
        .attr('fill', (d) => color(d.index))
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.2);

      group.append('text')
        .each((d) => { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr('dy', '0.35em')
        .attr('transform', (d) => {
          const rotate = (d.angle * 180 / Math.PI) - 90;
          const flip = d.angle > Math.PI ? 180 : 0;
          return `rotate(${rotate}) translate(${outerRadius + 14}) rotate(${flip})`;
        })
        .attr('text-anchor', (d) => d.angle > Math.PI ? 'end' : 'start')
        .attr('font-size', 10)
        .text((d) => langs[d.index]);

      const ribbons = g.append('g')
        .attr('fill-opacity', 0.85)
        .selectAll('path')
        .data(chord)
        .join('path')
        .attr('d', ribbon)
        .attr('fill', (d) => color(d.source.index))
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.7);

      group.on('mouseenter', (_, activeGroup) => {
        ribbons.style('opacity', (d) => {
          return (d.source.index === activeGroup.index || d.target.index === activeGroup.index) ? 0.95 : 0.1;
        });
      }).on('mouseleave', () => {
        ribbons.style('opacity', 0.85);
      });
    }

    if (slider) {
      slider.oninput = () => {
        currentMinFreq = Number(slider.value || 20);
        if (!Number.isFinite(currentMinFreq)) currentMinFreq = 20;
        if (label) label.textContent = String(currentMinFreq);
        redraw();
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

    redraw();
  }

  root.VIZ_MODULES.renderLangChord = renderLangChord;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
