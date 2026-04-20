(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function renderLangChord(container, minVal) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || typeof root.buildVizCache !== 'function') {
      container.innerHTML = '<div class="viz-card">Chord unavailable: missing d3/buildVizCache.</div>';
      return;
    }
    const cache = root.buildVizCache(root.APP_DATA || {});
    const langs = Array.isArray(cache.topLangs) ? cache.topLangs : [];
    const matrixByName = cache.langCoMatrix || {};

    let currentMin = Number.isFinite(Number(minVal)) ? Number(minVal) : 20;
    if (currentMin < 0) currentMin = 0;

    container.innerHTML = [
      '<div class="viz-card viz-chord">',
      '  <div class="viz-toolbar">',
      '    <label>min value:',
      '      <input id="viz-chord-min" type="range" min="0" max="120" step="1" value="' + String(currentMin) + '">',
      '      <span id="viz-chord-min-label">' + String(currentMin) + '</span>',
      '    </label>',
      '  </div>',
      '  <svg id="viz-chord-svg" width="100%" height="700" viewBox="0 0 980 700" preserveAspectRatio="xMidYMid meet"></svg>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-chord-svg');
    const slider = container.querySelector('#viz-chord-min');
    const label = container.querySelector('#viz-chord-min-label');
    const width = 980;
    const height = 700;
    const outerRadius = Math.min(width, height) * 0.42;
    const innerRadius = outerRadius - 22;
    const arcColor = d3.scaleOrdinal(d3.schemeTableau10.concat(d3.schemeSet3 || []));

    function buildMatrix(threshold) {
      const m = [];
      for (let i = 0; i < langs.length; i += 1) {
        const row = [];
        for (let j = 0; j < langs.length; j += 1) {
          if (i === j) {
            row.push(0);
            continue;
          }
          const v = Number(((matrixByName[langs[i]] || {})[langs[j]]) || 0);
          row.push(v >= threshold ? v : 0);
        }
        m.push(row);
      }
      return m;
    }

    function redraw(threshold) {
      svg.selectAll('*').remove();
      if (!langs.length) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#888')
          .text('Нет данных языковых связей');
        return;
      }

      const matrix = buildMatrix(threshold);
      const total = matrix.reduce(function (acc, row) {
        return acc + row.reduce(function (x, y) { return x + y; }, 0);
      }, 0);
      if (!total) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#888')
          .text('Нет связей выше порога');
        return;
      }

      const g = svg.append('g').attr('transform', 'translate(' + (width / 2) + ',' + (height / 2) + ')');
      const chord = d3.chord().padAngle(0.04).sortSubgroups(d3.descending)(matrix);
      const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
      const ribbon = d3.ribbon().radius(innerRadius);

      const group = g.append('g')
        .selectAll('g')
        .data(chord.groups)
        .join('g');

      group.append('path')
        .attr('d', arc)
        .attr('fill', function (d) { return arcColor(d.index); })
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.2);

      group.append('text')
        .each(function (d) { d.angle = (d.startAngle + d.endAngle) / 2; })
        .attr('dy', '0.35em')
        .attr('transform', function (d) {
          const rotate = (d.angle * 180 / Math.PI) - 90;
          const flip = d.angle > Math.PI ? 180 : 0;
          return 'rotate(' + rotate + ') translate(' + (outerRadius + 12) + ') rotate(' + flip + ')';
        })
        .attr('text-anchor', function (d) { return d.angle > Math.PI ? 'end' : 'start'; })
        .attr('font-size', 10)
        .text(function (d) { return langs[d.index]; });

      const ribbons = g.append('g')
        .attr('fill-opacity', 0.85)
        .selectAll('path')
        .data(chord)
        .join('path')
        .attr('d', ribbon)
        .attr('fill', function (d) { return arcColor(d.source.index); })
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.7);

      group.on('mouseenter', function (_, activeGroup) {
        ribbons.style('opacity', function (d) {
          return (d.source.index === activeGroup.index || d.target.index === activeGroup.index) ? 0.95 : 0.1;
        });
      }).on('mouseleave', function () {
        ribbons.style('opacity', 0.85);
      });
    }

    if (slider) {
      slider.oninput = function () {
        currentMin = Number(slider.value || 20);
        if (label) label.textContent = String(currentMin);
        redraw(currentMin);
      };
    }
    redraw(currentMin);
  }

  root.VIZ_MODULES.renderLangChord = renderLangChord;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
