(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function renderKnowledgeWeb(container) {
    if (!container || !root.d3) {
      container.innerHTML = '<div class="viz-card">D3.js not found.</div>';
      return;
    }

    const data = root.APP_DATA || {};
    const nodes = [];
    const links = [];
    const nodeMap = new Map();

    // 1. Chapters (Central Hubs)
    (data.chapters || []).forEach(ch => {
      const id = `ch:${ch.name}`;
      const node = { id, label: ch.name, type: 'chapter', size: 15 };
      nodes.push(node);
      nodeMap.set(id, node);
    });

    // 2. Videos
    (data.video_catalog || []).forEach(v => {
      const id = `vid:${v.id}`;
      const node = { id, label: v.title, type: 'video', size: 10 };
      nodes.push(node);
      nodeMap.set(id, node);

      // Link to related entities
      (v.related_entities || []).forEach(re => {
        const entId = `ent:${re.head}`;
        if (!nodeMap.has(entId)) {
          const entNode = { id: entId, label: re.head, type: 'entity', size: 8 };
          nodes.push(entNode);
          nodeMap.set(entId, entNode);
        }
        links.push({ source: id, target: entId, type: 'semantic' });
      });
    });

    // 3. Link Entities to Chapters (based on mentions)
    const entityTypes = ['names', 'toponyms', 'lexicon'];
    entityTypes.forEach(type => {
      (data[type] || []).forEach(it => {
        const entId = `ent:${it.head}`;
        if (nodeMap.has(entId)) {
          // Find which chapters mention this entity
          (data.chapters || []).forEach(ch => {
            const mentions = (it.page_list || []).filter(p => p >= ch.start && p <= ch.end);
            if (mentions.length > 0) {
              links.push({ source: entId, target: `ch:${ch.name}`, type: 'mention' });
            }
          });
        }
      });
    });

    const width = container.clientWidth || 800;
    const height = 600;

    container.innerHTML = `
      <div class="viz-card viz-card-fill">
        <div class="viz-toolbar viz-toolbar-padded">
          <strong>Сеть знаний:</strong> Связи между главами, терминами и видеолекциями
        </div>
        <svg id="knowledge-web-svg" class="viz-svg-bg" width="100%" height="${height}"></svg>
      </div>
    `;

    const svg = root.d3.select("#knowledge-web-svg");
    const g = svg.append("g");

    const simulation = root.d3.forceSimulation(nodes)
      .force("link", root.d3.forceLink(links).id(d => d.id).distance(100))
      .force("charge", root.d3.forceManyBody().strength(-200))
      .force("center", root.d3.forceCenter(width / 2, height / 2))
      .force("collision", root.d3.forceCollide().radius(d => d.size + 10));

    const link = g.append("g")
      .attr("stroke", "var(--line)")
      .attr("stroke-opacity", 0.4)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", d => d.type === 'semantic' ? 2 : 1);

    const node = g.append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", d => d.size)
      .attr("fill", d => {
        if (d.type === 'chapter') return "var(--color-primary)";
        if (d.type === 'video') return "var(--color-orange)";
        return "var(--color-gold)";
      })
      .call(drag(simulation));

    node.append("title").text(d => d.label);

    const labels = g.append("g")
      .selectAll("text")
      .data(nodes.filter(n => n.type !== 'entity' || nodes.length < 100))
      .join("text")
      .text(d => d.label.length > 20 ? d.label.slice(0, 20) + '...' : d.label)
      .attr("font-size", d => d.type === 'chapter' ? "12px" : "10px")
      .attr("dx", 12)
      .attr("dy", 4)
      .attr("fill", "var(--text)");

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);

      labels
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });

    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      return root.d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }

    container.__vizCleanup = () => {
      simulation.stop();
    };
  }

  root.VIZ_MODULES.renderKnowledgeWeb = renderKnowledgeWeb;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
