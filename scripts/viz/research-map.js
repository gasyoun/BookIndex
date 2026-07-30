(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.VIZ_MODULES = root.VIZ_MODULES || {};

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ENTITY_KEYS = ['names', 'toponyms', 'ethnonyms', 'languages', 'lexicon_tech', 'subject_index'];
  const PAGE_HALO = 3;
  const POOL_SIZE = 30;
  // A head sitting in this many domain pools says nothing about any single domain
  // («русский» is everywhere) — such heads are dropped from bridges and video links.
  const UBIQUITOUS_DOMAINS = 5;
  // Same idea across the video catalogue: a head mentioned in a third of all videos
  // links a domain to almost the whole catalogue, which is not a finding.
  const UBIQUITOUS_VIDEO_SHARE = 0.3;
  const MIN_VIDEO_MATCHES = 2;
  const DEFAULT_TOP = 8;
  const MIN_TOP = 3;
  const MAX_TOP = 14;
  const VIEW_W = 760;
  const VIEW_H = 540;

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function clip(value, max) {
    const raw = text(value);
    if (raw.length <= max) return raw;
    return `${raw.slice(0, Math.max(1, max - 1))}…`;
  }

  /**
   * Editorial map of A. A. Zaliznyak's research programme onto the datasets that
   * document it. Every field points at data actually present in app_data.json —
   * the module derives pages, chapters, entities and videos from those pointers
   * rather than hardcoding any of the aggregates.
   */
  const DOMAIN_SPEC = [
    {
      id: 'comparative',
      title: 'Сравнительно-историческое языкознание',
      note: 'Родство языков, звуковые соответствия, реконструкция праформ.',
      chapters: ['Историческая лингвистика', 'Историческая лингвистика (продолж.)', 'Древняя Индия'],
      viz: 'viz06',
      vizLabel: 'VIZ-06 · Хорда языков',
      evidence: [
        {
          source: 'scholar.sound_correspondences',
          label: 'звуковые соответствия',
          pick: (it) => ({
            title: [text(it.pie), text(it.rus) || text(it.lat) || text(it.gre)].filter(Boolean).join(' → '),
            note: [text(it.meaning), text(it.law)].filter(Boolean).join(' · '),
            page: null,
          }),
        },
        {
          source: 'scholar.chronology',
          label: 'хронология открытий',
          pick: (it) => ({
            title: [text(it.year), text(it.event)].filter(Boolean).join(' — '),
            note: '',
            page: it.page,
          }),
        },
      ],
    },
    {
      id: 'accent',
      title: 'Акцентология и русское ударение',
      note: 'Акцентные парадигмы, переход от праславянской акцентуации к русской.',
      chapters: ['Из русского ударения'],
      viz: 'viz07',
      vizLabel: 'VIZ-07 · Bump-chart рангов',
      evidence: [
        {
          source: 'scholar.accent_paradigms',
          label: 'акцентные парадигмы',
          pick: (it) => ({
            title: text(it.type),
            note: text(it.description),
            page: null,
          }),
        },
      ],
    },
    {
      id: 'birchbark',
      title: 'Берестяные грамоты и древненовгородский диалект',
      note: 'Чтение и датировка грамот, восстановление живого языка Новгорода.',
      chapters: ['Берестяные грамоты'],
      viz: 'viz01',
      vizLabel: 'VIZ-01 · Карта по векам',
      evidence: [
        {
          source: 'scholar.birch_grammar',
          label: 'грамоты',
          pick: (it) => ({
            title: [it.num ? `№ ${text(it.num)}` : '', text(it.year)].filter(Boolean).join(', '),
            note: text(it.content),
            page: it.page,
          }),
        },
      ],
    },
    {
      id: 'slovo',
      title: '«Слово о полку Игореве»',
      note: 'Лингвистическое доказательство подлинности памятника и спор со скептиками.',
      chapters: ['История русского языка'],
      viz: 'viz05',
      vizLabel: 'VIZ-05 · Sankey «Слово»',
      evidence: [
        {
          source: 'scholar.slovo.arguments',
          label: 'аргументы',
          pick: (it) => ({ title: text(it.name), note: text(it.detail), page: it.page }),
        },
        {
          source: 'scholar.slovo.counterarguments',
          label: 'контраргументы',
          pick: (it) => ({ title: text(it.name), note: text(it.detail), page: it.page }),
        },
      ],
    },
    {
      id: 'dialect',
      title: 'Диалектология и изоглоссы',
      note: 'Границы диалектных черт на карте русского языка.',
      chapters: ['О жизни слов'],
      viz: 'viz01',
      vizLabel: 'VIZ-01 · Карта по векам',
      evidence: [
        {
          source: 'scholar.isoglosses',
          label: 'изоглоссы',
          pick: (it) => ({ title: text(it.name), note: text(it.description), page: it.page }),
        },
      ],
    },
    {
      id: 'grammar',
      title: 'Морфология и грамматический словарь',
      note: 'Порядок слов, энклитики, служебные слова и терминология описания.',
      chapters: ['Порядок слов', 'Или и уже'],
      viz: 'viz04',
      vizLabel: 'VIZ-04 · Тепловая матрица',
      evidence: [
        {
          source: 'glossary',
          label: 'термины',
          pick: (it) => ({ title: text(it.term), note: text(it.definition), page: null }),
        },
      ],
    },
    {
      id: 'amateur',
      title: 'Против любительской лингвистики',
      note: 'Разбор подделок и «народных этимологий» лингвистическими средствами.',
      chapters: [],
      viz: 'viz02',
      vizLabel: 'VIZ-02 · Граф сосуществования',
      evidence: [
        {
          source: 'scholar.controversies',
          label: 'дискуссии',
          pick: (it) => ({ title: text(it.topic), note: text(it.description), page: it.page }),
        },
      ],
    },
  ];

  function readPath(data, path) {
    const parts = String(path || '').split('.');
    let cursor = data;
    for (let i = 0; i < parts.length; i += 1) {
      if (!cursor || typeof cursor !== 'object') return null;
      cursor = cursor[parts[i]];
    }
    return cursor;
  }

  function parsePages(value) {
    const pages = [];
    if (value == null) return pages;
    const raw = String(value);
    const matches = raw.match(/\d+/g);
    if (!matches) return pages;
    for (let i = 0; i < matches.length; i += 1) {
      const page = Number(matches[i]);
      if (Number.isFinite(page)) pages.push(page);
    }
    return pages;
  }

  function collectEvidence(data, spec) {
    const rows = [];
    for (let i = 0; i < spec.evidence.length; i += 1) {
      const source = spec.evidence[i];
      const list = asArray(readPath(data, source.source));
      for (let j = 0; j < list.length; j += 1) {
        const item = list[j];
        if (!item || typeof item !== 'object') continue;
        let picked = null;
        try {
          picked = source.pick(item) || null;
        } catch (e) {
          picked = null;
        }
        if (!picked) continue;
        const title = text(picked.title);
        if (!title) continue;
        rows.push({
          kind: source.label,
          source: source.source,
          title,
          note: text(picked.note),
          pages: parsePages(picked.page),
        });
      }
    }
    return rows;
  }

  function buildChapterIndex(data) {
    const chapters = asArray(data.chapters);
    const byName = new Map();
    for (let i = 0; i < chapters.length; i += 1) {
      const chapter = chapters[i] || {};
      const name = text(chapter.name);
      const start = Number(chapter.start);
      const end = Number(chapter.end);
      if (!name || !Number.isFinite(start) || !Number.isFinite(end)) continue;
      byName.set(name, { index: i, name, start, end });
    }
    return { chapters, byName };
  }

  function chapterForPage(chapterIndex, page) {
    const list = chapterIndex.chapters;
    for (let i = 0; i < list.length; i += 1) {
      const chapter = list[i] || {};
      const start = Number(chapter.start);
      const end = Number(chapter.end);
      if (Number.isFinite(start) && Number.isFinite(end) && page >= start && page <= end) {
        return { index: i, name: text(chapter.name), start, end };
      }
    }
    return null;
  }

  function buildDomainPages(spec, evidence, chapterIndex) {
    const pages = new Set();
    const chapters = new Map();

    for (let i = 0; i < spec.chapters.length; i += 1) {
      const chapter = chapterIndex.byName.get(spec.chapters[i]);
      if (!chapter) continue;
      chapters.set(chapter.index, chapter);
      for (let page = chapter.start; page <= chapter.end; page += 1) pages.add(page);
    }

    for (let i = 0; i < evidence.length; i += 1) {
      const anchors = evidence[i].pages;
      for (let j = 0; j < anchors.length; j += 1) {
        const anchor = anchors[j];
        for (let page = anchor - PAGE_HALO; page <= anchor + PAGE_HALO; page += 1) {
          if (page > 0) pages.add(page);
        }
        const chapter = chapterForPage(chapterIndex, anchor);
        if (chapter && !chapters.has(chapter.index)) chapters.set(chapter.index, chapter);
      }
    }

    return {
      pages,
      chapters: Array.from(chapters.values()).sort((a, b) => a.index - b.index),
    };
  }

  function matchEntities(data, bookId, pages) {
    const matched = [];
    for (let k = 0; k < ENTITY_KEYS.length; k += 1) {
      const type = ENTITY_KEYS[k];
      const items = asArray(data[type]);
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i] || {};
        const head = text(item.head);
        if (!head) continue;
        if (bookId && item.book_id && item.book_id !== bookId) continue;
        const pageList = asArray(item.page_list);
        let hits = 0;
        for (let j = 0; j < pageList.length; j += 1) {
          if (pages.has(Number(pageList[j]))) hits += 1;
        }
        if (!hits) continue;
        matched.push({ type, head, hits });
      }
    }
    matched.sort((a, b) => (b.hits - a.hits) || a.head.localeCompare(b.head, 'ru'));
    return matched;
  }

  function buildUbiquitousVideoHeads(data) {
    const videos = asArray(data.video_catalog);
    const seen = new Set();
    const countByHead = new Map();
    let total = 0;
    for (let i = 0; i < videos.length; i += 1) {
      const video = videos[i] || {};
      const id = text(video.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      total += 1;
      const heads = new Set();
      const related = asArray(video.related_entities);
      for (let j = 0; j < related.length; j += 1) {
        const head = text(related[j] && related[j].head);
        if (head) heads.add(head);
      }
      heads.forEach((head) => {
        countByHead.set(head, (countByHead.get(head) || 0) + 1);
      });
    }
    const ubiquitous = new Set();
    if (total) {
      countByHead.forEach((count, head) => {
        if ((count / total) >= UBIQUITOUS_VIDEO_SHARE) ubiquitous.add(head);
      });
    }
    return { ubiquitous, total };
  }

  function buildVideoLinks(data, pool, ubiquitousVideoHeads) {
    const heads = new Set();
    for (let i = 0; i < pool.length; i += 1) {
      const head = pool[i].head;
      if (!ubiquitousVideoHeads.has(head)) heads.add(head);
    }
    if (!heads.size) return [];

    const videos = asArray(data.video_catalog);
    const seen = new Set();
    const rows = [];
    for (let i = 0; i < videos.length; i += 1) {
      const video = videos[i] || {};
      const id = text(video.id);
      if (!id || seen.has(id)) continue;
      const related = asArray(video.related_entities);
      const matched = [];
      for (let j = 0; j < related.length; j += 1) {
        const head = text(related[j] && related[j].head);
        if (head && heads.has(head) && matched.indexOf(head) < 0) matched.push(head);
      }
      if (matched.length < MIN_VIDEO_MATCHES) continue;
      seen.add(id);
      rows.push({
        id,
        title: text(video.title) || id,
        matched,
        score: matched.length,
      });
    }
    rows.sort((a, b) => (b.score - a.score) || a.title.localeCompare(b.title, 'ru'));
    return rows;
  }

  function buildModel(data) {
    const chapterIndex = buildChapterIndex(data);
    const activeBook = typeof root.getActiveBook === 'function' ? root.getActiveBook() : null;
    const bookId = text(activeBook && activeBook.book_id);
    const videoStats = buildUbiquitousVideoHeads(data);
    const domains = [];

    for (let i = 0; i < DOMAIN_SPEC.length; i += 1) {
      const spec = DOMAIN_SPEC[i];
      const evidence = collectEvidence(data, spec);
      const scope = buildDomainPages(spec, evidence, chapterIndex);
      const matched = matchEntities(data, bookId, scope.pages);
      domains.push({
        id: spec.id,
        title: spec.title,
        note: spec.note,
        viz: spec.viz,
        vizLabel: spec.vizLabel,
        evidence,
        chapters: scope.chapters,
        pageCount: scope.pages.size,
        entityCount: matched.length,
        entities: matched.slice(0, POOL_SIZE),
        videos: [],
      });
    }

    // A head shared by almost every domain carries no information about any of
    // them, so it is excluded from both bridges and video links.
    const domainsByHead = new Map();
    for (let i = 0; i < domains.length; i += 1) {
      const heads = new Set(domains[i].entities.map((entity) => entity.head));
      heads.forEach((head) => {
        domainsByHead.set(head, (domainsByHead.get(head) || 0) + 1);
      });
    }
    const ubiquitousHeads = new Set();
    domainsByHead.forEach((count, head) => {
      if (count >= UBIQUITOUS_DOMAINS) ubiquitousHeads.add(head);
    });
    const videoStopHeads = new Set(ubiquitousHeads);
    videoStats.ubiquitous.forEach((head) => videoStopHeads.add(head));

    for (let i = 0; i < domains.length; i += 1) {
      domains[i].videos = buildVideoLinks(data, domains[i].entities, videoStopHeads);
    }

    const shared = new Map();
    for (let i = 0; i < domains.length; i += 1) {
      const left = new Set(
        domains[i].entities
          .map((entity) => entity.head)
          .filter((head) => !ubiquitousHeads.has(head))
      );
      for (let j = i + 1; j < domains.length; j += 1) {
        let count = 0;
        const heads = [];
        for (let k = 0; k < domains[j].entities.length; k += 1) {
          const head = domains[j].entities[k].head;
          if (ubiquitousHeads.has(head) || !left.has(head)) continue;
          count += 1;
          if (heads.length < 5) heads.push(head);
        }
        if (!count) continue;
        shared.set(`${domains[i].id}|${domains[j].id}`, { count, heads });
      }
    }

    return { domains, shared, bookId };
  }

  function sharedBetween(model, a, b) {
    return model.shared.get(`${a}|${b}`) || model.shared.get(`${b}|${a}`) || null;
  }

  function svgEl(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    const map = attrs || {};
    Object.keys(map).forEach((key) => {
      const value = map[key];
      if (value === null || value === undefined) return;
      node.setAttribute(key, String(value));
    });
    return node;
  }

  function nodeRadius(count) {
    return Math.round(13 + Math.min(20, Math.sqrt(Math.max(0, count)) * 4));
  }

  function ringPositions(total, cx, cy, radius) {
    const positions = [];
    const count = Math.max(1, total);
    for (let i = 0; i < count; i += 1) {
      const angle = ((i / count) * Math.PI * 2) - (Math.PI / 2);
      positions.push({
        x: cx + (Math.cos(angle) * radius),
        y: cy + (Math.sin(angle) * radius),
        angle,
      });
    }
    return positions;
  }

  function appendLabel(parent, x, y, angle, label, className) {
    const rightSide = Math.cos(angle) >= 0;
    const node = svgEl('text', {
      x: x + (rightSide ? 12 : -12),
      y: y + 4,
      'text-anchor': rightSide ? 'start' : 'end',
      class: className,
    });
    node.textContent = label;
    parent.appendChild(node);
    return node;
  }

  function renderResearchMap(container) {
    if (!container) return;
    const shell = root.VizShell;
    const data = root.APP_DATA || {};
    const escape = shell && typeof shell.escapeHtml === 'function'
      ? shell.escapeHtml
      : (value) => String(value == null ? '' : value);

    const model = buildModel(data);
    if (!model.domains.length) {
      if (shell) shell.showStatus(container, 'empty', 'Нет данных', 'Не найдено ни одного направления исследований.');
      return;
    }

    const params = typeof root.readVizParams === 'function' ? root.readVizParams() : new URLSearchParams();
    const domainIds = model.domains.map((domain) => domain.id);
    let currentDomain = text(params.get('filter'));
    if (domainIds.indexOf(currentDomain) < 0) currentDomain = 'all';
    let currentTop = Number(params.get('top') || DEFAULT_TOP);
    if (!Number.isFinite(currentTop)) currentTop = DEFAULT_TOP;
    currentTop = Math.max(MIN_TOP, Math.min(MAX_TOP, Math.round(currentTop)));
    let showBridges = true;

    const filtersHtml = [
      '<label>Направление: <select data-role="rmap-domain">',
      '<option value="all">Все направления</option>',
      ...model.domains.map((domain) => `<option value="${escape(domain.id)}">${escape(domain.title)}</option>`),
      '</select></label>',
      `<label>Сущностей: <input data-role="rmap-top" class="viz-input-narrow" type="number" min="${MIN_TOP}" max="${MAX_TOP}" step="1" value="${String(currentTop)}"></label>`,
      '<label><input data-role="rmap-bridges" type="checkbox" checked> связи направлений</label>',
      '<span data-role="rmap-summary" class="viz-note"></span>',
    ].join('');

    const bodyHtml = [
      '<div class="rmap-layout">',
      '  <div class="rmap-canvas viz-svg-wrap">',
      `    <svg data-role="rmap-svg" class="viz-svg-bg rmap-svg" width="100%" height="${VIEW_H}" viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Карта направлений исследований"></svg>`,
      '  </div>',
      '  <aside class="rmap-detail" data-role="rmap-detail" aria-live="polite"></aside>',
      '</div>',
    ].join('');

    if (shell && typeof shell.buildModuleCard === 'function') {
      container.innerHTML = shell.buildModuleCard({
        className: 'viz-research-map',
        title: 'VIZ-08 · Исследовательская карта',
        dataSource: 'scholar.* + chapters + сущности + video_catalog',
        filtersHtml,
        exportFilename: 'viz-research-map.svg',
        emptyHtml: shell.emptyStateHtml(
          'Нет связей.',
          'Для выбранного направления не нашлось сущностей в границах его глав и страниц.'
        ),
        bodyHtml,
      });
    } else {
      container.innerHTML = [
        '<div class="viz-card viz-research-map">',
        `  <div class="viz-toolbar"><div class="viz-toolbar-filters">${filtersHtml}</div></div>`,
        '  <div class="viz-empty-state" hidden><strong>Нет связей.</strong></div>',
        bodyHtml,
        '</div>',
      ].join('');
    }

    const svg = container.querySelector('[data-role="rmap-svg"]');
    const detail = container.querySelector('[data-role="rmap-detail"]');
    const summary = container.querySelector('[data-role="rmap-summary"]');
    const empty = container.querySelector('.viz-empty-state');
    const domainSelect = container.querySelector('[data-role="rmap-domain"]');
    const topInput = container.querySelector('[data-role="rmap-top"]');
    const bridgesInput = container.querySelector('[data-role="rmap-bridges"]');

    if (domainSelect) domainSelect.value = currentDomain;

    function domainById(id) {
      for (let i = 0; i < model.domains.length; i += 1) {
        if (model.domains[i].id === id) return model.domains[i];
      }
      return null;
    }

    function openEntityCard(type, head) {
      if (!head) return;
      const types = root.ENTITY_TYPES && typeof root.ENTITY_TYPES === 'object' ? root.ENTITY_TYPES : null;
      const safeType = types && types[type] ? type : 'names';
      if (typeof root.navigateTo === 'function') {
        root.navigateTo(safeType, 'card', head);
        return;
      }
      if (typeof root.navigateToItem === 'function') root.navigateToItem(safeType, head);
    }

    function bindNode(node, label, onOpen) {
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      node.setAttribute('aria-label', label);
      node.classList.add('rmap-clickable');
      node.addEventListener('click', onOpen);
      node.addEventListener('keydown', (event) => {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen();
      });
    }

    function drawOverview() {
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const positions = ringPositions(model.domains.length, cx, cy, 176);
      const bridges = svgEl('g', { class: 'rmap-bridges' });
      const links = svgEl('g', { class: 'rmap-spokes' });
      const nodes = svgEl('g', { class: 'rmap-nodes' });

      if (showBridges) {
        for (let i = 0; i < model.domains.length; i += 1) {
          for (let j = i + 1; j < model.domains.length; j += 1) {
            const link = sharedBetween(model, model.domains[i].id, model.domains[j].id);
            if (!link || link.count < 2) continue;
            const line = svgEl('line', {
              x1: positions[i].x,
              y1: positions[i].y,
              x2: positions[j].x,
              y2: positions[j].y,
              class: 'rmap-bridge',
              'stroke-width': Math.min(4, 1 + (link.count / 4)),
            });
            const title = svgEl('title');
            title.textContent = `${model.domains[i].title} ↔ ${model.domains[j].title}: ${link.count} общих (${link.heads.join(', ')})`;
            line.appendChild(title);
            bridges.appendChild(line);
          }
        }
      }

      for (let i = 0; i < model.domains.length; i += 1) {
        const domain = model.domains[i];
        const pos = positions[i];
        links.appendChild(svgEl('line', {
          x1: cx,
          y1: cy,
          x2: pos.x,
          y2: pos.y,
          class: 'rmap-spoke',
          'stroke-width': Math.min(6, 1.2 + (domain.evidence.length / 3)),
        }));

        const group = svgEl('g', { class: 'rmap-node rmap-node-domain' });
        const circle = svgEl('circle', {
          cx: pos.x,
          cy: pos.y,
          r: nodeRadius(domain.evidence.length),
          class: 'rmap-dot rmap-dot-domain',
        });
        const title = svgEl('title');
        title.textContent = `${domain.title}: свидетельств ${domain.evidence.length}, сущностей ${domain.entityCount}, видео ${domain.videos.length}`;
        circle.appendChild(title);
        group.appendChild(circle);

        const count = svgEl('text', {
          x: pos.x,
          y: pos.y + 4,
          'text-anchor': 'middle',
          class: 'rmap-dot-count',
        });
        count.textContent = String(domain.evidence.length);
        group.appendChild(count);

        appendLabel(group, pos.x, pos.y + nodeRadius(domain.evidence.length) + 2, pos.angle, clip(domain.title, 28), 'rmap-label');
        bindNode(group, domain.title, () => {
          currentDomain = domain.id;
          if (domainSelect) domainSelect.value = domain.id;
          writeParams();
          redraw();
        });
        nodes.appendChild(group);
      }

      const hub = svgEl('g', { class: 'rmap-node rmap-node-hub' });
      hub.appendChild(svgEl('circle', { cx, cy, r: 40, class: 'rmap-dot rmap-dot-hub' }));
      const hubLabel = svgEl('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'rmap-hub-label' });
      hubLabel.textContent = 'А. А. Зализняк';
      hub.appendChild(hubLabel);

      svg.appendChild(bridges);
      svg.appendChild(links);
      svg.appendChild(nodes);
      svg.appendChild(hub);
    }

    function drawFocus(domain) {
      const cx = VIEW_W / 2;
      const cy = VIEW_H / 2;
      const satellites = domain.entities.slice(0, currentTop);
      const positions = ringPositions(satellites.length, cx, cy, 168);
      const links = svgEl('g', { class: 'rmap-spokes' });
      const nodes = svgEl('g', { class: 'rmap-nodes' });

      for (let i = 0; i < satellites.length; i += 1) {
        const entity = satellites[i];
        const pos = positions[i];
        links.appendChild(svgEl('line', {
          x1: cx,
          y1: cy,
          x2: pos.x,
          y2: pos.y,
          class: 'rmap-spoke',
          'stroke-width': Math.min(5, 1 + (entity.hits / 3)),
        }));

        const group = svgEl('g', { class: `rmap-node rmap-node-entity rmap-node-${entity.type}` });
        const circle = svgEl('circle', {
          cx: pos.x,
          cy: pos.y,
          r: Math.round(8 + Math.min(10, Math.sqrt(entity.hits) * 3)),
          class: `rmap-dot rmap-dot-entity rmap-dot-${entity.type}`,
        });
        const title = svgEl('title');
        title.textContent = `${entity.head} (${entity.type}): упоминаний в границах направления — ${entity.hits}`;
        circle.appendChild(title);
        group.appendChild(circle);
        appendLabel(group, pos.x, pos.y, pos.angle, clip(entity.head, 22), 'rmap-label');
        bindNode(group, `${entity.head} — открыть карточку`, () => openEntityCard(entity.type, entity.head));
        nodes.appendChild(group);
      }

      const hub = svgEl('g', { class: 'rmap-node rmap-node-hub' });
      hub.appendChild(svgEl('circle', { cx, cy, r: 54, class: 'rmap-dot rmap-dot-hub' }));
      const words = clip(domain.title, 46).split(' ');
      const lines = [];
      let line = '';
      for (let i = 0; i < words.length; i += 1) {
        const next = line ? `${line} ${words[i]}` : words[i];
        if (next.length > 14 && line) {
          lines.push(line);
          line = words[i];
        } else {
          line = next;
        }
      }
      if (line) lines.push(line);
      const shown = lines.slice(0, 4);
      for (let i = 0; i < shown.length; i += 1) {
        const node = svgEl('text', {
          x: cx,
          y: cy - ((shown.length - 1) * 6) + (i * 12) + 4,
          'text-anchor': 'middle',
          class: 'rmap-hub-label rmap-hub-label-small',
        });
        node.textContent = shown[i];
        hub.appendChild(node);
      }

      svg.appendChild(links);
      svg.appendChild(nodes);
      svg.appendChild(hub);
    }

    function overviewDetailHtml() {
      const rows = model.domains.map((domain) => [
        '<tr>',
        `<td><button type="button" class="rmap-link" data-domain="${escape(domain.id)}">${escape(domain.title)}</button></td>`,
        `<td class="rmap-num">${String(domain.evidence.length)}</td>`,
        `<td class="rmap-num">${String(domain.pageCount)}</td>`,
        `<td class="rmap-num">${String(domain.entityCount)}</td>`,
        `<td class="rmap-num">${String(domain.videos.length)}</td>`,
        '</tr>',
      ].join('')).join('');

      const bridges = [];
      for (let i = 0; i < model.domains.length; i += 1) {
        for (let j = i + 1; j < model.domains.length; j += 1) {
          const link = sharedBetween(model, model.domains[i].id, model.domains[j].id);
          if (!link || link.count < 2) continue;
          bridges.push({ a: model.domains[i], b: model.domains[j], link });
        }
      }
      bridges.sort((x, y) => y.link.count - x.link.count);

      return [
        '<h4 class="rmap-detail-title">Все направления</h4>',
        '<p class="rmap-detail-note">Узел — направление исследований; размер ∝ числу свидетельств, пунктир — общие сущности. Выберите узел, чтобы раскрыть его.</p>',
        '<table class="rmap-table"><thead><tr>',
        '<th>Направление</th><th class="rmap-num">свид.</th><th class="rmap-num">стр.</th><th class="rmap-num">сущн.</th><th class="rmap-num">видео</th>',
        '</tr></thead><tbody>',
        rows,
        '</tbody></table>',
        bridges.length
          ? [
            '<h5 class="rmap-detail-subtitle">Самые сильные связи</h5>',
            '<ul class="rmap-list">',
            bridges.slice(0, 5).map((row) => `<li><strong>${String(row.link.count)}</strong> общих — ${escape(row.a.title)} ↔ ${escape(row.b.title)}<br><span class="rmap-muted">${escape(row.link.heads.join(', '))}</span></li>`).join(''),
            '</ul>',
          ].join('')
          : '',
      ].join('');
    }

    function domainDetailHtml(domain) {
      const neighbours = [];
      for (let i = 0; i < model.domains.length; i += 1) {
        const other = model.domains[i];
        if (other.id === domain.id) continue;
        const link = sharedBetween(model, domain.id, other.id);
        if (!link) continue;
        neighbours.push({ other, link });
      }
      neighbours.sort((a, b) => b.link.count - a.link.count);

      const evidenceRows = domain.evidence.slice(0, 6).map((row) => [
        '<li>',
        `<span class="rmap-kind">${escape(row.kind)}</span> `,
        `<strong>${escape(clip(row.title, 90))}</strong>`,
        row.note ? `<br><span class="rmap-muted">${escape(clip(row.note, 150))}</span>` : '',
        row.pages.length ? `<br><span class="rmap-muted">стр. ${escape(row.pages.join(', '))}</span>` : '',
        '</li>',
      ].join('')).join('');

      return [
        `<h4 class="rmap-detail-title">${escape(domain.title)}</h4>`,
        `<p class="rmap-detail-note">${escape(domain.note)}</p>`,
        '<ul class="rmap-metrics">',
        `<li>свидетельств: <strong>${String(domain.evidence.length)}</strong></li>`,
        `<li>страниц в границах: <strong>${String(domain.pageCount)}</strong></li>`,
        `<li>сущностей: <strong>${String(domain.entityCount)}</strong> (на карте — ${String(domain.entities.length)})</li>`,
        `<li>видео: <strong>${String(domain.videos.length)}</strong></li>`,
        '</ul>',
        domain.chapters.length
          ? [
            '<h5 class="rmap-detail-subtitle">Главы</h5>',
            '<div class="rmap-chips">',
            domain.chapters.map((chapter) => `<button type="button" class="rmap-chip" data-chapter="${String(chapter.index)}">${escape(chapter.name)} <span class="rmap-muted">${String(chapter.start)}–${String(chapter.end)}</span></button>`).join(''),
            '</div>',
          ].join('')
          : '',
        evidenceRows
          ? [
            '<h5 class="rmap-detail-subtitle">Свидетельства</h5>',
            `<ul class="rmap-list">${evidenceRows}</ul>`,
            domain.evidence.length > 6 ? `<p class="rmap-muted">и ещё ${String(domain.evidence.length - 6)}</p>` : '',
          ].join('')
          : '',
        domain.entities.length
          ? [
            '<h5 class="rmap-detail-subtitle">Ключевые сущности</h5>',
            '<div class="rmap-chips">',
            domain.entities.slice(0, 12).map((entity) => `<button type="button" class="rmap-chip rmap-chip-${escape(entity.type)}" data-entity-head="${escape(entity.head)}" data-entity-type="${escape(entity.type)}">${escape(entity.head)} <span class="rmap-muted">${String(entity.hits)}</span></button>`).join(''),
            '</div>',
          ].join('')
          : '',
        domain.videos.length
          ? [
            '<h5 class="rmap-detail-subtitle">Видео</h5>',
            '<ul class="rmap-list">',
            domain.videos.slice(0, 4).map((video) => `<li><button type="button" class="rmap-link" data-video="${escape(video.id)}">${escape(clip(video.title, 80))}</button><br><span class="rmap-muted">совпадений: ${String(video.score)} — ${escape(video.matched.slice(0, 3).join(', '))}</span></li>`).join(''),
            '</ul>',
          ].join('')
          : '',
        neighbours.length
          ? [
            '<h5 class="rmap-detail-subtitle">Смежные направления</h5>',
            '<div class="rmap-chips">',
            neighbours.slice(0, 4).map((row) => `<button type="button" class="rmap-chip" data-domain="${escape(row.other.id)}">${escape(row.other.title)} <span class="rmap-muted">${String(row.link.count)}</span></button>`).join(''),
            '</div>',
          ].join('')
          : '',
        domain.viz
          ? `<p class="rmap-viz-link"><a class="related-link" href="#v4/scholar/viz/module/${escape(domain.viz)}">${escape(domain.vizLabel || domain.viz)} →</a></p>`
          : '',
      ].join('');
    }

    function wireDetailActions() {
      if (!detail) return;
      Array.from(detail.querySelectorAll('[data-domain]')).forEach((btn) => {
        btn.onclick = () => {
          currentDomain = text(btn.dataset.domain);
          if (domainSelect) domainSelect.value = currentDomain;
          writeParams();
          redraw();
        };
      });
      Array.from(detail.querySelectorAll('[data-entity-head]')).forEach((btn) => {
        btn.onclick = () => openEntityCard(text(btn.dataset.entityType), text(btn.dataset.entityHead));
      });
      Array.from(detail.querySelectorAll('[data-chapter]')).forEach((btn) => {
        btn.onclick = () => {
          const index = Number(btn.dataset.chapter);
          if (!Number.isFinite(index)) return;
          if (typeof root.openLecturePage === 'function') root.openLecturePage(index);
        };
      });
      Array.from(detail.querySelectorAll('[data-video]')).forEach((btn) => {
        btn.onclick = () => {
          const id = text(btn.dataset.video);
          if (!id) return;
          if (typeof root.openVideoDetail === 'function') root.openVideoDetail(id);
        };
      });
    }

    function writeParams() {
      if (typeof root.writeVizParams !== 'function') return;
      root.writeVizParams({
        filter: currentDomain === 'all' ? null : currentDomain,
        top: currentTop === DEFAULT_TOP ? null : currentTop,
      });
    }

    function redraw() {
      if (!svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const domain = currentDomain === 'all' ? null : domainById(currentDomain);
      if (currentDomain !== 'all' && !domain) currentDomain = 'all';

      if (domain) drawFocus(domain);
      else drawOverview();

      if (detail) {
        detail.innerHTML = domain ? domainDetailHtml(domain) : overviewDetailHtml();
        wireDetailActions();
      }

      if (summary) {
        summary.textContent = domain
          ? `${domain.evidence.length} свидетельств · ${domain.entityCount} сущностей · ${domain.videos.length} видео`
          : `${model.domains.length} направлений · ${model.shared.size} связей`;
      }
      if (empty) empty.hidden = !(domain && !domain.entities.length);
    }

    if (domainSelect) {
      domainSelect.onchange = () => {
        currentDomain = text(domainSelect.value) || 'all';
        writeParams();
        redraw();
      };
    }
    if (topInput) {
      topInput.onchange = () => {
        let next = Number(topInput.value || DEFAULT_TOP);
        if (!Number.isFinite(next)) next = DEFAULT_TOP;
        currentTop = Math.max(MIN_TOP, Math.min(MAX_TOP, Math.round(next)));
        topInput.value = String(currentTop);
        writeParams();
        redraw();
      };
    }
    if (bridgesInput) {
      bridgesInput.onchange = () => {
        showBridges = !!bridgesInput.checked;
        redraw();
      };
    }

    if (shell && typeof shell.wireModuleChrome === 'function') {
      shell.wireModuleChrome(container, {
        exportFilename: 'viz-research-map.svg',
        exportSelector: '[data-role="rmap-svg"]',
        onReset: () => {
          currentDomain = 'all';
          currentTop = DEFAULT_TOP;
          showBridges = true;
          if (domainSelect) domainSelect.value = 'all';
          if (topInput) topInput.value = String(DEFAULT_TOP);
          if (bridgesInput) bridgesInput.checked = true;
          writeParams();
          redraw();
        },
      });
    }

    container.__vizCleanup = () => {
      if (detail) detail.innerHTML = '';
    };

    redraw();
  }

  root.VIZ_MODULES.renderResearchMap = renderResearchMap;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
