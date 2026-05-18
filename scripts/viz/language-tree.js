(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  function renderLanguageTree(container) {
    if (!container || !root.d3) {
      container.innerHTML = '<div class="viz-card">D3.js not found.</div>';
      return;
    }

    const data = root.APP_DATA || {};
    const languages = data.languages || [];
    
    // Build hierarchy from APP_DATA.language_tree or flat languages list
    // For now, let's build a simple one from the 'languages' list using 'family' field
    const familyMap = new Map();
    const treeData = { name: "Языки мира", children: [] };
    
    languages.forEach(l => {
      const family = l.family || "Другие";
      if (!familyMap.has(family)) {
        const familyNode = { name: family, children: [] };
        familyMap.set(family, familyNode);
        treeData.children.push(familyNode);
      }
      familyMap.get(family).children.push({ name: l.head, size: (l.page_list || []).length });
    });

    const width = container.clientWidth || 800;
    const height = 800;
    
    container.innerHTML = `
      <div class="viz-card viz-card-scroll">
        <div class="viz-toolbar viz-toolbar-padded viz-toolbar-sticky">
          <strong>Древо языков:</strong> Генеалогическая иерархия по упоминаниям
        </div>
        <div id="language-tree-svg-container" class="viz-card-pad"></div>
      </div>
    `;

    const svg = root.d3.select("#language-tree-svg-container")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", "translate(100,0)");

    const tree = root.d3.tree().size([height, width - 300]);
    const hierarchy = root.d3.hierarchy(treeData);
    const rootNode = tree(hierarchy);

    svg.selectAll(".link")
      .data(rootNode.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "var(--line)")
      .attr("stroke-width", 1.5)
      .attr("d", root.d3.linkHorizontal().x(d => d.y).y(d => d.x));

    const node = svg.selectAll(".node")
      .data(rootNode.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", d => `translate(${d.y},${d.x})`);

    node.append("circle")
      .attr("r", d => d.children ? 4 : 2)
      .attr("fill", d => d.children ? "var(--color-primary)" : "var(--color-gold)");

    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children ? -10 : 10)
      .attr("text-anchor", d => d.children ? "end" : "start")
      .text(d => d.data.name)
      .attr("font-size", "10px")
      .attr("fill", "var(--text)")
      .clone(true).lower()
      .attr("stroke", "var(--bg)")
      .attr("stroke-width", 3);
  }

  root.VIZ_MODULES.renderLanguageTree = renderLanguageTree;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
