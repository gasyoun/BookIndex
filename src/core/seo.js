/**
 * @file seo.js
 * @description Lightweight document metadata updates for hash-routed views.
 */

import {
  currentEntity,
  currentTab,
  selectedItem,
  selectedItemType,
  ENTITY_TYPES,
  TAB_LABELS
} from './state.js';

const SITE_NAME = 'Зализнякиада';
const DEFAULT_DESCRIPTION = 'Интерактивный веб-справочник и корпусная лаборатория по наследию А. А. Зализняка: 3 376 сущностей, лекции, KWIC, карты, графы и научный аппарат.';

const TAB_DESCRIPTIONS = {
  home: DEFAULT_DESCRIPTION,
  lectures: 'Краткий навигатор по лекциям книги А. А. Зализняка «Из жизни слов и языков» с переходом к связанным указателям и контекстам.',
  sources: 'Корпус источников BookIndex: книги, материалы, редакторские данные и планируемый видеокаталог по наследию А. А. Зализняка.',
  lecture_compare: 'Сравнение лекций по пересечениям имен, языков, топонимов, этнонимов, лексики и предметных понятий.',
  glossary: 'Глоссарий лингвистических терминов и учебных определений для чтения А. А. Зализняка.',
  kwic: 'KWIC-конкорданс BookIndex: поиск ключевых слов в контексте по корпусу книги и связанным материалам.',
  scholar: 'Научный аппарат BookIndex: хронология, библиография, лингвистические данные и исследовательские инструменты.',
  viz: 'Интерактивные визуализации BookIndex: графы, карты, деревья языков и динамика тем по корпусу.',
  list: 'Сводный указатель BookIndex по именам, местам, народам, языкам, лексике и предметным понятиям.'
};

function setMetaContent(selector, value) {
  if (typeof document === 'undefined') return;
  const node = document.querySelector(selector);
  if (node) node.setAttribute('content', value);
}

function truncate(value, maxLength = 170) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function buildRouteTitle() {
  const entityTitle = ENTITY_TYPES[currentEntity]?.title || 'BookIndex';
  const tabTitle = TAB_LABELS[currentTab] || currentTab || 'Обзор';

  if (selectedItem) {
    const itemType = ENTITY_TYPES[selectedItemType || currentEntity]?.title || entityTitle;
    return `${selectedItem} — ${itemType} | ${SITE_NAME}`;
  }

  if (currentTab === 'home') {
    return `${SITE_NAME} — интерактивный справочник по Зализняку | BookIndex`;
  }

  return `${tabTitle} — ${entityTitle} | ${SITE_NAME}`;
}

function buildRouteDescription() {
  if (selectedItem) {
    const itemType = ENTITY_TYPES[selectedItemType || currentEntity]?.title || 'указатель';
    return truncate(`Карточка «${selectedItem}» в разделе «${itemType}»: страницы, контексты, связи и исследовательские пометы BookIndex.`);
  }

  return truncate(TAB_DESCRIPTIONS[currentTab] || DEFAULT_DESCRIPTION);
}

export function updateDocumentSeo() {
  if (typeof document === 'undefined') return;

  const title = buildRouteTitle();
  const description = buildRouteDescription();

  document.title = title;
  setMetaContent('meta[name="description"]', description);
  setMetaContent('meta[property="og:title"]', title);
  setMetaContent('meta[property="og:description"]', description);
  setMetaContent('meta[name="twitter:title"]', title);
  setMetaContent('meta[name="twitter:description"]', description);
}
