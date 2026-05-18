# BookIndex (Zalizniakiada)

**BookIndex** — автономный интерактивный веб-справочник, корпусная лаборатория и интеллектуальная база знаний по научному наследию **А. А. Зализняка**. 

Проект эволюционировал из простого индекса в полноценную исследовательскую платформу для цифровых гуманитарных наук: единый автономный HTML-артефакт, корпусная навигация, KWIC-конкорданс, карты, графы и научный аппарат.

- **Демо**: [gasyoun.github.io/BookIndex/index.html](https://gasyoun.github.io/BookIndex/index.html)
- **Статус**: v2.2.0 «SEO, security & CI hardening» (обновлено 2026-05-17).
- **Руководство для детей**: [KIDS_GUIDE_RU.md](KIDS_GUIDE_RU.md)
- **Лицензия**: [Apache License 2.0](LICENSE)

---

## Ключевые возможности

### Архитектура и автономность
*   **Single-file artifact**: `aaz-index.html` содержит данные и runtime, поэтому сайт работает без backend.
*   **PWA support**: manifest, service worker, offline shell cache and local vendor assets.
*   **Vite smoke build**: Vite проверяет standalone-сборку и копирует deploy assets, но production contract остается `v3_template.html` + `v3_app.js`.
*   **Persistent state**: настройки интерфейса, фильтры и выбранные режимы сохраняются локально.

### Поиск и анализ
*   **Intellectual Search**: Поиск с учетом морфологии и семантических связей.
*   **Network Analysis**: Визуализация сетевых связей между именами, языками и семьями (D3.js + Web Workers).
*   **Geospatial Tools**: Интерактивная карта топонимов и этнонимов (Leaflet).

### Инструментарий Digital Humanities
*   **Topic Clustering**: Группирование сущностей для «Дальнего чтения».
*   **Semantic Web**: Поддержка JSON-LD для интеграции в научный контекст.
*   **KWIC (Key Word in Context)**: Конкорданс по всему корпусу лекций с гибкой фильтрацией.

---

## Сценарии использования (Use Cases)

### 👨‍🎓 Для студента-лингвиста
*   **Изучение родства языков**: Используйте «Дерево языков» и «Сетевой граф семей», чтобы проследить связи между санскритом, латынью и славянскими языками.
*   **Подготовка к семинару**: Быстрый поиск всех упоминаний термина (например, «аблаут») через KWIC-конкорданс для сбора примеров из лекций.

### 👩‍🔬 Для профессионального исследователя
*   **Анализ частотности**: Используйте гистограммы и тепловые карты («Heatmap»), чтобы увидеть, в каких главах Зализняк чаще всего обсуждает конкретные лингвистические проблемы.
*   **Ведение полевых заметок**: Сохраняйте наблюдения в «Дневник исследователя» прямо в интерфейсе; заметки сохранятся даже после перезагрузки страницы.

### 📽️ Для широкого круга читателей
*   **Навигатор по лекциям**: Если вы смотрите лекцию на YouTube, найдите ее в разделе «Материалы», чтобы увидеть список упомянутых имен и терминов с привязкой к страницам книги.
*   **Проверка фактов**: Быстрый поиск этимологии слова или истории топонима через глобальный поиск.

---

## Архитектура и Разработка

Приложение построено на базе современных веб-стандартов без тяжелых фреймворков, что обеспечивает мгновенную загрузку и работу в offline-режиме.

### Структура проекта
| Файл / Папка | Роль |
| :--- | :--- |
| `index.html` | Публичная landing-страница и SEO-вход. |
| `v3_template.html` | HTML-шаблон standalone-приложения. |
| `v3_app.js` | Основной runtime приложения. |
| `app_data.json` | База знаний в формате JSON (6 MB+). |
| `data/modules/` | Lazy-loaded JSON chunks used by the standalone app and pre-cached for offline mode. |
| `src/` | Модульные исходники для контролируемой пересборки `v3_app.js`. |
| `public/` | Ассеты, копируемые Vite в `dist-vite/`. |
| `vendor/` | Локально закрепленные runtime-библиотеки. |
| `scripts/` | Сборка, проверки, импорт данных и CI-guards. |

### Команды разработки
*   **Сборка приложения**: `npm run build` (генерирует `aaz-index.html` в корне)
*   **Vite smoke/deploy copy**: `npm run build:vite`
*   **Проверка типов**: `npm run typecheck`
*   **Полная E2E-проверка**: `npm run check`
*   **Security guard**: `npm run check:security && npm run check:security:static`
*   **CSP hardening**: inline scripts and style blocks use SHA-256 CSP hashes generated at build time; inline style attributes are denied, and the static/post-deploy checks fail if CSP regresses to `unsafe-inline`.
*   **Performance budget**: `npm run check:perf`
*   **Post-deploy gates**: `npm run check:postdeploy` проверяет live GitHub Pages, Lighthouse и axe accessibility (`0` critical / `0` serious).

## Audit Summary

- 0 suspicious heads
- 0 без triage
- 0 sort inversions
- 0 duplicate-head groups
- найдено 11 из 11 терминов

---

## История версий (Major Milestones)
*   **v2.2.0**: SEO, PWA, security, CI, full E2E and performance hardening.
*   **v2.1.0**: Navigation architecture, corpus routing and visualization smoke coverage.
*   **v1.x - v2.x**: Expansion from book index to corpus laboratory and Digital Humanities workspace.

---
👉 **Полная история изменений**: [CHANGELOG.md](CHANGELOG.md)
