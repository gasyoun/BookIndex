(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function pageToUrl(pageOrUrl) {
    const raw = String(pageOrUrl || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    const match = raw.match(/\d+/);
    if (!match) return '';
    const page = Number(match[0]);
    if (!Number.isFinite(page) || page <= 0) return '';
    if (typeof root.buildReadingNowHash === 'function') {
      return root.buildReadingNowHash(page);
    }
    return '#v4/materials/lectures/reading/' + String(page);
  }

  function parsePageLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '—';
    return raw;
  }

  function renderNarrativeSankey(container) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3) {
      container.innerHTML = '<div class="viz-card">Sankey unavailable: missing d3.</div>';
      return;
    }
    const slovo = ((root.APP_DATA || {}).scholar || {}).slovo || {};
    const args = asArray(slovo.arguments);
    const counter = asArray(slovo.counterarguments);
    if (!args.length) {
      container.innerHTML = '<div class="viz-card">Нет данных для Sankey.</div>';
      return;
    }

    const nodeSpec = [
      { id: 'question', label: 'Вопрос о подлинности', color: '#c0392b', x: 60, y: 250 },
      { id: 'birch', label: 'Берестяные грамоты', color: '#3a6ea5', x: 280, y: 70 },
      { id: 'syntax', label: 'Синтаксис (энклитики)', color: '#3a6ea5', x: 280, y: 150 },
      { id: 'grammar', label: 'Двойственное число', color: '#3a6ea5', x: 280, y: 230 },
      { id: 'accent', label: 'Акцентология', color: '#3a6ea5', x: 280, y: 310 },
      { id: 'lexicon', label: 'Лексика', color: '#3a6ea5', x: 280, y: 390 },
      { id: 'coherence', label: 'Согласованность', color: '#27ae60', x: 560, y: 250 },
      { id: 'verdict', label: 'Текст подлинный', color: '#27ae60', x: 780, y: 250 },
    ];
    const nodeById = new Map(nodeSpec.map(function (n) { return [n.id, n]; }));

    function pickArgument(keywordCandidates) {
      for (let i = 0; i < args.length; i += 1) {
        const name = String(args[i].name || '').toLowerCase();
        for (let k = 0; k < keywordCandidates.length; k += 1) {
          if (name.indexOf(keywordCandidates[k]) >= 0) return args[i];
        }
      }
      return args[0] || null;
    }

    const detailsByNode = {
      question: {
        title: 'Вопрос о подлинности',
        detail: String(slovo.thesis || ''),
        page: '',
        url: '',
      },
      birch: pickArgument(['берест', 'орфограф']),
      syntax: pickArgument(['синтакс', 'энклит']),
      grammar: pickArgument(['двойств', 'числ']),
      accent: pickArgument(['акцент']),
      lexicon: pickArgument(['лексик']),
      coherence: pickArgument(['согласован']),
      verdict: {
        title: 'Вердикт',
        detail: String(slovo.verdict || ''),
        page: '',
        url: '',
      },
    };

    const links = [
      ['question', 'birch', 1],
      ['question', 'syntax', 1],
      ['question', 'grammar', 1],
      ['question', 'accent', 1],
      ['question', 'lexicon', 1],
      ['birch', 'coherence', 1],
      ['syntax', 'coherence', 1],
      ['grammar', 'coherence', 1],
      ['accent', 'coherence', 1],
      ['lexicon', 'coherence', 1],
      ['coherence', 'verdict', 2],
    ].map(function (x) {
      return { source: x[0], target: x[1], value: x[2] };
    });

    container.innerHTML = [
      '<div class="viz-card viz-sankey">',
      '  <div class="viz-toolbar"><span>Аргументы: ' + String(args.length) + ' · Контраргументы: ' + String(counter.length) + '</span></div>',
      '  <div class="viz-grid">',
      '    <svg id="viz-sankey-svg" width="100%" height="560" viewBox="0 0 980 560" preserveAspectRatio="xMidYMid meet"></svg>',
      '    <aside id="viz-sankey-detail" class="viz-detail"></aside>',
      '  </div>',
      '</div>',
    ].join('');

    const svg = d3.select(container).select('#viz-sankey-svg');
    const detail = container.querySelector('#viz-sankey-detail');
    const nodeW = 150;
    const nodeH = 44;

    function linkPath(link) {
      const source = nodeById.get(link.source);
      const target = nodeById.get(link.target);
      if (!source || !target) return '';
      const x0 = source.x + nodeW;
      const y0 = source.y + nodeH / 2;
      const x1 = target.x;
      const y1 = target.y + nodeH / 2;
      const c1 = x0 + (x1 - x0) * 0.45;
      const c2 = x0 + (x1 - x0) * 0.55;
      return 'M' + x0 + ',' + y0 + ' C' + c1 + ',' + y0 + ' ' + c2 + ',' + y1 + ' ' + x1 + ',' + y1;
    }

    const linksSel = svg.append('g')
      .selectAll('path')
      .data(links)
      .join('path')
      .attr('d', linkPath)
      .attr('fill', 'none')
      .attr('stroke', function (d) {
        const src = nodeById.get(d.source);
        return src ? src.color : '#888';
      })
      .attr('stroke-opacity', 0.72)
      .attr('stroke-linecap', 'round')
      .attr('stroke-width', function (d) { return 5 + d.value * 2.2; });

    // 600ms animation
    linksSel.each(function () {
      const path = this;
      const len = path.getTotalLength ? path.getTotalLength() : 0;
      d3.select(path)
        .attr('stroke-dasharray', len + ' ' + len)
        .attr('stroke-dashoffset', len)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0);
    });

    const nodeG = svg.append('g')
      .selectAll('g')
      .data(nodeSpec)
      .join('g')
      .attr('class', 'viz-node')
      .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; })
      .style('cursor', 'pointer');

    nodeG.append('rect')
      .attr('width', nodeW)
      .attr('height', nodeH)
      .attr('rx', 8)
      .attr('fill', function (d) { return d.color; });

    nodeG.append('text')
      .attr('x', 10)
      .attr('y', 26)
      .attr('fill', '#fff')
      .attr('font-size', 12)
      .text(function (d) { return d.label; });

    function renderDetail(nodeId) {
      const node = nodeById.get(nodeId);
      const data = detailsByNode[nodeId] || {};
      const title = node ? node.label : 'Детали';
      const detailText = String(data.detail || data.context || 'Описание отсутствует.');
      const pageLabel = parsePageLabel(data.page);
      const href = pageToUrl(data.url || data.page);
      const linkHtml = href
        ? ('<a href="' + href + '" class="related-link">Открыть источник</a>')
        : '';
      detail.innerHTML = [
        '<h4>' + title + '</h4>',
        '<p>' + detailText + '</p>',
        '<div class="viz-muted">Стр.: ' + pageLabel + '</div>',
        linkHtml,
      ].join('');
    }

    nodeG.on('click', function (_, d) {
      renderDetail(d.id);
    });
    renderDetail('question');
  }

  root.VIZ_MODULES.renderNarrativeSankey = renderNarrativeSankey;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
