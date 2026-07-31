(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function renderLangChord(container, minVal) {
    if (!container) return;
    const shell = root.VizShell;
    const d3 = root.d3;
    if (!d3 || typeof root.buildVizCache !== 'function') {
      if (shell) shell.showStatus(container, 'error', 'Хорда недоступна', 'Нужны d3 и buildVizCache.');
      else container.innerHTML = '<div class="viz-status viz-status-error">Chord unavailable: missing d3/buildVizCache.</div>';
      return;
    }

    const cache = root.buildVizCache(root.APP_DATA || {});
    const topLangs = asArray(cache.topLangs);
    const matrixByName = cache.langCoMatrix || {};
    const langFreq = cache.langFreq || {};
    const params = typeof root.readVizParams === 'function' ? root.readVizParams() : new URLSearchParams();
    let currentMinFreq = Number.isFinite(Number(minVal)) ? Number(minVal) : 20;
    if (currentMinFreq < 0) currentMinFreq = 0;
    const hidden = new Set();

    // Family lookup straight from the languages index (head → family).
    const familyByLang = {};
    const appLanguages = asArray(root.APP_DATA && root.APP_DATA.languages);
    for (let i = 0; i < appLanguages.length; i += 1) {
      const lang = appLanguages[i] || {};
      const head = String(lang.head || '').trim();
      const family = String(lang.family || '').trim();
      if (head && family) familyByLang[head] = family;
    }
    const families = [];
    for (let i = 0; i < topLangs.length; i += 1) {
      const family = familyByLang[topLangs[i]];
      if (family && families.indexOf(family) < 0) families.push(family);
    }
    families.sort((a, b) => a.localeCompare(b, 'ru'));

    const topOptions = [0, 8, 12, 16, 24];
    let currentTopN = Number(params.get('top') || 0);
    if (!Number.isFinite(currentTopN) || topOptions.indexOf(currentTopN) < 0) currentTopN = 0;
    let currentFamily = String(params.get('filter') || '');
    if (currentFamily && families.indexOf(currentFamily) < 0) currentFamily = '';

    const esc = (value) => (shell && shell.escapeHtml
      ? shell.escapeHtml(value)
      : String(value == null ? '' : value).replace(/"/g, '&quot;').replace(/</g, '&lt;'));

    const filtersHtml = [
      '<label>Топ-N:',
      '  <select id="viz-chord-topn">',
      ...topOptions.map((n) => `    <option value="${String(n)}"${n === currentTopN ? ' selected' : ''}>${n === 0 ? 'все' : String(n)}</option>`),
      '  </select>',
      '</label>',
      '<label>Семья:',
      '  <select id="viz-chord-family">',
      `    <option value=""${currentFamily === '' ? ' selected' : ''}>все семьи</option>`,
      ...families.map((f) => `    <option value="${esc(f)}"${f === currentFamily ? ' selected' : ''}>${esc(f)}</option>`),
      '  </select>',
      '</label>',
      '<label>min frequency:',
      `  <input id="viz-chord-min" type="range" min="0" max="120" step="1" value="${String(currentMinFreq)}">`,
      `  <span id="viz-chord-min-label">${String(currentMinFreq)}</span>`,
      '</label>',
      '<span id="viz-chord-summary" class="viz-note"></span>',
    ].join('');

    if (shell && typeof shell.buildModuleCard === 'function') {
      container.innerHTML = shell.buildModuleCard({
        className: 'viz-chord',
        title: 'VIZ-06 · Хорда языков',
        dataSource: 'buildVizCache.langCoMatrix',
        filtersHtml,
        bodyHtml: [
          '<div id="viz-chord-legend" class="viz-legend"></div>',
          '<div class="viz-empty-state" id="viz-chord-empty" hidden><strong>Недостаточно языков.</strong><br>Снизьте порог частоты, выберите «все семьи» или включите языки в легенде.</div>',
          '<svg id="viz-chord-svg" width="100%" height="700" viewBox="0 0 980 700" preserveAspectRatio="xMidYMid meet"></svg>',
        ].join(''),
      });
    } else {
      container.innerHTML = [
        '<div class="viz-card viz-chord">',
        `  <div class="viz-toolbar">${filtersHtml}</div>`,
        '  <div id="viz-chord-legend" class="viz-legend"></div>',
        '  <svg id="viz-chord-svg" width="100%" height="700" viewBox="0 0 980 700" preserveAspectRatio="xMidYMid meet"></svg>',
        '</div>',
      ].join('');
    }

    const svg = d3.select(container).select('#viz-chord-svg');
    const slider = container.querySelector('#viz-chord-min');
    const label = container.querySelector('#viz-chord-min-label');
    const topSelect = container.querySelector('#viz-chord-topn');
    const familySelect = container.querySelector('#viz-chord-family');
    const summary = container.querySelector('#viz-chord-summary');
    const legend = container.querySelector('#viz-chord-legend');
    const empty = container.querySelector('#viz-chord-empty');
    const width = 980;
    const height = 700;
    const outerRadius = Math.min(width, height) * 0.42;
    const innerRadius = outerRadius - 22;
    // Stable colours: keyed by the language's fixed position in topLangs (the
    // same idx % 22 the legend dots use), never by index in the filtered set —
    // so a language keeps its colour when filters change.
    const palette = (d3.schemeTableau10 || []).concat(d3.schemeSet3 || []);
    function colorFor(lang) {
      const idx = topLangs.indexOf(lang);
      return palette[(idx >= 0 ? idx : 0) % palette.length];
    }

    function getActiveLangs() {
      const filtered = topLangs.filter((lang) => {
        if (currentFamily && familyByLang[lang] !== currentFamily) return false;
        const freq = Number(langFreq[lang] || 0);
        if (freq < currentMinFreq) return false;
        if (hidden.has(lang)) return false;
        return true;
      });
      return currentTopN > 0 ? filtered.slice(0, currentTopN) : filtered;
    }

    function writeParams() {
      if (typeof root.writeVizParams !== 'function') return;
      root.writeVizParams({
        top: currentTopN > 0 ? currentTopN : null,
        filter: currentFamily || null,
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
        const disabledByFamily = !!currentFamily && familyByLang[lang] !== currentFamily;
        const inactive = !isActive;
        const family = familyByLang[lang];
        const title = `${lang} · freq ${Number(langFreq[lang] || 0)}${family ? ` · ${family}` : ''}`;
        const suffix = disabledByFamily ? ' (другая семья)' : (disabledByFreq ? ' (ниже порога)' : '');
        return [
          `<span class="viz-legend-item toggleable${inactive ? ' inactive' : ''}" data-lang="${lang}" title="${title}">`,
          `  <span class="viz-legend-dot viz-legend-color-${idx % 22}"></span>${lang}${suffix}`,
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
        if (empty) empty.hidden = false;
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
        if (empty) empty.hidden = false;
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--muted)')
          .text('Нет связей между выбранными языками');
        return;
      }
      if (empty) empty.hidden = true;

      const g = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);
      const chord = d3.chord().padAngle(0.04).sortSubgroups(d3.descending)(matrix);
      const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
      const ribbon = d3.ribbon().radius(innerRadius);

      const group = g.append('g').selectAll('g').data(chord.groups).join('g');
      group.append('path')
        .attr('d', arc)
        .attr('fill', (d) => colorFor(langs[d.index]))
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
        .attr('fill', (d) => colorFor(langs[d.source.index]))
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
    if (topSelect) {
      topSelect.onchange = () => {
        currentTopN = Number(topSelect.value || 0);
        if (!Number.isFinite(currentTopN) || topOptions.indexOf(currentTopN) < 0) currentTopN = 0;
        writeParams();
        redraw();
      };
    }
    if (familySelect) {
      familySelect.onchange = () => {
        currentFamily = String(familySelect.value || '');
        if (currentFamily && families.indexOf(currentFamily) < 0) currentFamily = '';
        writeParams();
        redraw();
      };
    }

    if (shell && typeof shell.wireModuleChrome === 'function') {
      shell.wireModuleChrome(container, {
        exportFilename: 'viz-lang-chord.svg',
        exportSelector: '#viz-chord-svg',
        onReset: () => {
          currentMinFreq = 20;
          currentTopN = 0;
          currentFamily = '';
          hidden.clear();
          if (slider) slider.value = '20';
          if (label) label.textContent = '20';
          if (topSelect) topSelect.value = '0';
          if (familySelect) familySelect.value = '';
          writeParams();
          redraw();
        },
      });
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
