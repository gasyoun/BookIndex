(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function renderMultimediaBridge(container) {
    if (!container || !root.d3) {
      container.innerHTML = '<div class="viz-card">D3.js not found.</div>';
      return;
    }

    const data = root.APP_DATA || {};
    const chapters = data.chapters || [];
    const videos = data.video_catalog || [];
    
    // Nodes: Chapters (Left), Videos (Right)
    const nodes = [];
    const links = [];
    
    chapters.forEach((ch, i) => {
      nodes.push({ name: ch.name, type: 'chapter' });
    });
    
    videos.forEach((v, i) => {
      // Only include videos with at least one link to a chapter
      const related = (v.related_entities || []);
      const chapterLinks = new Set();
      related.forEach(re => {
        const ent = (data.names || []).find(n => n.head === re.head) 
                 || (data.toponyms || []).find(n => n.head === re.head)
                 || (data.lexicon || []).find(n => n.head === re.head);
        
        if (ent) {
          chapters.forEach((ch, chIdx) => {
            if ((ent.page_list || []).some(p => p >= ch.start && p <= ch.end)) {
              chapterLinks.add(chIdx);
            }
          });
        }
      });
      
      if (chapterLinks.size > 0) {
        const vIdx = nodes.length;
        nodes.push({ name: v.title, type: 'video' });
        chapterLinks.forEach(chIdx => {
          links.push({ source: chIdx, target: vIdx, value: 1 });
        });
      }
    });

    const width = container.clientWidth || 800;
    const height = Math.max(600, nodes.length * 20);

    container.innerHTML = `
      <div class="viz-card viz-card-scroll">
        <div class="viz-toolbar viz-toolbar-padded viz-toolbar-sticky">
          <strong>Мультимедийный мост:</strong> Связи между главами книги и видеолекциями
        </div>
        <div id="multimedia-bridge-svg-container" class="viz-card-pad"></div>
      </div>
    `;

    // Sankey requires d3-sankey which might not be in the basic d3 bundle.
    // If not found, we'll do a simple bipartite graph.
    const svg = root.d3.select("#multimedia-bridge-svg-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const leftX = 200;
    const rightX = width - 300;
    
    const chapterNodes = nodes.filter(n => n.type === 'chapter');
    const videoNodes = nodes.filter(n => n.type === 'video');
    
    const yChapter = root.d3.scalePoint().domain(chapterNodes.map(n => n.name)).range([50, height - 50]);
    const yVideo = root.d3.scalePoint().domain(videoNodes.map(n => n.name)).range([50, height - 50]);

    // Draw links
    svg.append("g")
      .attr("stroke", "var(--line)")
      .attr("stroke-opacity", 0.2)
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("d", d => {
        const s = nodes[d.source];
        const t = nodes[d.target];
        const sy = yChapter(s.name);
        const ty = yVideo(t.name);
        return `M${leftX},${sy} C${(leftX+rightX)/2},${sy} ${(leftX+rightX)/2},${ty} ${rightX},${ty}`;
      })
      .attr("fill", "none")
      .attr("stroke-width", 1);

    // Draw nodes
    svg.append("g")
      .selectAll("text")
      .data(chapterNodes)
      .join("text")
      .attr("x", leftX - 10)
      .attr("y", d => yChapter(d.name))
      .attr("text-anchor", "end")
      .text(d => d.name)
      .attr("font-size", "10px")
      .attr("fill", "var(--color-primary)");

    svg.append("g")
      .selectAll("text")
      .data(videoNodes)
      .join("text")
      .attr("x", rightX + 10)
      .attr("y", d => yVideo(d.name))
      .attr("text-anchor", "start")
      .text(d => d.name.length > 50 ? d.name.slice(0, 50) + '...' : d.name)
      .attr("font-size", "9px")
      .attr("fill", "var(--text)");
  }

  root.VIZ_MODULES.renderMultimediaBridge = renderMultimediaBridge;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
