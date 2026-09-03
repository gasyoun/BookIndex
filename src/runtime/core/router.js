import {
  currentEntity,
  currentTab,
  currentLecture,
  selectedItem,
  selectedItemType,
  rightPaneMode,
  trendsRangeStart,
  trendsRangeEnd,
  searchQuery,
  currentScholarAnchor,
  currentGlossaryTerm,
  currentVizModule,
  currentVizQueryString,
  historyStack,
  isNavigatingHistory,
  suppressHashSync,
  expectedHash,
  MAX_HASH_PARTS,
  MAX_HASH_PART_LENGTH,
  HASH_ROUTE_PREFIX,
  MAX_LIST_QUERY_LENGTH,
  MAX_GLOBAL_QUERY_LENGTH,
  setCurrentEntity,
  setCurrentTab,
  setCurrentLecture,
  setSelectedItem,
  setSelectedItemType,
  setRightPaneMode,
  setTrendsRangeStart,
  setTrendsRangeEnd,
  setSearchQuery,
  setCurrentScholarAnchor,
  setPendingGlossaryQuery,
  setCurrentGlossaryTerm,
  setCurrentVizModule,
  setCurrentVizQueryString,
  setIsNavigatingHistory,
  setSuppressHashSync,
  setExpectedHash,
  setPendingScholarAnchor,
  setHistoryStack,
  syncStateToGlobal,
  syncStateFromGlobal,
  DEFAULT_TOTAL_PAGES,
  lectureCompareA,
  setLectureCompareA,
  lectureCompareB,
  setLectureCompareB,
  sortMostFrequentFirst,
  setSortMostFrequentFirst,
  currentKwicSource,
  setCurrentKwicSource,
  currentKwicQuery,
  setCurrentKwicQuery,
  currentKwicSort,
  setCurrentKwicSort,
  currentKwicPageStart,
  setCurrentKwicPageStart,
  currentKwicPageEnd,
  setCurrentKwicPageEnd,
  onlyDiscussed,
  setOnlyDiscussed,
  onlyQuestionCandidates,
  setOnlyQuestionCandidates,
  activeFilters,
  setActiveFilters,
  globalSearchScope,
  setGlobalSearchScope,
  ENTITY_TYPES,
  APP_DATA,
  currentVideoId,
  setCurrentVideoId
} from './state.js';

import {
  clampUiInput,
  clampPageInBook,
  encodeItemHeadForHash,
  resolveItemHeadFromHash,
  safeSetAttr,
  normalizeKwicSource,
  normalizeKwicSort,
  normalizePageRangeInBook,
  getTotalBookPages
} from './utils.js';

import {
  getCorpusBooks,
  getActiveBook,
  applyActiveBookFromQuery
} from './data.js';



export const ROUTE_SEO_METADATA = {
  'home/home': {
    title: 'Зализнякиада — Главная | BookIndex',
    desc: 'Вход в интерактивный справочник по книге А. А. Зализняка. Указатели, лекции, KWIC-конкорданс.'
  },
  'materials/lectures': {
    title: 'Лекции А. А. Зализняка — Читать онлайн | BookIndex',
    desc: '11 научно-популярных лекций академика А. А. Зализняка с интерактивными примечаниями.'
  },
  'materials/lecture_pages': {
    title: 'Страница лекции | BookIndex',
    desc: 'Читать лекцию А. А. Зализняка с научным аппаратом и интерактивным поиском.'
  },
  'all/list': {
    title: 'Сводный указатель терминов, имен и языков | BookIndex',
    desc: '3376 лингвистических и исторических объектов в интерактивном указателе.'
  },
  'names/list': {
    title: 'Указатель имен | BookIndex',
    desc: 'Персоналии, исследователи и упомянутые исторические лица в книге А. А. Зализняка.'
  },
  'toponyms/list': {
    title: 'Указатель географических названий | BookIndex',
    desc: 'Географические объекты, топонимы, карты и исторические места.'
  },
  'ethnonyms/list': {
    title: 'Этнонимы и народы | BookIndex',
    desc: 'Племена, народы, языковые общности в исследованиях А. А. Зализняка.'
  },
  'languages/list': {
    title: 'Языки мира и диалекты | BookIndex',
    desc: 'Языковые древа, языковые группы и диалектология в книге.'
  },
  'lexicon/list': {
    title: 'Сводный лексический указатель | BookIndex',
    desc: 'Слова, корни, праславянские реконструкции и этимологические связи.'
  },
  'materials/sources': {
    title: 'Корпус и источники | BookIndex',
    desc: 'Информационная база, редакторские очереди и планируемые видеоматериалы.'
  },
  'scholar/viz': {
    title: 'Визуализации и графики | BookIndex',
    desc: 'Интерактивные карты, тепловые матрицы, графы связей и шкала открытий.'
  },
  'materials/tasks': {
    title: 'Интерактивный практикум | BookIndex',
    desc: 'Проверьте свои знания по лекциям и справочным материалам.'
  }
};

export function updateSEOMetadata(routePath, dynamicTitleSuffix = '') {
  if (typeof document === 'undefined') return;
  const config = ROUTE_SEO_METADATA[routePath] || ROUTE_SEO_METADATA['home/home'];
  const title = dynamicTitleSuffix ? `${dynamicTitleSuffix} | BookIndex` : config.title;
  
  document.title = title;
  
  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content', config.desc);
  
  // Update OpenGraph
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', title);
  
  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', config.desc);
  
  // Update Canonical Link to represent the virtual route
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', `https://gasyoun.github.io/BookIndex/aaz-index.html#v4/${routePath}`);
  }
}

export function updateStructuredData(schemaObj) {
  if (typeof document === 'undefined') return;
  const script = document.getElementById('schema-seo-dynamic');
  if (!script) return;
  
  if (schemaObj) {
    script.textContent = JSON.stringify(schemaObj, null, 2);
  } else {
    script.textContent = '{}';
  }
}

export function encodeHashPart(value) {
  return encodeURIComponent(String(value));
}

export function buildCanonicalHash(parts) {
  const safeParts = [HASH_ROUTE_PREFIX, ...(Array.isArray(parts) ? parts : [])];
  return '#' + safeParts.map(encodeHashPart).join('/');
}

export function parseHashRoute(hash) {
  const cleanHash = String(hash || '').trim();
  if (!cleanHash || cleanHash === '#') return null;
  const queryStart = cleanHash.indexOf('?');
  const hashPath = queryStart >= 0 ? cleanHash.slice(0, queryStart) : cleanHash;
  const query = queryStart >= 0 ? cleanHash.slice(queryStart + 1) : '';
  const rawParts = hashPath.replace(/^#/, '').split('/').filter(Boolean);
  if (!rawParts.length || rawParts.length > MAX_HASH_PARTS + 1) return null;

  const decodedParts = [];
  for (const part of rawParts) {
    let decoded = '';
    try { decoded = decodeURIComponent(part); } catch (e) { decoded = part; }
    decoded = String(decoded || '');
    if (decoded.length > MAX_HASH_PART_LENGTH) return null;
    decodedParts.push(decoded);
  }

  let parts = decodedParts[0] === HASH_ROUTE_PREFIX ? decodedParts.slice(1) : decodedParts;
  if (parts[0] === 'books' && parts[1]) {
    const bookId = parts[1];
    const knownBook = getCorpusBooks().some(book => book.book_id === bookId);
    if (!knownBook) return null;
    parts = parts.slice(2);
  }
  if (!parts.length || parts.length > MAX_HASH_PARTS) return null;
  return { parts, query: query.slice(0, 240) };
}

export function routeVizAlias(parts) {
  if (!Array.isArray(parts)) return parts;
  if (parts.length === 1 && parts[0] === 'viz') return ['scholar', 'viz'];
  if (parts[0] === 'corpus' && parts[1] === 'sources') return ['materials', 'sources'];
  if (parts[0] === 'corpus' && parts[1] === 'viz') return ['scholar', 'viz', ...parts.slice(2)];
  return parts;
}

export function routeValueAfter(parts, marker) {
  const pos = Array.isArray(parts) ? parts.indexOf(marker) : -1;
  return pos >= 0 ? parts[pos + 1] : '';
}

export function parsePositiveRouteNumber(value) {
  const raw = String(value || '');
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
}

export function buildHashFromState() {
  syncStateFromGlobal();
  const parts = [currentEntity, currentTab];
  if (currentEntity === "materials" && currentTab === "lectures") {
    const readingPage = typeof window !== "undefined" ? parseInt(window.localStorage.getItem("Zalizniakiada.readingPage.v1"), 10) : null;
    if (Number.isFinite(readingPage)) parts.push("reading", String(clampPageInBook(readingPage)));
  }
  if (currentEntity === "materials" && currentTab === "lecture_pages") parts.push(String(Math.max(0, currentLecture)));
  if (currentEntity === "materials" && currentTab === "video" && currentVideoId) parts.push(String(currentVideoId));
  if (currentEntity === "materials" && currentTab === "glossary" && currentGlossaryTerm) parts.push("term", currentGlossaryTerm);
  if (currentEntity === "scholar" && currentTab === "scholar" && currentScholarAnchor) parts.push("anchor", currentScholarAnchor);
  if (currentEntity === "scholar" && currentTab === "page_trends") {
    const start = clampPageInBook(trendsRangeStart);
    const end = clampPageInBook(trendsRangeEnd);
    parts.push("range", String(Math.min(start, end)), String(Math.max(start, end)));
  }
  if (currentEntity === "scholar" && currentTab === "viz" && currentVizModule) parts.push("module", String(currentVizModule));
  if (currentTab === "list" && searchQuery && !selectedItem) parts.push("q", searchQuery);
  if (selectedItem && rightPaneMode === "card") {
    const itemType = selectedItemType || currentEntity;
    const itemHashHead = encodeItemHeadForHash(itemType, selectedItem);
    parts.push("item", itemType, itemHashHead);
  }
  const hash = buildCanonicalHash(parts);
  if (currentEntity === "scholar" && currentTab === "viz" && currentVizQueryString) return `${hash}?${currentVizQueryString}`;
  return hash;
}

const UI_STATE_SCHEMA_VERSION = 3;

function normalizeGlobalSearchScope(scope) {
  return scope === 'corpus' ? 'corpus' : 'current';
}

export function captureViewState() {
  syncStateFromGlobal();
  const globalSearchInput = typeof document !== "undefined" ? document.getElementById("global-search") : null;
  return {
    version: UI_STATE_SCHEMA_VERSION,
    currentEntity: currentEntity,
    currentTab: currentTab,
    selectedItem: selectedItem,
    selectedItemType: selectedItemType,
    rightPaneMode: rightPaneMode,
    currentLecture: currentLecture,
    currentVideoId: currentVideoId,
    lectureCompareA: lectureCompareA,
    lectureCompareB: lectureCompareB,
    trendsRangeStart: trendsRangeStart,
    trendsRangeEnd: trendsRangeEnd,
    searchQuery: searchQuery,
    sortMostFrequentFirst: sortMostFrequentFirst,
    onlyDiscussed: onlyDiscussed,
    onlyQuestionCandidates: onlyQuestionCandidates,
    currentGlossaryTerm: currentGlossaryTerm,
    currentScholarAnchor: currentScholarAnchor,
    currentKwicSource: currentKwicSource,
    currentKwicQuery: currentKwicQuery,
    currentKwicSort: currentKwicSort,
    currentKwicPageStart: currentKwicPageStart,
    currentKwicPageEnd: currentKwicPageEnd,
    activeFilters: Array.from(activeFilters),
    globalSearchQuery: globalSearchInput ? String(globalSearchInput.value || "") : "",
    globalSearchScope: globalSearchScope
  };
}

export function sameViewState(a, b) {
  if (!a || !b) return false;
  const aFilters = Array.isArray(a.activeFilters) ? a.activeFilters.join('|') : '';
  const bFilters = Array.isArray(b.activeFilters) ? b.activeFilters.join('|') : '';
  return a.currentEntity === b.currentEntity &&
    a.currentTab === b.currentTab &&
    a.selectedItem === b.selectedItem &&
    a.selectedItemType === b.selectedItemType &&
    a.rightPaneMode === b.rightPaneMode &&
    a.currentLecture === b.currentLecture &&
    a.lectureCompareA === b.lectureCompareA &&
    a.lectureCompareB === b.lectureCompareB &&
    a.trendsRangeStart === b.trendsRangeStart &&
    a.trendsRangeEnd === b.trendsRangeEnd &&
    (a.currentGlossaryTerm || '') === (b.currentGlossaryTerm || '') &&
    (a.currentScholarAnchor || '') === (b.currentScholarAnchor || '') &&
    (a.currentKwicSource || 'lexicon') === (b.currentKwicSource || 'lexicon') &&
    (a.currentKwicQuery || '') === (b.currentKwicQuery || '') &&
    (a.currentKwicSort || 'left') === (b.currentKwicSort || 'left') &&
    (a.currentKwicPageStart || 1) === (b.currentKwicPageStart || 1) &&
    (a.currentKwicPageEnd || getTotalBookPages()) === (b.currentKwicPageEnd || getTotalBookPages()) &&
    (a.searchQuery || '') === (b.searchQuery || '') &&
    normalizeGlobalSearchScope(a.globalSearchScope) === normalizeGlobalSearchScope(b.globalSearchScope) &&
    !!a.sortMostFrequentFirst === !!b.sortMostFrequentFirst &&
    !!a.onlyDiscussed === !!b.onlyDiscussed &&
    !!a.onlyQuestionCandidates === !!b.onlyQuestionCandidates &&
    aFilters === bFilters;
}

export function applyViewState(state) {
  if (!state) return;
  const targetEntity = ENTITY_TYPES[state.currentEntity] ? state.currentEntity : "home";
  setCurrentEntity(targetEntity);
  let targetTab = state.currentTab || ENTITY_TYPES[targetEntity].tabs[0];
  if (!ENTITY_TYPES[targetEntity].tabs.includes(targetTab)) targetTab = ENTITY_TYPES[targetEntity].tabs[0];
  setCurrentTab(targetTab);
  setSelectedItem(state.selectedItem || null);
  setSelectedItemType(state.selectedItemType || null);
  setRightPaneMode(state.rightPaneMode || "histogram");
  setCurrentLecture(Number.isInteger(state.currentLecture) ? state.currentLecture : 0);
  setCurrentVideoId(typeof state.currentVideoId === "string" ? state.currentVideoId : "");
  setLectureCompareA(Number.isInteger(state.lectureCompareA) ? state.lectureCompareA : 1);
  setLectureCompareB(Number.isInteger(state.lectureCompareB) ? state.lectureCompareB : 2);
  setTrendsRangeStart(Number.isInteger(state.trendsRangeStart) ? state.trendsRangeStart : 1);
  setTrendsRangeEnd(Number.isInteger(state.trendsRangeEnd) ? state.trendsRangeEnd : getTotalBookPages());
  setSearchQuery(typeof state.searchQuery === "string" ? state.searchQuery : "");
  setSortMostFrequentFirst(!!state.sortMostFrequentFirst);
  const targetGlossaryTerm = typeof state.currentGlossaryTerm === "string" ? state.currentGlossaryTerm : "";
  setCurrentGlossaryTerm(targetGlossaryTerm);
  const targetScholarAnchor = typeof state.currentScholarAnchor === "string" ? state.currentScholarAnchor : "";
  setCurrentScholarAnchor(targetScholarAnchor);
  setCurrentKwicSource(normalizeKwicSource(state.currentKwicSource));
  setCurrentKwicQuery(typeof state.currentKwicQuery === "string" ? clampUiInput(state.currentKwicQuery, 100) : "");
  setCurrentKwicSort(normalizeKwicSort(state.currentKwicSort));
  const kwicRange = normalizePageRangeInBook(state.currentKwicPageStart, state.currentKwicPageEnd, 1, getTotalBookPages());
  setCurrentKwicPageStart(kwicRange.start);
  setCurrentKwicPageEnd(kwicRange.end);
  if (targetEntity === "materials" && targetTab === "glossary" && targetGlossaryTerm) setPendingGlossaryQuery(targetGlossaryTerm);
  if (targetEntity === "scholar" && targetTab === "scholar" && targetScholarAnchor) setPendingScholarAnchor(targetScholarAnchor);
  setOnlyDiscussed(!!state.onlyDiscussed);
  setOnlyQuestionCandidates(!!state.onlyQuestionCandidates);
  setActiveFilters(Array.isArray(state.activeFilters) ? new Set(state.activeFilters.filter((x) => typeof x === "string")) : /* @__PURE__ */ new Set());
  const targetSearchScope = Object.prototype.hasOwnProperty.call(state, "globalSearchScope") ? normalizeGlobalSearchScope(state.globalSearchScope) : normalizeGlobalSearchScope(globalSearchScope);
  setGlobalSearchScope(targetSearchScope);
  syncStateToGlobal();
  if (typeof window !== "undefined") {
    if (typeof window.renderEntitySwitcher === "function") window.renderEntitySwitcher();
    if (typeof window.renderTabs === "function") window.renderTabs();
    if (typeof window.renderContent === "function") window.renderContent();
  }
  if (typeof document !== "undefined") {
    const globalSearchInput = document.getElementById("global-search");
    if (globalSearchInput) globalSearchInput.value = typeof state.globalSearchQuery === "string" ? state.globalSearchQuery : "";
    const globalSearchScopeSelect = document.getElementById("global-search-scope");
    if (globalSearchScopeSelect && "value" in globalSearchScopeSelect) globalSearchScopeSelect.value = targetSearchScope;
  }
  if (typeof window !== "undefined" && typeof window.syncNavigationState === "function") window.syncNavigationState();
}


export function pushHistoryState() {
  const snap = captureViewState();
  const last = historyStack.length ? historyStack[historyStack.length - 1] : null;
  if (sameViewState(last, snap)) return;
  historyStack.push(snap);
  if (historyStack.length > 150) historyStack.shift();
  updateBackButton();
}

export function updateBackButton() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('back-btn');
  if (!btn) return;
  btn.hidden = historyStack.length <= 1;
}

export function goBackInApp() {
  if (historyStack.length < 2) return;
  historyStack.pop();
  const prev = historyStack[historyStack.length - 1];
  if (!prev) return;
  setIsNavigatingHistory(true);
  applyViewState(prev);
  setIsNavigatingHistory(false);
}

export function syncNavigationHashOnly() {
  const prev = isNavigatingHistory;
  setIsNavigatingHistory(true);
  if (typeof window !== 'undefined' && typeof window.syncNavigationState === 'function') {
    window.syncNavigationState();
  }
  setIsNavigatingHistory(prev);
}

export function applyHash(hash) {
  if (typeof window !== "undefined" && typeof window.closeGlobalSearchResults === "function") window.closeGlobalSearchResults();
  const parsedRoute = parseHashRoute(hash);
  if (!parsedRoute) return false;
  applyActiveBookFromQuery(parsedRoute.query);
  const routedParts = routeVizAlias(parsedRoute.parts);
  const entity = routedParts[0];
  if (!entity || !ENTITY_TYPES[entity]) return false;
  const tabCandidate = routedParts[1] || ENTITY_TYPES[entity].tabs[0];
  const tab = ENTITY_TYPES[entity].tabs.includes(tabCandidate) ? tabCandidate : ENTITY_TYPES[entity].tabs[0];
  const itemPos = routedParts.indexOf("item");
  const state = {
    currentEntity: entity,
    currentTab: tab,
    selectedItem: null,
    selectedItemType: null,
    rightPaneMode: "histogram",
    currentLecture: 0,
    currentVideoId: "",
    trendsRangeStart: 1,
    trendsRangeEnd: clampPageInBook(424),
    searchQuery: "",
    currentScholarAnchor: ""
  };
  setPendingGlossaryQuery("");
  setCurrentGlossaryTerm("");
  setPendingScholarAnchor("");
  setCurrentScholarAnchor("");
  const lecturePageIndex = parsePositiveRouteNumber(routedParts[2]);
  if (entity === "materials" && tab === "lecture_pages" && lecturePageIndex !== null) state.currentLecture = lecturePageIndex;
  if (entity === "materials" && tab === "video") {
    const rawVideoId = routedParts[2] ? String(routedParts[2]) : "";
    state.currentVideoId = /^[A-Za-z0-9_-]{6,32}$/.test(rawVideoId) ? rawVideoId : "";
  }
  if (entity === "materials" && tab === "lectures") {
    const readingPage = parsePositiveRouteNumber(routeValueAfter(routedParts, "reading"));
    if (readingPage !== null) {
      if (typeof window !== "undefined") window.localStorage.setItem("Zalizniakiada.readingPage.v1", String(clampPageInBook(readingPage)));
    }
  }
  if (entity === "materials" && tab === "glossary") {
    const termValue = routeValueAfter(routedParts, "term");
    if (termValue) {
      setPendingGlossaryQuery(clampUiInput(termValue, 100).toLowerCase());
      setCurrentGlossaryTerm(clampUiInput(termValue, 100).toLowerCase());
    }
  }
  if (entity === "scholar" && tab === "scholar") {
    const anchorValue = routeValueAfter(routedParts, "anchor");
    if (anchorValue) {
      const safeAnchor = String(anchorValue || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
      if (safeAnchor) {
        setPendingScholarAnchor(safeAnchor);
        state.currentScholarAnchor = safeAnchor;
      }
    }
  }
  if (entity === "scholar" && tab === "viz") {
    setCurrentVizQueryString(parsedRoute.query);
    const moduleValue = routeValueAfter(routedParts, "module");
    if (moduleValue) setCurrentVizModule(String(moduleValue || "").trim() || currentVizModule);
  } else setCurrentVizQueryString("");
  if (entity === "scholar" && tab === "page_trends") {
    const rangePos = routedParts.indexOf("range");
    const rangeStart = parsePositiveRouteNumber(routedParts[rangePos + 1]);
    const rangeEnd = parsePositiveRouteNumber(routedParts[rangePos + 2]);
    if (rangePos >= 0 && rangeStart !== null && rangeEnd !== null) {
      state.trendsRangeStart = clampPageInBook(rangeStart);
      state.trendsRangeEnd = clampPageInBook(rangeEnd);
      if (state.trendsRangeStart > state.trendsRangeEnd) {
        const start = state.trendsRangeStart;
        state.trendsRangeStart = state.trendsRangeEnd;
        state.trendsRangeEnd = start;
      }
    }
  }
  const queryValue = routeValueAfter(routedParts, "q");
  if (tab === "list" && queryValue) state.searchQuery = clampUiInput(queryValue, 100);
  if (itemPos >= 0 && routedParts[itemPos + 1] && routedParts[itemPos + 2]) {
    const itemType = ENTITY_TYPES[routedParts[itemPos + 1]] ? routedParts[itemPos + 1] : state.currentEntity;
    const resolvedHead = resolveItemHeadFromHash(itemType, routedParts[itemPos + 2]);
    state.currentEntity = itemType;
    state.currentTab = "list";
    state.selectedItemType = itemType;
    state.selectedItem = resolvedHead || clampUiInput(routedParts[itemPos + 2], 120);
    state.rightPaneMode = "card";
  }
  applyViewState(state);
  if (!isNavigatingHistory) pushHistoryState();
  syncNavigationHashOnly();
  const routePath = `${state.currentEntity}/${state.currentTab}`;
  let displayTitle = "";
  if (state.selectedItem) displayTitle = `${state.selectedItem} (детали)`;
  else if (state.currentEntity === "materials" && state.currentTab === "lecture_pages") {
    const l = (APP_DATA && Array.isArray(APP_DATA.lectures) ? APP_DATA.lectures : [])[state.currentLecture];
    const lectureTitle = state.currentLecture === 0 ? "Предисловие" : `Лекция ${state.currentLecture}`;
    if (l && l.name) displayTitle = `${lectureTitle}: ${l.name}`;
    else displayTitle = lectureTitle;
  } else if (state.currentEntity === "materials" && state.currentTab === "video" && state.currentVideoId) {
    const catalog = APP_DATA && Array.isArray(APP_DATA.video_catalog) ? APP_DATA.video_catalog : [];
    const hit = catalog.find((v) => v && v.id === state.currentVideoId);
    displayTitle = hit && hit.title ? String(hit.title) : `Видео ${state.currentVideoId}`;
  }
  updateSEOMetadata(routePath, displayTitle);
  let schema = null;
  if (state.selectedItem) {
    const itemHead = state.selectedItem;
    const itemType = state.selectedItemType || state.currentEntity || "";
    let category = "Указатель";
    if (itemType === "names") category = "Имя";
    else if (itemType === "toponyms") category = "Топоним";
    else if (itemType === "ethnonyms") category = "Этноним";
    else if (itemType === "languages") category = "Язык";
    else if (itemType === "lexicon") category = "Лексема";
    else if (itemType === "subject") category = "Понятие / термин";
    schema = {
      "@context": "https://schema.org",
      "@type": "DefinedTerm",
      "name": itemHead,
      "description": `Справочная статья об объекте «${itemHead}» в интерактивном академическом справочнике по книге А. А. Зализняка «Из жизни слов и языков». Раздел: ${category}.`,
      "inDefinedTermSet": {
        "@type": "DefinedTermSet",
        "@id": "https://gasyoun.github.io/BookIndex/aaz-index.html#dataset",
        "name": "Сводный указатель терминов, имен, языков и лексем BookIndex"
      }
    };
  } else if (state.currentEntity === "materials" && state.currentTab === "lecture_pages") {
    const l = (APP_DATA && Array.isArray(APP_DATA.lectures) ? APP_DATA.lectures : [])[state.currentLecture];
    if (l) {
      const lectureTitle = state.currentLecture === 0 ? "Предисловие" : `Лекция ${state.currentLecture}`;
      schema = {
        "@context": "https://schema.org",
        "@type": "Course",
        "name": l.name ? `${lectureTitle}: ${l.name}` : lectureTitle,
        "description": l.main_idea || "Научно-популярная лекция академика А. А. Зализняка.",
        "provider": {
          "@type": "Person",
          "name": "А. А. Зализняк"
        },
        "hasCourseInstance": {
          "@type": "CourseInstance",
          "courseMode": "Online",
          "isAccessibleForFree": true,
          "url": `https://gasyoun.github.io/BookIndex/aaz-index.html#v4/materials/lecture_pages/${state.currentLecture}`
        }
      };
    }
  }
  updateStructuredData(schema);
  return true;
}

export function syncNavigationState() {
  if (!isNavigatingHistory) pushHistoryState();
  updateBackButton();
  if (suppressHashSync) return;
  if (typeof window === 'undefined' || !window.location) return;
  const nextHash = buildHashFromState();
  if (window.location.hash !== nextHash) {
    setExpectedHash(nextHash);
    window.location.hash = nextHash;
  }
}

if (typeof window !== 'undefined') {
  window.ROUTE_SEO_METADATA = ROUTE_SEO_METADATA;
  window.updateSEOMetadata = updateSEOMetadata;
  window.encodeHashPart = encodeHashPart;
  window.buildCanonicalHash = buildCanonicalHash;
  window.parseHashRoute = parseHashRoute;
  window.routeVizAlias = routeVizAlias;
  window.routeValueAfter = routeValueAfter;
  window.parsePositiveRouteNumber = parsePositiveRouteNumber;
  window.buildHashFromState = buildHashFromState;
  window.captureViewState = captureViewState;
  window.sameViewState = sameViewState;
  window.applyViewState = applyViewState;
  window.pushHistoryState = pushHistoryState;
  window.updateBackButton = updateBackButton;
  window.goBackInApp = goBackInApp;
  window.syncNavigationHashOnly = syncNavigationHashOnly;
  window.applyHash = applyHash;
  window.syncNavigationState = syncNavigationState;
  window.updateStructuredData = updateStructuredData;
}

