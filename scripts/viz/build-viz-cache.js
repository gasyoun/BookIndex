(function (global) {
  'use strict';

  /** @typedef {import('../../types/app-data').AppData} AppData */

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.__vizCache = root.__vizCache || {};

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function getCenturyFromYear(year) {
    const n = finiteNumber(year);
    if (!n || n === 0) return null;
    if (n > 0) return Math.ceil(n / 100);
    return -Math.ceil(Math.abs(n) / 100);
  }

  function clampCentury(value) {
    const n = finiteNumber(value);
    if (!n) return null;
    return Math.round(n);
  }

  function toPageList(value) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (let i = 0; i < value.length; i += 1) {
      const p = finiteNumber(value[i]);
      if (!p) continue;
      out.push(Math.round(p));
    }
    return out;
  }

  function computeDataSignature(data) {
    const src = data || {};
    const parts = [
      src.schema_version || 0,
      Array.isArray(src.names) ? src.names.length : 0,
      Array.isArray(src.languages) ? src.languages.length : 0,
      Array.isArray(src.toponyms) ? src.toponyms.length : 0,
      Array.isArray(src.ethnonyms) ? src.ethnonyms.length : 0,
      Array.isArray(src.subject_index) ? src.subject_index.length : 0,
      Array.isArray(src.edges) ? src.edges.length : 0,
      Array.isArray(src.language_edges) ? src.language_edges.length : 0,
      Array.isArray(src.chapters) ? src.chapters.length : 0,
    ];
    return parts.join('|');
  }

  function clearCacheObject(cache) {
    Object.keys(cache || {}).forEach((key) => {
      delete cache[key];
    });
  }

  function buildChapterMeta(chapters) {
    const byName = new Map();
    const byIndex = [];
    for (let i = 0; i < chapters.length; i += 1) {
      const ch = chapters[i] || {};
      const entry = {
        index: i,
        name: String(ch.name || ''),
        start: finiteNumber(ch.start),
        end: finiteNumber(ch.end),
        century: clampCentury(ch.century),
      };
      byIndex.push(entry);
      byName.set(entry.name, entry);
    }
    return { byName, byIndex };
  }

  function pageBelongsToChapter(page, chapter) {
    if (!chapter) return false;
    if (!Number.isFinite(chapter.start) || !Number.isFinite(chapter.end)) return false;
    return page >= chapter.start && page <= chapter.end;
  }

  function overlapsChapter(pageList, chapter) {
    if (!Array.isArray(pageList) || !chapter) return false;
    for (let i = 0; i < pageList.length; i += 1) {
      if (pageBelongsToChapter(pageList[i], chapter)) return true;
    }
    return false;
  }

  function buildChapterGeoCentroids(appData, chapters) {
    const groups = ['languages', 'toponyms', 'ethnonyms'];
    const acc = new Array(chapters.length).fill(null).map(() => ({
      latSum: 0,
      lonSum: 0,
      count: 0,
    }));
    for (let g = 0; g < groups.length; g += 1) {
      const items = Array.isArray(appData[groups[g]]) ? appData[groups[g]] : [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i] || {};
        const lat = finiteNumber(item.lat);
        const lon = finiteNumber(item.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const pages = toPageList(item.page_list);
        for (let ci = 0; ci < chapters.length; ci += 1) {
          if (!overlapsChapter(pages, chapters[ci])) continue;
          acc[ci].latSum += lat;
          acc[ci].lonSum += lon;
          acc[ci].count += 1;
        }
      }
    }
    return acc.map((row) => {
      if (!row.count) return null;
      return {
        lat: row.latSum / row.count,
        lon: row.lonSum / row.count,
      };
    });
  }

  function collectChapterIndices(item, chapterMeta, chapters) {
    const out = new Set();
    const byName = chapterMeta.byName;
    const chapterNames = Array.isArray(item && item.chapters) ? item.chapters : [];
    for (let i = 0; i < chapterNames.length; i += 1) {
      const meta = byName.get(String(chapterNames[i] || ''));
      if (!meta) continue;
      out.add(meta.index);
    }
    if (out.size) return Array.from(out.values());
    const pages = toPageList(item && item.page_list);
    for (let ci = 0; ci < chapters.length; ci += 1) {
      if (overlapsChapter(pages, chapters[ci])) out.add(ci);
    }
    return Array.from(out.values());
  }

  function inferCentury(item, chapterMeta, chapters) {
    const explicitCentury = clampCentury(item && item.century);
    if (Number.isFinite(explicitCentury)) return explicitCentury;
    const fromEpoch = getCenturyFromYear(item && item.epoch);
    if (Number.isFinite(fromEpoch)) return fromEpoch;
    const chapterIndices = collectChapterIndices(item, chapterMeta, chapters);
    const candidates = [];
    for (let i = 0; i < chapterIndices.length; i += 1) {
      const c = clampCentury(chapters[chapterIndices[i]] && chapters[chapterIndices[i]].century);
      if (!Number.isFinite(c)) continue;
      candidates.push(c);
    }
    if (!candidates.length) return null;
    const sum = candidates.reduce((acc, n) => acc + n, 0);
    return Math.round(sum / candidates.length);
  }

  function inferCoordinates(item, chapterMeta, chapterGeo, chapters) {
    const lat = finiteNumber(item && item.lat);
    const lon = finiteNumber(item && item.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };

    const chapterIndices = collectChapterIndices(item, chapterMeta, chapters);
    let latSum = 0;
    let lonSum = 0;
    let hits = 0;
    for (let i = 0; i < chapterIndices.length; i += 1) {
      const geo = chapterGeo[chapterIndices[i]];
      if (!geo) continue;
      latSum += geo.lat;
      lonSum += geo.lon;
      hits += 1;
    }
    if (!hits) return { lat: null, lon: null };
    return { lat: latSum / hits, lon: lonSum / hits };
  }

  function ensurePageBucket(pageMap, page) {
    if (!pageMap.has(page)) {
      pageMap.set(page, { names: new Set(), languages: new Set() });
    }
    return pageMap.get(page);
  }

  function buildPageEntityIndex(appData) {
    const byPage = new Map();
    const names = Array.isArray(appData.names) ? appData.names : [];
    const languages = Array.isArray(appData.languages) ? appData.languages : [];

    for (let i = 0; i < names.length; i += 1) {
      const n = names[i] || {};
      const head = String(n.head || '').trim();
      if (!head) continue;
      const pages = toPageList(n.page_list);
      for (let pi = 0; pi < pages.length; pi += 1) {
        ensurePageBucket(byPage, pages[pi]).names.add(head);
      }
    }
    for (let i = 0; i < languages.length; i += 1) {
      const l = languages[i] || {};
      const head = String(l.head || '').trim();
      if (!head) continue;
      const pages = toPageList(l.page_list);
      for (let pi = 0; pi < pages.length; pi += 1) {
        ensurePageBucket(byPage, pages[pi]).languages.add(head);
      }
    }

    return byPage;
  }

  function edgeMapToArray(edgeMap) {
    return Array.from(edgeMap.values())
      .sort((a, b) => b.weight - a.weight || String(a.source).localeCompare(String(b.source), 'ru'));
  }

  function makeEdgeKey(a, b) {
    const left = `${a.type}::${a.id}`;
    const right = `${b.type}::${b.id}`;
    return left < right ? `${left}__${right}` : `${right}__${left}`;
  }

  function putEdge(edgeMap, a, b) {
    const key = makeEdgeKey(a, b);
    if (!edgeMap.has(key)) {
      const leftFirst = `${a.type}::${a.id}` < `${b.type}::${b.id}`;
      edgeMap.set(key, {
        source: leftFirst ? a.id : b.id,
        sourceType: leftFirst ? a.type : b.type,
        target: leftFirst ? b.id : a.id,
        targetType: leftFirst ? b.type : a.type,
        weight: 0,
      });
    }
    edgeMap.get(key).weight += 1;
  }

  function buildCoGraphByLecture(chapters, pageEntityIndex) {
    const allEdges = new Map();
    const byLecture = {};
    const lectureMeta = [];
    const nodeTypeById = {};

    for (let ci = 0; ci < chapters.length; ci += 1) {
      const chapter = chapters[ci] || {};
      const edgeMap = new Map();
      const start = finiteNumber(chapter.start);
      const end = finiteNumber(chapter.end);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        for (let p = start; p <= end; p += 1) {
          const page = pageEntityIndex.get(p);
          if (!page) continue;
          const entities = [];
          page.names.forEach((name) => {
            entities.push({ id: name, type: 'names' });
            nodeTypeById[name] = nodeTypeById[name] || 'names';
          });
          page.languages.forEach((lang) => {
            entities.push({ id: lang, type: 'languages' });
            if (!nodeTypeById[lang]) nodeTypeById[lang] = 'languages';
          });
          if (entities.length < 2) continue;
          for (let i = 0; i < entities.length; i += 1) {
            for (let j = i + 1; j < entities.length; j += 1) {
              putEdge(edgeMap, entities[i], entities[j]);
              putEdge(allEdges, entities[i], entities[j]);
            }
          }
        }
      }
      byLecture[String(ci)] = edgeMapToArray(edgeMap);
      lectureMeta.push({
        id: String(ci),
        index: ci,
        name: String(chapter.name || `Лекция ${ci + 1}`),
        start: finiteNumber(chapter.start),
        end: finiteNumber(chapter.end),
      });
    }

    return {
      coGraph: edgeMapToArray(allEdges),
      coGraphByLecture: byLecture,
      coGraphLectureMeta: lectureMeta,
      nodeTypeById,
    };
  }

  function buildTermPagesByLecture(subjects, chapters) {
    const map = {};
    for (let si = 0; si < subjects.length; si += 1) {
      const s = subjects[si] || {};
      const head = String(s.head || '').trim();
      if (!head) continue;
      const pages = toPageList(s.page_list).sort((a, b) => a - b);
      if (!map[head]) {
        map[head] = new Array(chapters.length).fill(null).map(() => []);
      }
      for (let ci = 0; ci < chapters.length; ci += 1) {
        const ch = chapters[ci] || {};
        const start = finiteNumber(ch.start);
        const end = finiteNumber(ch.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        for (let pi = 0; pi < pages.length; pi += 1) {
          const p = pages[pi];
          if (p < start || p > end) continue;
          map[head][ci].push(p);
        }
      }
    }
    return map;
  }

  /**
   * Build visualization cache from already loaded APP_DATA.
   * @param {AppData} appData
   * @returns {Record<string, unknown>}
   */
  function buildVizCache(appData) {
    root.__vizCache = root.__vizCache || {};
    const cache = root.__vizCache;
    const data = appData || {};
    const signature = computeDataSignature(data);
    if (cache._built && cache._signature === signature) return cache;
    if (cache._built && cache._signature !== signature) clearCacheObject(cache);

    const startedAt = Date.now();
    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const subjects = Array.isArray(data.subject_index) ? data.subject_index : [];
    const chapterMeta = buildChapterMeta(chapters);

    // 1) termFreq: {chapterIdx: {term: count}}
    cache.termFreq = {};
    cache.termPagesByLecture = buildTermPagesByLecture(subjects, chapters);
    for (let ci = 0; ci < chapters.length; ci += 1) {
      const ch = chapters[ci] || {};
      const start = finiteNumber(ch.start);
      const end = finiteNumber(ch.end);
      const bucket = {};
      for (let si = 0; si < subjects.length; si += 1) {
        const s = subjects[si] || {};
        const head = String(s.head || '').trim();
        if (!head) continue;
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        const cnt = cache.termPagesByLecture[head][ci].length;
        if (cnt > 0) bucket[head] = cnt;
      }
      cache.termFreq[ci] = bucket;
    }

    // 2) coGraph + per-lecture coGraph
    const pageEntityIndex = buildPageEntityIndex(data);
    const coGraphBuilt = buildCoGraphByLecture(chapters, pageEntityIndex);
    cache.coGraph = coGraphBuilt.coGraph;
    cache.coGraphByLecture = coGraphBuilt.coGraphByLecture;
    cache.coGraphLectureMeta = coGraphBuilt.coGraphLectureMeta;
    cache.coGraphNodeTypeById = coGraphBuilt.nodeTypeById;

    // 3) langCoMatrix (top-20) + frequencies
    const languages = Array.isArray(data.languages) ? data.languages.slice() : [];
    cache.langFreq = {};
    for (let i = 0; i < languages.length; i += 1) {
      const l = languages[i] || {};
      const head = String(l.head || '').trim();
      if (!head) continue;
      cache.langFreq[head] = toPageList(l.page_list).length;
    }
    const topLangs = languages
      .sort((a, b) => toPageList(b && b.page_list).length - toPageList(a && a.page_list).length)
      .slice(0, 20)
      .map((l) => String(l && l.head ? l.head : '').trim())
      .filter(Boolean);
    const topSet = new Set(topLangs);
    const matrix = {};
    for (let i = 0; i < topLangs.length; i += 1) {
      const from = topLangs[i];
      matrix[from] = {};
      for (let j = 0; j < topLangs.length; j += 1) matrix[from][topLangs[j]] = 0;
    }
    const languageEdges = Array.isArray(data.language_edges) ? data.language_edges : [];
    for (let i = 0; i < languageEdges.length; i += 1) {
      const e = languageEdges[i] || {};
      const source = String(e.source || '');
      const target = String(e.target || '');
      const w = finiteNumber(e.weight) || 0;
      if (!topSet.has(source) || !topSet.has(target)) continue;
      matrix[source][target] = w;
      matrix[target][source] = w;
    }
    cache.langCoMatrix = matrix;
    cache.topLangs = topLangs;

    // 4) termRankByLecture: {term: [rank_l0, rank_l1, ...]}
    cache.termRankByLecture = {};
    for (let ci = 0; ci < chapters.length; ci += 1) {
      const freq = cache.termFreq[ci] || {};
      const sorted = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
      for (let rank = 0; rank < sorted.length; rank += 1) {
        const term = sorted[rank];
        if (!cache.termRankByLecture[term]) {
          cache.termRankByLecture[term] = new Array(chapters.length).fill(null);
        }
        cache.termRankByLecture[term][ci] = rank + 1;
      }
    }

    // 5) geoEntities: names/toponyms/ethnonyms/languages with derived century/coords
    const chapterGeo = buildChapterGeoCentroids(data, chapters);
    const geoEntities = [];
    const seen = new Set();
    const collect = (entityType, items) => {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i] || {};
        const head = String(item.head || '').trim();
        if (!head) continue;
        const unique = `${entityType}::${head}`;
        if (seen.has(unique)) continue;
        const century = inferCentury(item, chapterMeta, chapters);
        if (!Number.isFinite(century)) continue;
        const coords = inferCoordinates(item, chapterMeta, chapterGeo, chapters);
        if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) continue;
        seen.add(unique);
        geoEntities.push({
          id: head,
          name: head,
          entityType,
          century,
          epoch: finiteNumber(item.epoch),
          subcategory: String(item.subcategory || ''),
          chapters: Array.isArray(item.chapters) ? item.chapters.slice() : [],
          lat: coords.lat,
          lon: coords.lon,
        });
      }
    };
    collect('names', Array.isArray(data.names) ? data.names : []);
    collect('toponyms', Array.isArray(data.toponyms) ? data.toponyms : []);
    collect('ethnonyms', Array.isArray(data.ethnonyms) ? data.ethnonyms : []);
    collect('languages', Array.isArray(data.languages) ? data.languages : []);
    cache.geoEntities = geoEntities;

    cache._built = true;
    cache._signature = signature;
    cache._builtAtMs = Date.now();
    cache._elapsedMs = cache._builtAtMs - startedAt;
    return cache;
  }

  root.buildVizCache = buildVizCache;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
