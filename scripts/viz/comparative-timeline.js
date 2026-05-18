(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function renderComparativeTimeline(container) {
    if (!container) return;
    const d3 = root.d3;
    if (!d3 || !root.APP_DATA) {
      container.innerHTML = '<div class="viz-card">Timeline unavailable.</div>';
      return;
    }

    const laws = root.APP_DATA.phonetic_laws || [];
    const evolution = root.APP_DATA.russian_evolution || [];
    const history = root.APP_DATA.historical_context || [];

    container.innerHTML = `
      <div class="viz-card viz-comparative-timeline">
        <h2 class="viz-comparative-title">Сравнительная хронология: Язык и История <span class="v-badge">v7.2</span></h2>
        <svg id="comparative-timeline-svg" width="100%" height="400"></svg>
      </div>
    `;

    const svg = d3.select('#comparative-timeline-svg');
    const width = container.clientWidth - 40 || 1000;
    const height = 400;
    const margin = { top: 40, right: 40, bottom: 40, left: 150 };

    const x = d3.scaleLinear()
      .domain([800, 2026])
      .range([margin.left, width - margin.right]);

    const xAxis = d3.axisBottom(x).tickFormat(d3.format('d')).ticks(10);

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .attr('color', '#666');

    // Lanes
    const lanes = [
      { id: 'laws', label: 'Фон. законы', data: laws.map(l => ({ year: l.year, name: l.name, type: 'law' })) },
      { id: 'evol', label: 'Развитие языка', data: evolution.map(e => ({ year: e.year, name: e.epoch, type: 'evol' })) },
      { id: 'hist', label: 'История', data: history.map(h => ({ year: h.year, name: h.event, type: 'hist' })) }
    ];

    const y = d3.scalePoint()
      .domain(lanes.map(l => l.id))
      .range([margin.top, height - margin.bottom - 40]);

    lanes.forEach(lane => {
      const g = svg.append('g').attr('class', `lane-${lane.id}`);
      
      g.append('text')
        .attr('x', 20)
        .attr('y', y(lane.id))
        .attr('class', 'lane-label')
        .text(lane.label);

      g.selectAll('.timeline-event')
        .data(lane.data)
        .join('g')
        .attr('class', 'timeline-event')
        .attr('transform', d => `translate(${x(d.year)},${y(lane.id)})`)
        .call(g => {
          g.append('circle')
            .attr('r', 5)
            .attr('fill', lane.id === 'hist' ? '#ffd54f' : '#26a69a');
          
          g.append('text')
            .attr('class', 'event-label')
            .attr('dy', -10)
            .attr('text-anchor', 'middle')
            .text(d => d.name.length > 20 ? d.name.slice(0, 18) + '...' : d.name)
            .append('title').text(d => `${d.year}: ${d.name}`);
        });
    });

    // Add connectors or highlights if needed
  }

  root.VIZ_MODULES.renderComparativeTimeline = renderComparativeTimeline;

})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
