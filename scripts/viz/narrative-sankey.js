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
    if (typeof root.buildReadingNowHash === 'function') return root.buildReadingNowHash(page);
    return `#v4/materials/lectures/reading/${String(page)}`;
  }

  function buildNarratives(data) {
    const out = [];
    const scholar = (data && data.scholar) || {};
    if (scholar && scholar.slovo && typeof scholar.slovo === 'object') {
      out.push({
        id: 'slovo',
        label: 'Слово о полку Игореве',
        payload: scholar.slovo,
      });
    }
    return out;
  }

  function buildSlovoDiagram(payload) {
    const args = asArray(payload && payload.arguments);
    const counter = asArray(payload && payload.counterarguments);
    if (!args.length) return null;

    function findArgument(needles) {
      for (let i = 0; i < args.length; i += 1) {
        const name = String(args[i].name || '').toLowerCase();
        for (let k = 0; k < needles.length; k += 1) {
          if (name.indexOf(needles[k]) >= 0) return args[i];
        }
      }
      return args[0] || null;
    }

    const nodes = [
      { id: 'question', label: 'Вопрос о подлинности', color: '#c0392b', x: 56, y: 250 },
      { id: 'birch', label: 'Берестяные грамоты', color: '#3a6ea5', x: 280, y: 70 },
      { id: 'syntax', label: 'Синтаксис (энклитики)', color: '#3a6ea5', x: 280, y: 150 },
      { id: 'grammar', label: 'Двойственное число', color: '#3a6ea5', x: 280, y: 230 },
      { id: 'accent', label: 'Акцентология', color: '#3a6ea5', x: 280, y: 310 },
      { id: 'lexicon', label: 'Лексика', color: '#3a6ea5', x: 280, y: 390 },
      { id: 'coherence', label: 'Согласованность', color: '#27ae60', x: 560, y: 250 },
      { id: 'verdict', label: 'Текст подлинный', color: '#27ae60', x: 780, y: 250 },
    ];
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
    ].map((x) => ({ source: x[0], target: x[1], value: x[2] }));
    const detailsByNode = {
      question: { detail: String(payload.thesis || ''), page: '' },
      birch: findArgument(['берест', 'орфограф']),
      syntax: findArgument(['синтакс', 'энклит']),
      grammar: findArgument(['двойств', 'числ']),
      accent: findArgument(['акцент']),
      lexicon: findArgument(['лексик']),
      coherence: findArgument(['согласован']),
      verdict: { detail: String(payload.verdict || ''), page: '' },
    };
    return { nodes, links, detailsByNode, argsCount: args.length, counterCount: counter.length };
  }

  function renderNarrativeSankey(container) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3) {
      container.innerHTML = '<div class="viz-card">Sankey unavailable: missing d3.</div>';
      return;
    }

    const narratives = buildNarratives(root.APP_DATA || {});
    if (!narratives.length) {
      container.innerHTML = '<div class="viz-card"><div class="viz-empty-state">Нет данных narrative для визуализации.</div></div>';
      return;
    }

    let activeId = narratives[0].id;
    container.innerHTML = [
      '<div class="viz-card viz-sankey">',
      '  <div id="viz-sankey-tabs" class="viz-module-tabs"></div>',
      '  <div class="viz-toolbar">',
      '    <span id="viz-sankey-meta" class="viz-note"></span>',
      '  </div>',
      '  <div class="viz-grid">',
      '    <svg id="viz-sankey-svg" width="100%" height="560" viewBox="0 0 980 560" preserveAspectRatio="xMidYMid meet"></svg>',
      '    <aside id="viz-sankey-detail" class="viz-detail"></aside>',
      '  </div>',
      '</div>',
    ].join('');

    const tabs = container.querySelector('#viz-sankey-tabs');
    const meta = container.querySelector('#viz-sankey-meta');
    const detail = container.querySelector('#viz-sankey-detail');
    const svg = d3.select(container).select('#viz-sankey-svg');

    function renderTabs() {
      if (!tabs) return;
      tabs.innerHTML = narratives.map((n) => {
        const active = n.id === activeId ? ' active' : '';
        return `<button type="button" class="viz-module-btn${active}" data-id="${n.id}">${n.label}</button>`;
      }).join('');
      const buttons = Array.from(tabs.querySelectorAll('button[data-id]'));
      for (let i = 0; i < buttons.length; i += 1) {
        buttons[i].onclick = () => {
          activeId = String(buttons[i].dataset.id || activeId);
          renderTabs();
          redraw();
        };
      }
    }

    function renderDetail(node, detailsByNode) {
      if (!detail) return;
      const data = detailsByNode[node.id] || {};
      const text = String(data.detail || data.context || 'Описание отсутствует.');
      const page = String(data.page || '');
      const href = pageToUrl(data.url || page);
      const linkHtml = href ? `<a href="${href}" class="related-link">Открыть источник</a>` : '';
      detail.innerHTML = [
        `<h4>${node.label}</h4>`,
        `<p>${text}</p>`,
        `<div class="viz-muted">Стр.: ${page || '—'}</div>`,
        linkHtml,
      ].join('');
    }

    function redraw() {
      svg.selectAll('*').remove();
      const narrative = narratives.find((n) => n.id === activeId) || narratives[0];
      const diagram = buildSlovoDiagram(narrative.payload);
      if (!diagram) {
        if (meta) meta.textContent = `${narrative.label}: нет аргументов`;
        if (detail) detail.innerHTML = '<p>Для этой лекции нет данных.</p>';
        svg.append('text')
          .attr('x', 490)
          .attr('y', 280)
          .attr('text-anchor', 'middle')
          .attr('fill', 'var(--muted)')
          .text('Нет данных для выбранной лекции');
        return;
      }

      if (meta) meta.textContent = `Аргументы: ${diagram.argsCount} · Контраргументы: ${diagram.counterCount}`;

      const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
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
        return `M${x0},${y0} C${c1},${y0} ${c2},${y1} ${x1},${y1}`;
      }

      const linksSel = svg.append('g')
        .selectAll('path')
        .data(diagram.links)
        .join('path')
        .attr('d', linkPath)
        .attr('fill', 'none')
        .attr('stroke', (d) => {
          const src = nodeById.get(d.source);
          return src ? src.color : '#888';
        })
        .attr('stroke-opacity', 0.72)
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', (d) => 5 + d.value * 2.2);

      linksSel.each(function animatePath() {
        const path = this;
        const len = path.getTotalLength ? path.getTotalLength() : 0;
        d3.select(path)
          .attr('stroke-dasharray', `${len} ${len}`)
          .attr('stroke-dashoffset', len)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      });

      const nodeG = svg.append('g')
        .selectAll('g')
        .data(diagram.nodes)
        .join('g')
        .attr('transform', (d) => `translate(${d.x},${d.y})`)
        .style('cursor', 'pointer')
        .on('click', (_, d) => renderDetail(d, diagram.detailsByNode));

      nodeG.append('rect')
        .attr('width', nodeW)
        .attr('height', nodeH)
        .attr('rx', 8)
        .attr('fill', (d) => d.color);

      nodeG.append('text')
        .attr('x', 10)
        .attr('y', 26)
        .attr('fill', '#fff')
        .attr('font-size', 12)
        .text((d) => d.label);

      renderDetail(diagram.nodes[0], diagram.detailsByNode);
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

    renderTabs();
    redraw();
  }

  root.VIZ_MODULES.renderNarrativeSankey = renderNarrativeSankey;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
