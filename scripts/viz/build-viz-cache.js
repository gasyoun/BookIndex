(function (global) {
  'use strict';

  const root = global || (typeof window !== 'undefined' ? window : globalThis);
  root.__vizCache = root.__vizCache || {};

  function getCenturyFromYear(year) {
    const n = Number(year);
    if (!Number.isFinite(n) || n === 0) return null;
    if (n > 0) return Math.ceil(n / 100);
    return -Math.ceil(Math.abs(n) / 100);
  }

  function overlapsChapter(pageList, chapter) {
    if (!Array.isArray(pageList) || !chapter) return false;
    const start = Number(chapter.start);
    const end = Number(chapter.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    for (let i = 0; i < pageList.length; i += 1) {
      const p = Number(pageList[i]);
      if (Number.isFinite(p) && p >= start && p <= end) return true;
    }
    return false;
  }

  function buildChapterMeta(chapters) {
    const byName = new Map();
    for (let i = 0; i < chapters.length; i += 1) {
      const ch = chapters[i] || {};
      const item = {
        index: i,
        name: String(ch.name || ''),
        start: Number(ch.start),
        end: Number(ch.end),
        century: Number.isFinite(Number(ch.century))
          ? Number(ch.century)
          : null,
      };
      byName.set(item.name, item);
    }
    return byName;
  }

  function buildChapterGeoCentroids(appData, chapters) {
    const perChapter = new Array(chapters.length).fill(null).map(() => ({
      latSum: 0,
      lonSum: 0,
      count: 0,
    }));
    const groups = ['languages', 'toponyms', 'ethnonyms'];
    for (let g = 0; g < groups.length; g += 1) {
      const items = Array.isArray(appData[groups[g]]) ? appData[groups[g]] : [];
      for (let i = 0; i < items.length; i += 1) {
        const it = items[i] || {};
        const lat = Number(it.lat);
        const lon = Number(it.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        for (let ci = 0; ci < chapters.length; ci += 1) {
          if (!overlapsChapter(it.page_list, chapters[ci])) continue;
          perChapter[ci].latSum += lat;
          perChapter[ci].lonSum += lon;
          perChapter[ci].count += 1;
        }
      }
    }
    return perChapter.map((row) => {
      if (!row.count) return null;
      return {
        lat: row.latSum / row.count,
        lon: row.lonSum / row.count,
      };
    });
  }

  function buildVizCache(appData) {
    root.__vizCache = root.__vizCache || {};
    if (root.__vizCache._built) return root.__vizCache;

    const startedAt = Date.now();
    const cache = root.__vizCache;
    const data = appData || {};
    const chapters = Array.isArray(data.chapters) ? data.chapters : [];
    const subjects = Array.isArray(data.subject_index) ? data.subject_index : [];

    // 1) termFreq: {chapterIdx: {term: count}}
    cache.termFreq = {};
    for (let ci = 0; ci < chapters.length; ci += 1) {
      const ch = chapters[ci] || {};
      const start = Number(ch.start);
      const end = Number(ch.end);
      const bucket = {};
      for (let si = 0; si < subjects.length; si += 1) {
        const s = subjects[si] || {};
        const head = String(s.head || '').trim();
        if (!head) continue;
        const pages = Array.isArray(s.page_list) ? s.page_list : [];
        let cnt = 0;
        for (let pi = 0; pi < pages.length; pi += 1) {
          const p = Number(pages[pi]);
          if (Number.isFinite(p) && p >= start && p <= end) cnt += 1;
        }
        if (cnt > 0) bucket[head] = cnt;
      }
      cache.termFreq[ci] = bucket;
    }

    // 2) coGraph
    const rawEdges = Array.isArray(data.edges) ? data.edges : [];
    cache.coGraph = rawEdges.map((e) => ({
      source: String(e && e.source ? e.source : ''),
      target: String(e && e.target ? e.target : ''),
      weight: Number(e && e.weight ? e.weight : 0) || 0,
    })).filter((e) => e.source && e.target);

    // 3) langCoMatrix + topLangs
    const languages = Array.isArray(data.languages) ? data.languages.slice() : [];
    const topLangs = languages
      .sort((a, b) => {
        const aLen = Array.isArray(a && a.page_list) ? a.page_list.length : 0;
        const bLen = Array.isArray(b && b.page_list) ? b.page_list.length : 0;
        return bLen - aLen;
      })
      .slice(0, 20)
      .map((l) => String(l && l.head ? l.head : '').trim())
      .filter(Boolean);
    const langSet = new Set(topLangs);
    const matrix = {};
    for (let i = 0; i < topLangs.length; i += 1) {
      const l1 = topLangs[i];
      matrix[l1] = {};
      for (let j = 0; j < topLangs.length; j += 1) {
        matrix[l1][topLangs[j]] = 0;
      }
    }
    const languageEdges = Array.isArray(data.language_edges) ? data.language_edges : [];
    for (let i = 0; i < languageEdges.length; i += 1) {
      const e = languageEdges[i] || {};
      const source = String(e.source || '');
      const target = String(e.target || '');
      const w = Number(e.weight) || 0;
      if (!langSet.has(source) || !langSet.has(target)) continue;
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

    // 5) geoEntities: names + inferred geo by chapter centroids
    const chapterByName = buildChapterMeta(chapters);
    const chapterGeo = buildChapterGeoCentroids(data, chapters);
    const names = Array.isArray(data.names) ? data.names : [];
    cache.geoEntities = [];
    for (let i = 0; i < names.length; i += 1) {
      const n = names[i] || {};
      const head = String(n.head || '').trim();
      if (!head) continue;
      if (!Number.isFinite(Number(n.epoch))) continue;
      const linkedChapterNames = Array.isArray(n.chapters) ? n.chapters : [];
      const chapterIndices = [];
      let century = getCenturyFromYear(n.epoch);
      for (let ci = 0; ci < linkedChapterNames.length; ci += 1) {
        const meta = chapterByName.get(String(linkedChapterNames[ci] || ''));
        if (!meta) continue;
        chapterIndices.push(meta.index);
        if (!Number.isFinite(century) && Number.isFinite(meta.century)) century = meta.century;
      }
      let latSum = 0;
      let lonSum = 0;
      let hits = 0;
      for (let ci = 0; ci < chapterIndices.length; ci += 1) {
        const geo = chapterGeo[chapterIndices[ci]];
        if (!geo) continue;
        latSum += geo.lat;
        lonSum += geo.lon;
        hits += 1;
      }
      const lat = hits ? (latSum / hits) : null;
      const lon = hits ? (lonSum / hits) : null;
      cache.geoEntities.push({
        id: head,
        name: head,
        epoch: Number(n.epoch),
        century: Number.isFinite(century) ? century : getCenturyFromYear(n.epoch),
        subcategory: String(n.subcategory || ''),
        chapters: linkedChapterNames,
        lat,
        lon,
      });
    }

    cache._built = true;
    cache._builtAtMs = Date.now();
    cache._elapsedMs = cache._builtAtMs - startedAt;
    return cache;
  }

  root.buildVizCache = buildVizCache;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
