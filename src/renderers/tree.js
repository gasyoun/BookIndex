/**
 * @file tree.js
 * @description Language genealogy tree visualization.
 */

import { 
  APP_DATA,
  FAMILY_COLORS
} from '../core/state.js';
import { 
  escapeHtml, 
  safeColor 
} from '../utils/dom.js';
import { navigateToItem } from '../core/navigation.js';

/**
 * Render the Language Tree Panel.
 */
export function renderTreePanel(container) {
  container.innerHTML = `<div class="panel active"><div class="timeline-container">
    <p class="chart-intro">Генеалогическое древо языков: семья → группа → язык.</p>
    <div id="lang-tree" class="language-tree-host"></div>
  </div></div>`;
  
  const host = document.getElementById('lang-tree');
  const tree = APP_DATA.language_tree;
  if (!tree || !host) {
    if (host) host.innerHTML = '<p class="panel-muted-message">Данные древа отсутствуют.</p>';
    return;
  }

  const rowH = 22;
  const col1 = 20, col2 = 220, col3 = 480;
  const W = 1000;
  let y = 40;
  const positioned = [];
  
  // Calculate layout
  tree.forEach(fam => {
    const famStartY = y;
    fam.children.forEach(grp => {
      const grpStartY = y;
      grp.children.forEach(lang => {
        positioned.push({
          famName: fam.name,
          grpName: grp.name,
          langName: lang.name,
          discussed: lang.discussed,
          y: y
        });
        y += rowH;
      });
      grp.midY = (grpStartY + y - rowH) / 2;
    });
    fam.midY = (famStartY + y - rowH) / 2;
    y += 15;
  });

  const H = y + 40;
  let svg = `<svg class="language-tree-svg" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
  
  tree.forEach(fam => {
    const famColor = safeColor(FAMILY_COLORS[fam.name], '#888');
    svg += `<text x="${col1}" y="${fam.midY + 5}" fill="${famColor}" font-size="14" font-weight="bold">${escapeHtml(fam.name)}</text>`;
    
    fam.children.forEach(grp => {
      svg += `<path d="M ${col1 + 160} ${fam.midY} C ${col2 - 40} ${fam.midY}, ${col2 - 40} ${grp.midY}, ${col2} ${grp.midY}" fill="none" stroke="${famColor}" stroke-width="1.5" opacity="0.4"/>`;
      svg += `<text x="${col2}" y="${grp.midY + 4}" fill="#5a3818" font-size="12" font-style="italic">${escapeHtml(grp.name)}</text>`;
      
      grp.children.forEach(lang => {
        const p = positioned.find(node => node.famName === fam.name && node.grpName === grp.name && node.langName === lang.name);
        if (!p) return;
        svg += `<path d="M ${col2 + 220} ${grp.midY} C ${col3 - 40} ${grp.midY}, ${col3 - 40} ${p.y}, ${col3} ${p.y}" fill="none" stroke="${famColor}" stroke-width="1" opacity="0.2"/>`;
        svg += `<g class="tree-node" data-head="${escapeHtml(lang.name)}">
          <circle cx="${col3 - 8}" cy="${p.y}" r="3.5" fill="${famColor}"/>
          <text x="${col3}" y="${p.y + 5}" fill="#1a1a1a" font-size="13" ${p.discussed ? 'font-weight="bold"' : ''}>${escapeHtml(lang.name)}</text>
        </g>`;
      });
    });
  });
  
  svg += '</svg>';
  host.innerHTML = svg;
  
  // Wire up clicks
  host.querySelectorAll('.tree-node').forEach(node => {
    node.onclick = () => {
      navigateToItem('languages', node.dataset.head);
    };
  });
}
