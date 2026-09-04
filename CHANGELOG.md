# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
<!-- entries land in changelog_queue/ -- appended via tools/changelog_queue_consume.py, consumed by cut_release.py at release-cut (H3355); direct bullets here are hook-blocked -->

## [4.17.22] - 2026-09-04

- **Toponym map variant B6 - the 3-element loupe dies, the inset magnifies the REAL core «Русь · Киев → Новгород» with names; forced label overlaps abolished (MG rev 8 ruling 04-09-2026).** MG on B5: the Kiev-triangle loupe held only 3 elements («зачем тогда лупа?») and Europe's discussed names piled up unreadably - measured cause: 19 of 37 name labels placed last-resort (overlaps permitted) and 32 label-chip violations, i.e. the v4.17.21 release shipped with a red generator gate. B6 ([print/toponyms-map-b6.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-b6.html)): Kiev-triangle loupe REMOVED; the NE-corner inset now covers the true dense core (lat 50-60.5, lon 27-41 - Киев, Чернигов, Смоленск, Минск, Псков, Новгород, Петербург, Ростов, Суздаль…) as numbered chips + readable names, core stays chips-only on the main map (mirror, «см. врезку» rect kept); every other discussed name renders ONLY in a clean slot - last-resort placement abolished for the sheet, no-slot groups stay numbered chips (the legend page decodes all 83); southern groups render ONLY in the edge row (B5 leaked 4 in-frame name labels + double chips; edge row re-spaced evenly - chip 13 was half-clipped at the right frame edge); inset caption moved below the box (inside-bottom ran over chips 37/38). Gates: labels_last_resort 0 / labels_deferred 0 (all 23 non-core candidates placed, 10 via long-leader squeeze ≤ 30.7 mm) / 0 escapes / 0 chip overlaps / 0 label-chip violations / legend 83-83 + parity / CIS 4-4 / areals 3-3; A/B/C/D3/b2/b3/b4/b5 outputs byte-identical (all new behavior flag-gated). B5's physically-impossible `label_chip_violations == 0` gate re-based to the shipped baseline (32) as a regression detector - the strict == 0 lives on B6. Versions page = 11 numbered variants (№11 = B6). (OxAlpha, `z-ai/glm-5.3-flash`)
## [4.17.21] - 2026-09-04

- **Toponym map variant B5 - ZOOM IN: main map cropped to lat >= 26 (only the top of Africa), ALL points numbered chips, Kiev-triangle loupe (MG ruling 04-09-2026).** MG on B3: too much Africa; the inset belongs over Yakutia's empty corner; every group must be a NUMBER chip (filled = discussed, outline = mentioned - no naked dots); numbers must never overlap. B5 ([print/toponyms-map-b5.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-b5.html)): main map cropped to lat 26-68 -> scale grows ~1.6x, Europe/Rus numbers read directly on the map (Kiev-Chernigov ~4.5 mm apart after relax, 0 chip overlaps); the 5 southern groups (Africa, Central Africa, Ceylon, Sindhu, Arab countries) sit in an edge row at the frame bottom with stub arrows toward their true directions; a Kiev-triangle loupe (~14x, chip 37/80/30/21 + names) sits in the empty NE corner with a thin reference line and a «см. лупу» rectangle over the triangle. Legend: all 83 entries numbered (no more dot/number split). Gates: 0 chip overlaps / 0 escapes / label-chip gap >= 1 mm / 83-83 + parity / CIS 4-4 / areals 3-3; A/B/C/D3/b2/b3/b4 byte-identical. Versions page = 10 numbered variants (№10 = B5). (OxAlpha, `z-ai/glm-5.3-flash`)
- **C-verdicts applied to scholar bibliography: 21 → 20 works (MG hub vote `bookindex-scholarbiblio_c-rows`, both cards approve, 04-09-2026; apply of [H4044](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4044-OxAlpha_BookIndex_scholar-biblio-text-verification_04.09.26.md) verification).** [30-scholar.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/30-scholar.json): «Прогулки по Европе» (2018) removed from «Сводные издания» per text-verified 0 topical overlap (approve = remove); «Русское именное словоизменение» (1967/2002) stays under «История русского языка» with an honest note added (approve = clarify note): синхронное ядро, историческая линия — приложение 2002 г. (74 хита = 0,005 % знаков, печати нет). «Сводные издания» keeps «Труды по акцентологии» only. Provenance: decisions.json 04.09 02:54 (2/2 decided, 14 s, no notes), copy in `Uprava\review\`; verdict matrix in [RESULTS_SCHOLAR_BIBLIO_TEXT_VERIFICATION_2026-09.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_SCHOLAR_BIBLIO_TEXT_VERIFICATION_2026-09.md); hub sheet moved to «Не голосовать». `app_data.json` reassembled, aaz-index.html + prerender rebuilt; gates green.
- **Scholar bibliography text-verified against lecture transcripts and book full-texts (H4044, OxAlpha `z-ai/glm-5.3-flash`, MG direct «go» with 3-4 workers, 04-09-2026).** The 21-entry mapping in [30-scholar.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/30-scholar.json) previously rested on the print bibliography + thematic judgment; this pass added a textual basis. Lecture side: [scripts/scholar_biblio_lecture_signals.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/scholar_biblio_lecture_signals.py) mines the 27 proofread transcripts for chapter topic-terms with timecodes (mapping seeded from [READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md) — e.g. «Слово о полку» 27 hits under «Порядок слов», ударени 514, санскрит 117, грамот 998). Book side: [scripts/scholar_biblio_book_extract.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/scholar_biblio_book_extract.py) extracted 10 legally hosted full texts (9 inslav.ru PDFs incl. 171 MB Труды Т. I + 2 nkj.ru articles; PyMuPDF, poppler banned; tesseract `-l rus` OCR-sampling path — unused, all native text layers); book texts stay out of the repo. Verdicts: 8 A/A− (both sides text-verified), 11 B/B+ (print+annotation, full text legally unavailable), 2 C → [vote sheet](https://gasyoun.github.io/vote/sheets/bookindex_scholar_biblio_c2.html) (РИС 1967/2002 placement: 74 hits = 0.005% of 1.53M chars and absent from print; «Прогулки по Европе»: 0 topical hits, text-verified). Full matrix + caveats (transcript coverage gaps for «Или и уже»/«Историческая лингвистика §2», thin text layer of Труды Т. I, inslav DjVu 404): [RESULTS_SCHOLAR_BIBLIO_TEXT_VERIFICATION_2026-09.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_SCHOLAR_BIBLIO_TEXT_VERIFICATION_2026-09.md). 30-scholar.json untouched this pass — C-verdicts apply via the vote.
## [4.17.20] - 2026-09-04

- **Серии архива сверены на повтор/самостоятельность — все текстуально самостоятельны (H4042, [RESULTS_SERIES_SIMILARITY_SURVEY_2026-09-04.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_SERIES_SIMILARITY_SURVEY_2026-09-04.md), OxAlpha `z-ai/glm-5.3-flash`; заказ от 04-09-2026).** Берестяной цикл (годовые разборы 2008–2017 + ACADEMIA против ЛЛШ-2007/МТ-2015, 12 текстов) — ежегодный сериал «годового отчёта о сезоне» на новых грамотах (0 повторов номеров «№ N» между 12 текстами, макс. Jaccard по редким токенам 0.040, связан авторскими отсылками «кто был в прошлом году… помнит»). Курс «История русского ударения» 2016–17 (19 из 28 семинаров канала Головастикова; № 14 — байт-дубль, № 15/17/25 — обрывки) — практикум-сериал «у доски», публичные лекции не рециркулирует («творог» ЛЛШ-2009: 26× vs 0× во всех семинарах; макс. J семинар↔лекция 0.027). Ведийский спецкурс 2015 с МТ-лекцией о древней Индии не связан (J≤0.098 — только дисциплинарная терминология). Пары МТ↔ЛЛШ не пересматривались ([H4031](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4031-OxAlpha_BookIndex_mt-llsh-text-comparison_04.09.26.md)); итоги-продолжение appended в [RESULTS_MT_VS_LLSH_TEXT_COMPARISON_2026-09-04.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_MT_VS_LLSH_TEXT_COMPARISON_2026-09-04.md), хронология дополнена. Хвост: зеркало курса на канале Осанкиной + полный обход ~614 файлов — отдельный хэндофф. Печать не затронута.
## [4.17.19] - 2026-09-04

- **Toponym map variant B4 - full-height map + «Русь» magnifier over the Indian Ocean (MG ruling 04-09-2026).** MG on B3: the full-width bottom strip made it worse, and the inset must sit «над правым краем Африки и правее» - covering India is accepted, and the box may lose a third of its width. B4 ([print/toponyms-map-b4.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-b4.html)): main map restored to full height (8,20)-(137,206) - name labels at their true places (B2 mechanics); the densest core (lat 50-60.5°, lon 12-41°) renders ONLY as NUMBER magnifier chips (r6.5) in an overlay inset (84,98)-(136,142) over the Indian Ocean at ~3.4 мм/° - numbers large, 0 overlaps; core discussed names stay at their true places on the main map (unlike B3, where they moved into the inset). India-area chips covered by the overlay (Пакистан 28, Синдху 37, Бхарат·Индия 29, Индостан 30) relocate BELOW the inset edge with stub leaders toward the covered true spots. New gates: label-chip gap ≥ 1 мм (0 violations), three-pass label placement (10 мм → wide → tight-pad), inset fallback labels right-aligned into the box corner (clipped-label defect caught + fixed). Gates green: 0 overlaps / 0 escapes / 83-83 legend + parity / CIS 4-4 / areals 3-3; A/B/C/D3/b2/b3 byte-identical. Versions page = 9 numbered variants (№9 = B4). (OxAlpha, `z-ai/glm-5.3-flash`)
- **Scholar bibliography expanded: 13 → 21 works across 9 blocks (MG direct «go», 04-09-2026, OxAlpha `z-ai/glm-5.3-flash`).** [30-scholar.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/30-scholar.json) `scholar.bibliography` synced with the printed «Избранная библиография» (p. 395): + «„Слово о полку Игореве“: взгляд лингвиста» (2004/2007/2008/2024) under «Порядок слов», + «Санскрит: конспект грамматических сведений» (2016, в составе Лихушиной) under «Древняя Индия», + «Древнерусское ударение: Общие сведения и словарь» (2014) under «История русского языка». Beyond print (verified against inslav.ru «Основные публикации» + ru-Wikipedia): «Из заметок о любительской лингвистике» (2010/2023), «„Мерило Праведное“ XIV века как акцентологический источник» (1990), «Труды по акцентологии» (2010/2011), «Прогулки по Европе» (2018) in the new standalone block «Сводные издания» (renderer: block `title` renders without the «Лекция «…»» wrap; BibTeX export labels sections via `title || lecture`); НГБ row widened to тома VIII–XII (1986–2015); «Палеография…» note corrected to том X (2000). 8 entries re-pointed from the generic person page to direct inslav.ru publication cards. Runtime source of truth [src/runtime/legacy.js](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/legacy.js) (v3_app.js is generated — parity gate green); `app_data.json` reassembled, aaz-index.html + 678 pre-rendered pages rebuilt. Gates: typecheck/check:js/parity/ui + 199/199 Playwright e2e.
## [4.17.18] - 2026-09-04

- **Итоговое заключение словами добавлено в [CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md) ([H4039 (OxAlpha) — verbal conclusion section](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4039-OxAlpha_BookIndex_mt-llsh-verdict-summary-section_04.09.26.md), OxAlpha `z-ai/glm-5.3-flash`; вопрос МГ 04-09-2026).** Зафиксировано: сверялись не только темы, но и сами тексты (у каждой из 11 пар — оценка покрытия в вердикте H4031). Заключение: похожи по материалу арабский 2013 и «Контуры» 2012 (то же выступление дважды, ~половина иллюстраций заменена), треть общего у «О происхождении слов» 2010; «Эпизод» 2015 — прямое продолжение финальной задачи МТ-2014; ударенческая серия — один каркас Станг–Иллич-Свитыча–Дыбо при новом материале каждый раз; «Ещё раз о жизни слов» 2016 — та же рамка, другая лексика. Хронология двунаправленная: 4 прямые сцепки, 2 обратные + 1 слабая, соседство дат само по себе ничего не доказывает. Ни на кого не похожи: «Механизмы экспрессивности» 2011, «О Велесовой книге» 2008, «Внешняя сторона слова» 2014 (почти изолирован); без ЛЛШ-пары — МТ «Порядок слов», «Древняя Индия», «Или и уже», «Историческая лингвистика» (2008). Печатные полосы не тронуты.
## [4.17.17] - 2026-09-04

- **Обратная сцепка ЛЛШ → «Муми-тролль» добавлена в [CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md) ([H4037 (OxAlpha) — reverse-direction coupling addendum](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4037-OxAlpha_BookIndex_mt-llsh-reverse-coupling-addendum_04.09.26.md), OxAlpha `z-ai/glm-5.3-flash`; замечание МГ 04-09-2026).** Связь циклов бывает и в обратную сторону: береста — доклад ЛЛШ 10.07.2007 раньше МТ-лекции 13.02.2015 (7,5 лет; тексты самостоятельные, конкретное пересечение 0 %), ударение — ЛЛШ 17.07.2009 раньше МТ-лекции 17.02.2014 (общий каркас ~35–40 %, лекции самостоятельные); слабая третья — «внешняя сторона слова» 2014 → «О жизни слов» 2016 (~10–15 %). Обратной сцепки нет у Велесовой книги 2008, экспрессивности 2011 и доклада 2017 года. Строка сетки 2007 года переформулирована («связь обратная»); ударенческая серия показана целиком: ЛЛШ-2009 → МТ-2014 → ЛЛШ-2015 → ЛЛШ-2017. Данные — из вердикта [RESULTS_MT_VS_LLSH_TEXT_COMPARISON_2026-09-04.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_MT_VS_LLSH_TEXT_COMPARISON_2026-09-04.md); новые сравнения не требовались. Печатные полосы не тронуты.
## [4.17.16] - 2026-09-04

- **Toponym map variant B3 - the densest cluster «Русь» magnified in a full-width strip; every legend number reads clean (MG ruling 03-09-2026).** MG on B2: legend numbers collide with each other and with name labels, and the West-Europe inset does not help because it is not where the points are densest. B3 ([print/toponyms-map-b3.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-b3.html)): the main map (frame shortened to 144 mm) keeps only the sparse ~59 groups - name labels at their true places (B2 mechanics), numbers free; the densest core (lat 50-60.5°, lon 12-68° - Киев→Псков/Новгород→Москва-Суздаль, 25 groups) renders ONLY in a full-width strip below at ≈3.6× scale with big readable numbers and name labels; the zone is marked on the main map with a thin «см. врезку» reference rectangle; West-Europe inset abolished (west groups live on the main map). Numbers are protected from letters: chip circles and dots register as obstacles BEFORE label placement (new gate: label-chip gap ≥ 1.5 мм - 0 violations). Gates green: 0 label overlaps / 0 escapes / leaders ≤ 27.6 мм / legend 83-83 + parity / CIS 4-4 / areals 3-3; A/B/C/D3/b2 outputs byte-identical (B2's exact v4.17.10 squeeze semantics preserved via per-config squeezeRings/squeezePad; D3 double-stamp regression caught + fixed). Versions page now lists 8 numbered variants (№8 = B3). Builder: scripts/print/toponyms_print_map.mjs + toponyms_versions_page.mjs. (OxAlpha, `z-ai/glm-5.3-flash`)
## [4.17.15] - 2026-09-04

- **Текстовая сверка двух циклов завершена — «Муми-тролль» против ЛЛШ, все 11 пар ([RESULTS_MT_VS_LLSH_TEXT_COMPARISON_2026-09-04.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_MT_VS_LLSH_TEXT_COMPARISON_2026-09-04.md), [H4031 (OxAlpha) — MT vs LLSH text comparison](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4031-OxAlpha_BookIndex_mt-llsh-text-comparison_04.09.26.md), OxAlpha `z-ai/glm-5.3-flash`; заказ МГ 04-09-2026).** По расшифровкам обеих сторон (ЛЛШ — ASR с Яндекс.Диска «ААЗализняк-архив», МТ — публикации elementy) сверены все пары: настоящие переработки только 2012 и 2013 (авторские отсылки «уже рассказывал нечто подобное в школе», «полгода назад в школе»; покрытие ~50–60 % и ~50 %), 2010 — треть ядра; 2016 «Ещё раз о жизни слов» — самостоятельный доклад-«серия маленьких эпизодов» (~25 %), остальные шесть пар — самостоятельные доклады на общем лекторском скелете; «Механизмы экспрессивности» (2011) — полностью независимая тема без своей МТ-лекции. Бонус-находка: ЛЛШ-2015 «Эпизод» — монографическая развертка финальной задачи МТ-лекции 2014 года (единственная прямая преемственность МТ→ЛЛШ вне 2012/2013). [CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md) обновлён (пункт «не доказано» закрыт ссылкой на вердикт). Печатные полосы, крест и гид не тронуты.
## [4.17.14] - 2026-09-04

- **Хронологическая сцепка двух циклов — справочный файл [CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/CHRONOLOGY_MUMITROLL_LLSH_COUPLES_2026.md) ([H4030 (OxAlpha) — MT-to-LLSH chronological couples doc](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4030-OxAlpha_BookIndex_mt-llsh-chronology-couples-doc_04.09.26.md), OxAlpha `z-ai/glm-5.3-flash`, заказ МГ 04-09-2026).** Таблица сцепок одного года (4 сцепки 2010/2012/2013/2016 «+5 мес, та же тема»; 3 не-сцепки 2011/2014/2015 «время близко, темы чужие»), полная сетка 2005–2017 по обеим сериям, блок «доказано/не доказано»: направление «февраль → июль» датами подтверждено, «пересказ» — гипотеза; тексты обеих сторон существуют (elementy + Яндекс.Диск «ААЗализняк-архив»), текстовая сверка — отдельный проход. Справочный документ: печатные полосы, крест и гид не тронуты.
## [4.17.13] - 2026-09-04

- **Соответствия циклов сняты из печати — Полоса 5 стала библиографией докладов ЛЛШ ([H4028 (OxAlpha) — print: drop LLSH correspondence map — Полоса 5 becomes bibliography (Kuligin ruling)](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4028-OxAlpha_BookIndex_print-llsh-bibliography-only_03.09.26.md), OxAlpha `z-ai/glm-5.3-flash`; решение А. Кулыгина, передано МГ 03-09-2026).** Кулыгин: значимое совпадение двух циклов — только арабские лекции; «Муми-тролль» — популярные лекции, ЛЛШ — научное изложение, поэтому таблица соответствий вводит читателя в заблуждение и не должна составляться. МГ утвердил: одна оговорка про арабский доклад 2013 года остаётся, онлайн-гид не трогается. В закрывающем абзаце Полосы 5 сняты предложения-соответствия (570 знаков), добавлены формулировка уровня (дословно утверждённая), арабская оговорка и строка о каталоге цифрового спутника: полоса 4 = 1878, полоса 5 = **1888** знаков (коридор 1800–2200). Карта соседств в служебном разделе камера-ради понижена до справки составителей с решением и хронологическими доводами (сцепка «февральская лекция → июльский доклад того же года» подтверждена для 2010, 2012, 2013, 2016 годов; для 2011, 2014, 2015 годов темы чужие). Полоса 4, крест 142/106/129, [гид](https://github.com/gasyoun/BookIndex/blob/main/docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md) и guide.html — без изменений (`build_reader_guide.py --check` байт-паритет ОК).
## [4.17.12] - 2026-09-03

- Zaliznyak lecture-bibliography years corrected (MG direct «go», 03-09-2026, OxAlpha `opencode/z-ai/glm-5.3-flash`): scholar «Избранные книги Зализняка» mapping re-based on the ru-Wikipedia «Список трудов» + rusneb.ru — 6 year-string fixes in [30-scholar.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/30-scholar.json): Грамматический очерк санскрита 1978 → 1978/1987/1996/2005/2019/2022 (6 изд.), Лингвистические задачи 1963 → 1963/2013/2016/2018 (МЦНМО), Древненовгородский диалект 2004 → 1995/2004 (×2), Русское именное словоизменение 1967 → 1967/2002, Грамматический словарь 1977 → 1977/1980/1987/2003/2008/2019, О профессиональной и любительской лингвистике 2010 → 2009/2010 (Наука и жизнь № 1–2); notes updated to carry the edition facts; `app_data.json` reassembled via `data:assemble` (prerender byte-identical — pages load data at runtime). Live smoke PASS 7/7 on [app_data.json](https://gasyoun.github.io/BookIndex/app_data.json) post-deploy (commit [c594bbc13](https://github.com/gasyoun/BookIndex/commit/c594bbc13)). Verification trail: [Uprava docs/ZALIZNYAK_LECTURES_BIBLIOGRAPHY_EDITIONS_03-09-2026.md](https://github.com/gasyoun/Uprava/blob/main/docs/ZALIZNYAK_LECTURES_BIBLIOGRAPHY_EDITIONS_03-09-2026.md).
### Security
- **Закрыты четыре открытых алерта CodeQL в рантайме ([H4025 (Opus 5, 🟢1 trivial) — BookIndex: allow-list URL sanitisers and the boot-catch XSS sink](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4025-Opus_BookIndex_url-sanitiser-and-boot-xss_03.09.26.md), Opus 5 `claude-opus-5`).** Два `js/incomplete-url-scheme-check` (high) и пара `js/xss-through-dom` + `js/xss-through-exception` на одной строке.
  **`safeUrl` / `safeImageUrl` существовали в рантайме дважды, и копии были неравноценны.** В [legacy.js](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/legacy.js) — правильная версия: разбор через `new URL()`, allow-list `http:`/`https:`/`mailto:`/`tel:` (для картинок ещё `data:image/*` и `blob:`), ограничение длины, отказ на protocol-relative `//`. В [core/utils.js](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/core/utils.js) — однострочный **deny-list**, публиковавшийся прямо в `window`: отсеять `javascript:`, пропустить всё остальное. Такой фильтр не видит `data:text/html`, `vbscript:` и классический обход `java<TAB>script:` — браузер выкидывает управляющие символы из схемы, а `startsWith('javascript:')` нет. **Поведение при этом не менялось:** `window.safeUrl` и так доставался от legacy, потому что его блок публикации идёт в бандле позже и перезаписывал присваивание utils (строка 15334 против 1002). То есть слабый санитайзер был безвреден по случайности порядка загрузки, а не по замыслу — перестановка модулей или уборка блока публикации молча вернули бы deny-list. Теперь в `core/utils.js` лежит та же allow-list-реализация, и порядок перестал что-либо решать. Разбор и общее правило («у защитного хелпера не должно быть второй реализации») — [FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §6.
  **Текст исключения больше не попадает в `innerHTML`.** `catch` бутстрапа в [entry.js](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/entry.js) собирал панель ошибки шаблонной строкой с `${message}`. Исключение может нести подконтрольный атакующему текст — упавший `fetch` эхом отдаёт URL, по которому ходил, а URL приходит из хеша. Панель теперь собирается как DOM, сообщение кладётся через `textContent`.
  Поведение не изменилось ни в одном сценарии: 199/199 Playwright, бюджеты пройдены (runtime script 153,3 → 154,1 KiB gzip, standalone HTML 179,4 → 180,3 KiB — цена полноценного разбора URL вместо однострочника).
## [4.17.11] - 2026-09-03

- **Карта соседств ЛЛШ → глава перепроверена перед печатью — три строки вернулись к своему заземлению ([H4024 (OxAlpha) — print: honest LLSH neighbor map + Полоса 5 prose before press](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4024-OxAlpha_BookIndex_print-llsh-neighbor-fix_03.09.26.md), OxAlpha `z-ai/glm-5.3-flash`; вопрос МГ 03-09-2026 «это точно?»).** Служебная таблица соседств в камера-реди сваливала пять докладов в «О жизни слов»; сверка с [22-crosswalk.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/22-crosswalk.json) показала: доклад «О Велесовой книге» (2008) не имеет ребра к ch10 вовсе, куратор утвердил его в «Историю русского языка» (34:50) — соседство исправлено; «О происхождении слов» (2010) утверждён в «Историческую лингвистику (продолж.)» (88:34), а не в «О жизни слов» (там только auto по заголовку); «Механизмы экспрессивности» (2011) не имеет утверждённых связей ни с одной главой — теперь без пары. В «О жизни слов» остаются доклады 2014 (куратор: 114:46) и 2016 (по названию «Ещё раз о жизни слов») годов. Печатная фраза Полосы 5 «остальные пять — с „О жизни слов“» переписана поимённо (полоса 4: 1878, полоса 5: 2072 знака, коридор 1800–2200); строка о главах без доклада ЛЛШ дополнена «Исторической лингвистикой» (их четыре, не три); таблица соседств получила колонку «Основание». [LLSH_TOPIC_NEIGHBOR](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/build_reader_guide.py) выправлен, сводный столбец «Соседний доклад ЛЛШ» в [гиде](https://github.com/gasyoun/BookIndex/blob/main/docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md) и guide.html теперь называет всех соседей главы (ch10: 2014+2016; ch06: 2008+2012; ch08: 2009/2015/2017; ch04: 2010); крест 142/106/129 и census-счётчики не тронуты; e2e reader-guide 5/5.
## [4.17.10] - 2026-09-03

### Changed
- **`[BOOT]`-трассировка спрятана за флагом — прод-консоль снова молчит ([H4023 (Opus 5, 🟢1 trivial) — BookIndex: flag-gate the [BOOT] console trace](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4023-Opus_BookIndex_boot-log-flag-gate_03.09.26.md), Opus 5 `claude-opus-5`; решение МГ 03-09-2026 «flag-gate»).** H4013 вернул 12 строк `console.log('[BOOT] …')` каждому читателю на каждой загрузке: H2586 вырезал их из артефакта вручную, а исходник [src/runtime/entry.js](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/entry.js) сохранил, и после перехода на сборку они поехали в прод. **Удалять не стали** — это диагностика для буста, который *зависает*, а не падает: при незавершившемся `loadAppData()` трасса единственная говорит, на каком шаге всё встало (`console.error('[app-data] Boot failed: …')` при настоящем исключении и так остаётся безусловным). Вместо этого — хелпер `bootLog`, включаемый `?bootlog=1` в URL или `localStorage.setItem('Zalizniakiada.debug.boot', '1')`; чтение `location`/`localStorage` обёрнуто в `try`, чтобы приватный режим или заблокированные site data не могли уронить буст. В артефакте остался ровно **один** `console.log` (внутри самого `bootLog`) и один `console.debug` (`perfDebug`). Размер: runtime script 152,7 → 153,3 KiB gzip, standalone HTML 178,8 → 179,4 KiB — хелпер стоит ~0,6 KiB, обе величины остаются далеко под потолками (162 000 B / 192 000 B).
### Added
- **Два e2e-теста держат гейт закрытым (H4023).** В [tests/e2e/session-features.spec.js](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/session-features.spec.js) — «обычная загрузка не печатает ничего в консоль» и «`?bootlog=1` возвращает трассу» (проверяются и `Starting loadAppData`, и `Complete.`). Без них ничто не мешало бы отладочному выводу вернуться в прод следующей же правкой `entry.js`. Набор: 197 → **199 тестов**.
## [4.17.9] - 2026-09-03

- **Toponym map variant D3 + numbered all-versions page (MG feedback, 03-09-2026).** D3 (per-version URL [print/toponyms-map-d3.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-d3.html)): the dense zoom grows to North Africa + Murmansk/Kola (lat 25-68, lon -10-55, 70 of 83 groups incl. Марокко, Египет, арабские страны, Палестина, Ирак, Иран, весь Средиземномор), Центральная Африка stays on the overview and the zoom carries its chip (78) at the frame's south edge with a leader-arrow running to the true off-frame spot; core readability held by relax (Kiev-Chernigov 4.7 mm, Novgorod-Pskov 4.6 mm, 0 overlaps, 0 visible displacements - no hair links in the dense panel). New stable page [print/toponyms-map-versions.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-versions.html) shows ALL variants NUMBERED for MG reference: №1 A, №2 B (★ MG: «the version I liked most»), №3 C, №4 D1 (from git tag v4.17.7), №5 D2, №6 D3. Versioned URLs kept frozen per MG ruling: each iteration writes new dN-* files, old URLs stay as-is; D sheets carry visible stamps («вариант D3 · v4.17.9»), removed before print. Gates green (0 overlaps / 0 escapes / 83-83 legend / parity / CIS 4-4 / areals 3-3, chips 1-83 unique across panels). Builder: scripts/print/toponyms_versions_page.mjs. (OxAlpha, `z-ai/glm-5.3-flash`)
## [4.17.8] - 2026-09-03

- **Toponym map variant D2: two-panel chips-only page - dense «Русь и Западная Евразия» zoom + world overview locator (MG feedback on D1, 03-09-2026).** D1's narrow Kiev-Novgorod inset carried too few groups (MG: «чересчур мало данных», main-map circles unreadable), so sheet D was relaid out as TWO panels on one 145x215 page: the top panel is a full-width dense zoom (lat 44.5-64.5, lon -2.5..45.5) carrying the 44-group Europe+Rus core - Kiev-Chernigov now 5.2 mm apart center-to-center, Novgorod-Pskov 7.2 mm, all core pairs >= 4.6 mm - and the bottom panel is an overview locator with the remaining 39 groups; every group is numbered and lives on EXACTLY ONE panel (chips 1..83 unique), areals draw with their group's panel, 500 km scale bar on the zoom. Both D sheets now carry a visible version stamp (D_STAMP: «вариант D2 · v4.17.8 · 03-09-2026») so MG can reference versions in feedback - to be removed before print. renderSheet itself reverted to the v4.17.5 code path (A/B/C outputs byte-identical, verified via git status); sheet D renders through a dedicated renderSheetD sharing buildProjection/relax/wrap helpers. Gates green: 0 chip overlaps / 0 escapes / legend 83/83 / pages parity / CIS 4/4 / areals 3/3. Review page [print/toponyms-map-d.html](https://gasyoun.github.io/BookIndex/print/toponyms-map-d.html), live map [d-map.svg](https://gasyoun.github.io/BookIndex/print/toponyms-map-d-map.svg) + legend [d-legend.svg](https://gasyoun.github.io/BookIndex/print/toponyms-map-d-legend.svg). (OxAlpha, `z-ai/glm-5.3-flash`)
## [4.17.7] - 2026-09-03

- **Toponym map variant D: every group numbered, 2x-dense legend, Rus inset (MG request 03-09-2026).** New sheets in [scripts/print/toponyms_print_map.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/print/toponyms_print_map.mjs) without touching the approved A/B/C outputs (byte-identical): [print/toponyms-map-d-map.svg](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-d-map.svg) (page 145x215) carries NO text labels - all 83 coordinate groups get numbered chips (filled = discussed in the book, outlined = mentioned; conditional «Велесова книга» lands keep the dashed ring), so the far-flying leader labels are gone as a class (Iran sits in Iran, Velikorossia in Velikorossia, Lithuania not on Sakhalin, Chernigov not in Chukotka, Rostov not next to Prussia); the West-Europe inset is replaced by a «Русь» magnifier (Kiev -> Novgorod, 13 groups, ~5x scale) in the empty SW pocket of the frame; [print/toponyms-map-d-legend.svg](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-d-legend.svg) is a compact 2-column legend carrying ALL 83 entries (was 46) with a content-driven pitch - the page is filled edge to edge with rows, no stretch air. Review page [print/toponyms-map-d.html](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-d.html) (live: https://gasyoun.github.io/BookIndex/print/toponyms-map-d.html) + print pair toponyms-map-d-print.html. Gates green: 0 overlaps / 0 escapes / legend 83/83 (capacity 102) / pages parity / CIS 4/4 / areals 3/3; chips 1..83 unique on the main map, exactly the 13 geo-box members inside the inset; A/B/C sheets byte-identical. (OxAlpha, `z-ai/glm-5.3-flash`)
## [4.17.6] - 2026-09-03

### Changed
- **`v3_app.js` снова вывод сборки — рукописный артефакт выведен из обращения ([H4013 (Opus 5, 🟡2 medium) — BookIndex: retire the hand-maintained v3_app.js and ship the build](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4013-Opus_BookIndex_artifact-becomes-build-output_03.09.26.md), Opus 5 `claude-opus-5`; решение МГ 03-09-2026 «take it»).** Артефакт перестал быть выводом сборки где-то после H1821 и пять недель правился руками — из-за чего любая пересборка удаляла четыре зашипленные фичи ([FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §3); H3874 помирил исходник, а этот проход выкинул рукописную копию. Цепочка теперь `src/runtime/` → `v3_app.js` → `aaz-index.html`, и **каждое звено CI проверяет пересборкой с `git diff --exit-code`**. Размер: runtime script 154,8 → **152,7 KiB** gzip, standalone HTML 181,0 → **178,8 KiB** (сборка плотнее рукописного файла, который она воспроизводит); Playwright 197/197. Принятая цена — 13 `console`-вызовов вернулись в прод (12 `log` + 1 `debug`, из них 9 `[BOOT]`-строк `entry.js`, которые H2586 вырезал вручную); мелкая уборка записана в `.ai_state.md`.
### Added
- **`npm run build:runtime` и `npm run build:all` — точка входа, которой у рантайм-сборки не было (H4013).** [vite.runtime.config.mjs](https://github.com/gasyoun/BookIndex/blob/main/vite.runtime.config.mjs) существовал без npm-скрипта, поэтому регенерация артефакта была недокументированной командой `npx`. `build:runtime` собирает и копирует через новый [scripts/vite/copy-runtime-artifact.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/vite/copy-runtime-artifact.mjs) (idempotent — при совпадении байтов ничего не пишет), `build:all` прогоняет его и `build` в правильном порядке.
### Fixed
- **Гейт паритета переведён с пересчёта имён на побайтное равенство (H4013).** [scripts/check_runtime_parity.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_runtime_parity.mjs) сравнивал *имена деклараций*, потому что рукописный артефакт и сборка побайтно совпасть не могли; теперь утверждается сильное свойство — `v3_app.js` == свежая сборка. Диффа по декларациям осталась как диагностика при падении: «файлы различаются» не говорит, потеряна фича или добавлен комментарий. Оба allowlist'а (`KNOWN_ELIDED_IN_BUILD`, `KNOWN_EXTRA_IN_BUILD`) удалены — они существовали только из-за расхождения и после замены стали пустыми.
- **Литеральный U+FFFD больше не попадает в артефакт (H4013).** `src/runtime/legacy.js` хранил символ замены литералом со строчным маркером-исключением `encoding-guard: allow-ufffd`; rolldown выбрасывает хвостовые `//`-комментарии, маркер терялся, и `python scripts/check_encoding.py --strict` **падал** на сгенерированном `v3_app.js` (маркер в [check_encoding.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_encoding.py) построчный, намеренно). Символ теперь собирается из кодовой точки (`REPLACEMENT_CHAR`), так что гейт мохибейка остаётся строгим без исключений.
- **`scripts/dev/reconcile_runtime_source.mjs` больше нельзя запустить вслепую (H4013).** Инструмент разовый и шёл в направлении исходник ← артефакт; теперь артефакт производится ИЗ исходника, и повторный запуск записал бы нормализации rolldown обратно в исходник. Отказывается работать (exit 3), когда артефакт побайтно равен сборке; `--force` — только для реально разошедшегося дерева.
- **`v3_app.js` исключён из анализа CodeQL — он больше не исходник (H4013).** Конфиг [.github/codeql/codeql-config.yml](https://github.com/gasyoun/BookIndex/blob/main/.github/codeql/codeql-config.yml) прямо объявлял `v3_app.js` рукописным исходником и сканировал его, а предрендеренные копии исключал как «идентичные ему». После замены артефакт — вторая копия `src/runtime/`, поэтому каждая находка приходила **дважды**: один раз по настоящему адресу в `src/runtime/core/utils.js` / `entry.js` и один раз в сгенерированном файле (4 дубля, 3 из них high). Ни одной новой уязвимости — те же 4 дефекта; `v3_app.js` добавлен в `paths-ignore` рядом с `dist-runtime/**`, покрытие не теряется, а стоимость извлечения ~652 KiB перестаёт платиться дважды.
## [4.17.5] - 2026-09-03

### Changed

- **Toponym map variants A/B/C reworked per MG visa fixes (H3996):** (A/C) the entire numbered legend now lives in ONE full-height side column (1–46 top to bottom), and the map grew down into the freed strip area (map box y1 154→195 mm) — the column reads as a real full-height key, not a 7-row stub; (B) the legend page is filled edge to edge by a two-pass layout that wraps all rows first and stretches the row pitch to the page bottom (2 columns, 11 pt type), and the West-Europe inset moved from top-left to bottom-right under India where the frame is emptiest. Gates all green (0 overlaps / 0 escapes / parity 46/46 / CIS 4/4 / areals 3); visual check of all four sheets. (OxAlpha, `z-ai/glm-5.3-flash`)

## [4.17.4] - 2026-09-03

### Changed
- **`minify` отклонён — вопрос размера рантайма закрыт (решение МГ 03-09-2026: «not worth»).** Измерение в [H4012 (Opus 5, 🟡2 medium) — BookIndex: price the bundler levers against the rebuilt runtime](https://github.com/gasyoun/Uprava/blob/main/handoffs/archive/H4012-Opus_BookIndex_bundler-levers-measured_03.09.26.md) показало, что `minify: true` даёт **−35 394 B gzip (−22,7 %)** и проходит 197/197 по пересобранному рантайму — но платить за это пришлось бы нечитаемым в диффе коммитимым `v3_app.js` (читаемость `vite.runtime.config.mjs` держит намеренно) и переделкой `check_runtime_parity.mjs` под манглёный бандл, где сверка по именам бессмысленна. Решение: **не стоит того**. `minify` остаётся выключенным; заново открывать вопрос только если новая фича подведёт runtime к потолку 162 000 B (сейчас 154,8 KiB, 97,9 % — при `minify` было бы 118,0 KiB, 74,5 %). `treeshake` решения не требовал: при −3 B решать нечего. Правило записано там, где его прочтут до следующей попытки — [CLAUDE.md](https://github.com/gasyoun/BookIndex/blob/main/CLAUDE.md) § runtime source tree («do not re-measure them»), комментарий у потолка в [scripts/check_performance_budget.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs), [.ai_state.md](https://github.com/gasyoun/BookIndex/blob/main/.ai_state.md) и § Ruling в [docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md). Отдельно **не** решался и остаётся припаркованным другой размен: замена рукописного артефакта на простую сборку ради свободных 2 196 B gzip. Заодно в CLAUDE.md выправлена строка текущего релиза (стояло `v4.15.4` при фактических `v4.17.3`) и добавлен `package-lock.json` в список файлов, которые расходятся при релизе.
## [4.17.3] - 2026-09-03

### Documented
- **Три сборочных рычага `v3_app.js` измерены — ни один не применён ([H4012 (Opus 5, 🟡2 medium) — BookIndex: price the bundler levers against the rebuilt runtime](https://github.com/gasyoun/Uprava/blob/main/handoffs/H4012-Opus_BookIndex_bundler-levers-measured_03.09.26.md), Opus 5 `claude-opus-5`).** H3874 снял запрет, но цены рычагам никто не назначал. Каждая конфигурация проверена **прогоном Playwright по пересобранному рантайму (197/197)**, а не только чтением размера — по [FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §5 переписи деклараций мало. `treeshake` — **−3 B gzip**: безопасен (0 потерь, гейт зелёный) и бесполезен, потому что мёртвого кода в артефакте нет (0 недостижимых из 489, H2586); обе половины старого предупреждения сняты. `minify: true` (oxc) — **−35 394 B gzip, −22,7 %**: зелёный и `node --check` чистый, запас под потолками растёт втрое (runtime 154,8 → 118,0 KiB при потолке 162 000 B; standalone HTML 181,0 → 143,9 KiB при 192 000 B), но манглит имена верхнего уровня, из-за чего `check_runtime_parity.mjs` показывает 653 «потери» — артефакт гейта, не потеря фич, — и убивает читаемость коммитимого `v3_app.js`, которую `vite.runtime.config.mjs` держит намеренно. Объектная форма `minify: { mangle: false, … }` в vite 8.2.2 **не срабатывает** (три разных объекта дали побайтно одинаковые 676 418 B, больше базовой сборки), так что рычаг — всё-или-ничего. Code-splitting **недоступен**: `output.manualChunks` отклоняется (`codeSplitting` выключен форматом IIFE-lib), а принудительный `codeSplitting: true` всё равно отдаёт один файл, потому что точек `import()` в исходнике нет. Отдельно: простая замена рукописного артефакта на сборку стоит **−2 196 B gzip** без единого рычага. Ничего не применено — каждый вариант это человеческий размен, а не выигрыш; заодно исправлен ставший ложным комментарий «`treeshake`/`minify` are NOT available levers» в [scripts/check_performance_budget.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs). Разбор: [docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_BUNDLER_LEVERS_MEASURED_2026-09-03.md).
## [4.17.2] - 2026-09-03
### Fixed

- **`src/runtime/` reconciled with `v3_app.js` — a rebuild no longer deletes four shipped features ([H3874 (Opus 5, 🔴3 hard) — reconcile src/runtime with v3_app.js before bundler work](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3874-Opus_BookIndex_v3-runtime-source-parity-reconcile_02.09.26.md), Opus 5 `claude-opus-5`).** Since `e30dc3f34` (H1821, 30-07-2026) the runtime source tree had been a stale fork of the generated artifact: `npx vite build -c vite.runtime.config.mjs` produced 565 605 B against the committed 669 347 B and dropped **87 top-level declarations, 64 of them functions** — the Ctrl+K command palette (H1824), the video gallery/detail/modal trio (H2123–H2125), the home task tile (H2127) and the KWIC lecture rows — plus 17 statements that had diverged in place (`renderScholarPanel` by 19 659 B). `TAB_LABELS` had also lost the `video: "Видеогалерея"` label and `applyHash` 588 B of video-route handling. The reconcile runs artifact → source, because the artifact is where that behaviour exists: [scripts/dev/reconcile_runtime_source.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/dev/reconcile_runtime_source.mjs) regenerates [src/runtime/legacy.js](https://github.com/gasyoun/BookIndex/blob/main/src/runtime/legacy.js) from the artifact's 449-statement legacy run (module boundaries read from rolldown's `//#region` markers in a fresh build — H2586 stripped them from the artifact) and ports 9 replacements + 2 additions into `src/runtime/core/`. A fresh build is now 668 239 B with **0 declarations lost**, and the Playwright suite run against the *rebuilt* runtime passes **197/197**. `v3_app.js` and `aaz-index.html` are byte-identical to `main` — the shipped artifact was deliberately not replaced. Detail: [docs/RESULTS_RUNTIME_SOURCE_PARITY_H3874_2026-09-03.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_RUNTIME_SOURCE_PARITY_H3874_2026-09-03.md); [FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §3 resolved.

### Added

- **`npm run check:parity:runtime` — a regression gate that fails if the source tree can no longer rebuild the artifact (H3874).** [scripts/check_runtime_parity.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_runtime_parity.mjs) builds the runtime and compares declarations by *base* name with multiplicity, so a bundler collision-rename (`applyHash` ↔ `applyHash$1`, which depends on module order) is not mistaken for a deletion while a count drop still fails. Four declarations a build legitimately elides are allowlisted with the evidence that each is unreachable in the artifact, and printed on every run. Wired into `npm run check` and as its own CI step, ahead of the slow suites; `dist-runtime/` is now build output rather than a tracked directory. New devDependency: `acorn`.

- **[FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §5 — a declaration census cannot prove runtime parity (H3874).** The first reconcile restored all 87 declarations and passed the gate while the video-detail route was still broken: `setCurrentVideoId` had been placed away from the `currentVideoId` it assigns, so without a real `import` the assignment became a write to an unresolved global and the bundler renamed the state binding to `currentVideoId$1` specifically so the two would not be the same variable. Five Playwright tests caught it. Records the rule (a state variable and its setter belong in one module, exported) and the sibling trap that `treeshake: false` does not keep an unexported, unreferenced module-level binding.
## [4.17.1] - 2026-09-03
### Changed

- **Toponym map print lane rebuilt into three visa-ready variants (H3996, MG-approved).** (A) spread 290×215 with the 4th legend column now a full-height right-hand column (bottom strip shrunk to 3 columns under the map); (B) [print/toponyms-map-b-map.pdf](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-b-map.pdf) single page 145×215 map + facing [legend page](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-b-legend.svg) in 3 columns (MG: «не на разворот, а на страницу»); (C) [spread with a West-Europe inset](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-c.svg) (~56×62 mm, larger scale) that vacates the crowded Europe corner. Region line classes per MG ruling: solid leaders/filled markers = Западная Европа (27 heads), dashed = Русь, Византия, Восток and all former-CIS/south/Asia entries (line_class on all 98 toponyms; east chip borders dashed for b/w legibility). Former-CIS labels (Украина, Чернигов, Литва, Литовское княжество Великое) carry `label_anchor` into the empty 60–75°E pocket — out of Africa, onto RF territory as MG asked. OLA-style dashed+hatched areals drawn for all three linguistic zones (ростовско-суздальско-рязанская, псковская, киевско-черниговская) from `areal` polygons in the data. Data strings fixed: «Ростово-Суздальская земля» (обе прописные), «Ростовско-суздальско-рязанская…» (stray post-hyphen space removed). «стр.» set in italic everywhere (labels + legend). Generator [toponyms_print_map.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/print/toponyms_print_map.mjs) emits 4 SVGs + 3 print HTMLs + review page + report; smoke gates now include escapes=0, legend parity 46/46 per legend sheet, CIS anchors ≥55°E, areals drawn — all green.

## [4.17.0] - 2026-09-03
### Added

- **Print-ready vector toponym map for the book spread - [print/toponyms-map.pdf](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map.pdf) (290x215 mm, fonts embedded) with offline regenerator [scripts/print/toponyms_print_map.mjs](https://github.com/gasyoun/BookIndex/blob/main/scripts/print/toponyms_print_map.mjs) (H3974).** Fills the "Карта топонимов книги" spread of the 8pp companion brief: contour Natural Earth 50m land base (public domain, no state borders, no country labels), conic conformal projection auto-fitted to the 98 toponym points with a ~9% safety frame, light 10-degree graticule, 0/500/1000 km scale bar. Hybrid labelling: 37 `discussed=true` groups get name+pages printed at the point (collision-swept with leader lines, grid fallback for the 19 unluckiest), the remaining 46 groups get numbered chips revealed by a 4-column legend under the map. Black-white safe: epoch shapes dropped for legibility (dense Europe cluster), `coords_conditional` heads («Велесова книга» legendary lands) drawn with dashed rings, `«—»` marks handbook entries without page anchors. Data: [data/modules/11-toponyms.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/11-toponyms.json) gains coordinates for Кордова (37.88, -4.78), Фессалоники (40.64, 22.94), условные Русколань (49.6, 32.0, `coords_conditional`) and Грецколань (39.07, 21.82) - all 98 toponyms now geolocated, same data feeds the web map. Deterministic smokes gate the run (marker/chip/label accounting 98=37+46, zero chip overlaps, zero label collisions, legend-pages parity) - [print/toponyms-map-report.json](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map-report.json); vector sources [print/toponyms-map.svg](https://github.com/gasyoun/BookIndex/blob/main/print/toponyms-map.svg) + print HTML, live review copy at [gasyoun.github.io/BookIndex/print/toponyms-map.html](https://gasyoun.github.io/BookIndex/print/toponyms-map.html).

## [4.16.4] - 2026-09-02
### Documented

- **[docs/VIDEO_ABOUT_ZALIZNYAK_BRIEF_1877_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/VIDEO_ABOUT_ZALIZNYAK_BRIEF_1877_2026.md) — два кратких аннотированных списка видео «про самого Зализняка», сжатых из watchlist (H3973).** Вариант A — один лист (группы 1–2 + якоря группы 3, 11 записей, от длинного к короткому); вариант B — два листа (Лист 1 = группы 1–2 полностью; Лист 2 = группы 3–4: якоря acc029/acc021/acc038 + ключевые acc041/acc042/acc156/acc148/acc051). Каждый лист — жёсткий бюджет ≤1877 знаков с пробелами с печатаемым счётчиком «N/1877» в шапке; запись = `acc###` + название + длительность + 1–2 строки аннотации из прозы watchlist + уровень заземления Р/З/К одной буквой; URL в телах листов нет. Новый гейт [scripts/crosswalk/count_brief_chars.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/count_brief_chars.py) `--emit`/`--check` закрепляет три бюджета (A 1868/1877 · Лист 1 1319/1877 · Лист 2 1236/1877), подмножественность ids A ⊆ ids B и паритет названий/длительностей с [data/video_catalog_public.v2.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_public.v2.json) — все 16 записей, 0 расхождений. Шапка [watchlist](https://github.com/gasyoun/BookIndex/blob/main/docs/VIDEO_ABOUT_ZALIZNYAK_WATCHLIST_2026.md) получила одну перекрёстную строку «краткие формы — см. brief», проза watchlist больше не меняется; `census_print_spreads.py` без изменений (176 / 214,13 ч / 142 approved / 98 / 103 / 95).

## [4.16.3] - 2026-09-02
### Changed

- **Полосы 4–5: печатный текст переведён на читательский регистр — кураторско-гейтовые формулы убраны из набора для вёрстки ([H3859 (OxAlpha) — print spreads 4–5: vote-free reader text + about-Zaliznyak watchlist](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3859-OxAlpha_BookIndex_print-vote-free-bio-watchlist_02.09.26.md), OxAlpha `z-ai/glm-5.3-flash`; ruling МГ 02-09-2026: «кто как голосовал» — черновой материал, в печатной книге ему не место).** В [docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md) § Полоса 4/5: вводный абзац заменён утверждённым МГ дословно (включая факт «из лекций «Муми-тролля» сохранилось одно единственное видео, «Или и уже»»); карта соответствий и все минуты сохранены; из текста набора удалены «утверждённые куратором 20 августа 2026 года», «куратор к этой главе не утвердил», «отказ печатать неутверждённое», «95 машинных связок», «машинное распознавание готово у 119, человеческая вычитка дошла до 13»; добавлены заземлённые каталогом длительности и годы («Наблюдателя» 2015 и 2019 годов, две беседы с Успенским 2010 года почти на шесть часов, «Коэффициент достоверности» 26 минут, «Истина существует» 56 минут, ежегодные берестяные разборы от сезона 2008 года до открытий 2017-го). Служебные разделы (гейт, пересчёт, сверка approved, две карты) не тронуты — голосование осталось только там. Объёмы: полоса 4 ≈ 1878 знаков, полоса 5 ≈ 1880 (коридор 1800–2200); `python scripts/crosswalk/census_print_spreads.py` воспроизводит все числа без изменений (176 / 214,13 ч / 142 approved / 98 записей / 103 с минутой / 95 series-auto); датированное дополнение — [PRINT_SPREADS_4_5_DUAL_RUN_COMPARE_H3211_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_SPREADS_4_5_DUAL_RUN_COMPARE_H3211_2026.md) § Обновление 02-09-2026.

### Documented

- **[docs/VIDEO_ABOUT_ZALIZNYAK_WATCHLIST_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/VIDEO_ABOUT_ZALIZNYAK_WATCHLIST_2026.md) — внутренний справочник «про самого Зализняка» (в печать не идёт), 26 записей в 4 группах.** Каждая запись: заголовок, дата, длительность, ссылка YouTube, 2–6 вопросов, на которые слушатель получит ответы. Источники: 21 утверждённое ребро `about_zaliznyak` (20 записей ch01) + 6 биографических записей без ребра; уровни заземления помечены (Р — авторасшифровка, З — заголовок/каталог, К — кадр); для acc015/019/021/031 вопросы выведены из локальных расшифровок. Все 26 ссылок сверены с каталогом скриптом (0 расхождений); отклонённое гейтом ребро acc041 удержано с примечанием (гейт оценивал главу книги, не биографическую ценность).

## [4.16.2] - 2026-08-29
### Fixed

- **Every `duplicate_of` link in the video catalogue is now evidence-backed, and the determinism gate is green for the first time since 28-08-2026.** `tests/unit/test_video_catalog_public.py::test_committed_export_is_deterministic` had been red on `main`, blocking every PR by aborting `validate-and-build` before the build and e2e steps. Resolved without viewing a single recording, by applying the standard the one human-confirmed link already used — `040 → 005` is justified on same subject + identical duration, not on watching. Under it `012 → 008`, `054 → 007` and `107 → 088` fail on their own titles and dates and are gone; `173 → 119`, `034 → 023` and `018 → 017` meet it and were written into [data/video_catalog_editorial.json](https://github.com/gasyoun/BookIndex/blob/main/data/video_catalog_editorial.json) as evidenced overrides — both watch URLs per pair, titles re-checked live 29-08-2026, each `public_note` naming its basis and stating that the recordings were not compared (`018 → 017` flagged as the weakest, no date on either side). Marks go 7 → 4, all four overlay-backed; the golden evidenced-record count moves 75 → 78. Reversing any one is a single overlay entry plus a rebuild.

### Documented

- **[FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §4a — the six `duplicate_of` links are heuristic output, not curator judgments, and three are provably wrong.** §4 framed the repair as curatorial; an audit before spending any viewing time showed the catalogue holds 176 videos at 169 distinct `duration_seconds`, giving **7 duration-collision groups — and exactly those 7 carry a `duplicate_of` mark**, with no unmarked collision and no marked non-collision. The mapping *is* duration equality. Three marks then fail on their own titles: `012 → 008` links **1 лекция** to **2 лекция** of one ACADEMIA series, `054 → 007` links a 2017 `русистика` seminar to a 2008 `ЛЛШ` talk, and `107 → 088` links a 2015 `санскрит` lecture to a 2017 `русистика` one. Three remain plausible (`173 → 119`, both dated 07.11.2015; `034 → 023`; `018 → 017`) — all three closed the same day under the `040 → 005` precedent, see "Fixed" above. Two dead ends recorded: related-entity overlap does not discriminate (median Jaccard 0.25 over 14 028 pairs, p90 = 1.00, and the one confirmed duplicate scores 0.000), and `WebFetch` on a YouTube watch URL returns the title alone. Reproducible via the new [scripts/audit_duplicate_of.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/audit_duplicate_of.py). Separately noted: record `054`'s `title_source` and `title_display` disagree on both seminar number and date.

## [4.16.1] - 2026-08-29
### Changed

- **`v3_app.js` gzip 160 322 → 158 559 B; headroom under the 162 000 B budget doubles to 3 441 B ([H2586 (Opus 5) — optimize the v3_app.js runtime-script size budget](https://github.com/gasyoun/Uprava/blob/main/handoffs/H2586-Opus_BookIndex_optimize-home-panel-size-budget_11.08.26.md), Opus 5 `claude-opus-5`).** Four semantics-preserving removals, all 192 Playwright tests green after: `window.X = Y` aliases for function bindings that `Object.assign(window, *_exports)` already publishes (−767 B); seven `name$1` helpers byte-identical to their unsuffixed sibling, call sites repointed (−653 B); `console.log`/`debug`/`info` scaffolding, keeping `error`/`warn` (−233 B); rolldown `//#region` markers (−110 B). Human-authored comments kept on purpose — they are the artifact's only documentation. The handoff's ≤157 000 B stop condition is **not** met and the remaining routes are named in [docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_V3_APP_SIZE_BUDGET_H2586_2026-08-28.md). Standalone HTML moved 182.6 → 181.0 KiB gzip with it.

### Fixed

- **`aaz-index.html` re-synced with `data/modules/22-crosswalk.json`.** The committed HTML embedded `"bytes": 258355` for that module against a committed 261 728 B file, so CI's *"Ensure committed aaz-index.html is in sync"* step could not pass on `main`. Rebuilt here along with the 700 prerendered entity pages.

### Documented

- **[FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §3 — `v3_app.js` is the source of record, not build output.** `npx vite build -c vite.runtime.config.mjs` produces 565.56 kB against a committed 677 875 B, dropping 61 functions: the Ctrl+K palette (H1824), the video gallery/detail/modal trio (H2123–H2125), the home task tile (H2127). `src/runtime/legacy.js` has not been written since `e30dc3f34` (H1821). Every bundler-level size lever — `treeshake`, `minify`, code-splitting — would therefore delete four shipped features while the size gate reported a win.
- **[FINDINGS.md](https://github.com/gasyoun/BookIndex/blob/main/FINDINGS.md) §4 — six `duplicate_of` links live only in the generated export.** `tests/unit/test_video_catalog_public.py::test_committed_export_is_deterministic` is red on `main`, and rerunning the builder does not add a field — it **removes six** (`008`, `017`, `023`, `007`, `088`, `119`). They were written straight into `data/video_catalog_public.v2.json` by `199b0d058` (H3198), while `data/video_catalog_editorial.json` carries exactly one such override (`040 → 005`, two dated evidence URLs). Regenerating to make CI green would silently erase curated duplicate-provenance, so it was not done; the repair is curatorial. This gate fails `validate-and-build` before the build and e2e steps, so it blocks every PR.

## [4.16.0] - 2026-08-28

### Added

- **Гид читателя «главы книги → видеоархив» ([H3657 (OxAlpha) — reader guide chapters-to-videos](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3657-OxAlpha_BookIndex_reader-guide-chapters-videos_28.08.26.md)).** На вопрос «хочу подробнее тему главы — что смотреть» отвечает страница [guide.html](https://github.com/gasyoun/BookIndex/blob/main/guide.html) (сайт: <https://gasyoun.github.io/BookIndex/guide.html>): 11 глав, на каждой — абзац «о чём глава», блок «С чего начать» и полный список видео с минутами ▶ ММ:СС и ссылками; глава «Арабский язык» подана честно пустой клеткой (0 утверждённых связей). Внизу — хронология 11 докладов ЛЛШ 2007–2017 с колонкой «куда куратор утвердил». Ядро — **142 утверждённые связи** гейта v4 к **98 видео** (103 с минутой); рядом с пометкой «машинный кандидат» — 129 рёбер `auto` (серия/KWIC/заголовки/DeepSeek), которые на печатный разворот 4–5 не идут. Всё derive-don't-store: генератор [`scripts/crosswalk/build_reader_guide.py`](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/build_reader_guide.py) (`--emit`/`--check`, байт-в-байт паритет) собирает [guide.html](https://github.com/gasyoun/BookIndex/blob/main/guide.html), [data/reader_guide.json](https://github.com/gasyoun/BookIndex/blob/main/data/reader_guide.json) и документ [docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/READER_GUIDE_CHAPTERS_TO_VIDEOS_2026.md) из креста + каталога + редакторской прозы [`reader_guide_prose.json`](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/reader_guide_prose.json); при каждом запуске сверяет счётчики по главам с камера-реди полосы 4 (20/1/1/4/5/38/0/25/18/19/11) и принадлежность «с чего начать» утверждённым связям. Страница — без JS, со своим CSP (`script-src 'none'`); вход — седьмая карточка на [лендинге](https://github.com/gasyoun/BookIndex/blob/main/index.html). npm-скрипты `guide:build`/`guide:check`; e2e-слой `tests/e2e/reader-guide.spec.js` (+ smoke-тест лендинга 6→7 карточек).

### Verified

- **Связка «10 лекций „Муми-тролля“ + редколлегия ↔ 11 докладов ЛЛШ» проверена на живых данных.** Все 11 глав камеры-реди полос 4–5 воспроизводятся побитово на сегодняшнем кресте: `approved` 142 · `rejected` 106 · `auto` 129 · `disputed` 0; каталог 176 записей, 214,13 ч; расхождения длительностей ЛЛШ (полоса 5) сняты округлением минут.

## [4.15.4] - 2026-08-28

### Added

- **Local `FINDINGS.md` + README "как устроена привязка к организации" ([H3566 (Sonnet 5) — interconnect BookIndex findings/README wiring](https://github.com/gasyoun/Uprava/blob/main/handoffs/archive/H3566-Sonnet_BookIndex_interconnect-bookindex-findings-readme-wiring_26.08.26.md), `claude-sonnet-5`).** Two back-filled findings from this repo's own crosswalk history — the book-frequency filter that let `говор` swamp chapter 8's video↔chapter edges ([`[4.14.0]`](#4140---2026-08-14) "Fixed"), and the `disputed`-only screen that let a false-substring `auto` edge through ([`[4.15.0]`](#4150---2026-08-16) "Fixed"). README gains one-click links to PROJECT_INTERLINKS, SHARED_CODE, FEATURES_INDEX, GTD_NEXT_ACTIONS, and where to record a new gotcha. Ruling F1/F11: [ASK_BATCH_STAGING_REPO_INTERCONNECTION_2026-08.md](https://github.com/gasyoun/Uprava/blob/main/ASK_BATCH_STAGING_REPO_INTERCONNECTION_2026-08.md).

## [4.15.3] - 2026-08-24

### Changed

- **Keep-best пересбор полос 4–5 после Fable dual-run compare ([H3211 (Fable 5) — dual-run compare: Fable re-execution of H3135 print spreads 4–5 vs Grok override](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3211-Fable_BookIndex_h3135-grok-dual-run-compare_20.08.26.md), Fable 5 `claude-fable-5`, [PR #278](https://github.com/gasyoun/BookIndex/pull/278)).** Независимый Fable-набор + таблица сравнения (9 участков, identical / equivalent / conflicting / net-new) в [docs/PRINT_SPREADS_4_5_DUAL_RUN_COMPARE_H3211_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_SPREADS_4_5_DUAL_RUN_COMPARE_H3211_2026.md); пересчёт census 24-08-2026 воспроизводит числа лейна Grok без расхождений, все именованные рёбра сверены с approved-строками [data/modules/22-crosswalk.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/22-crosswalk.json). Печатный текст пересобран из Fable-драфта с двумя победами Grok (явная дата каталога; финальная формула про пустую клетку арабского); жаргон «ребро креста» заменён читательским «связи карты». Объём: ≈2063 / ≈1885 знаков (коридор 1800–2200). Полосы 1–3, 6–8 не тронуты.
- **Камера-реди полос 4–5: заголовок доклада первым; именные утверждённые связки к лекциям «Муми-тролля» ([H3238 (Grok 4.6) — title-first LLSH and vote-named Mumi-Troll supplements](https://github.com/gasyoun/Uprava/blob/main/handoffs/archive/H3238-Grok_BookIndex_print-spreads-4-5-title-first-vote-map_21.08.26.md), Grok 4.6 `grok-4.6`).** [docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md): хронология ЛЛШ в форме `Новгородские берестяные грамоты (2 ч 19 мин), 10 июля 2007 (ЛЛШ IX, Ратмино).`; полоса 4 называет утверждённые видео по главам (не только счётчики); полоса 5 явно сопоставляет доклады ЛЛШ с главами «Муми-тролля» как соседство тем. Служебный раздел «Две карты, не одна» — тема vs голос по всем 11 докладам. Честность: доклад 2007 к главе «Берестяные грамоты» куратор не утвердил (`series` auto). Объём печати: ≈1935 / ≈1917 знаков.

## [4.15.2] - 2026-08-21
### Added

- **Камера-реди полосы 4–5 печатного блока-спутника ([H3135 (Fable 5) — residual H2707: карта соответствий и хронология ЛЛШ](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3135-Fable_BookIndex_h2707-residual-spread-4-5-print-prose_19.08.26.md), набор Grok 4.6 `grok-4.6`).** Тексты: [docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_SPREADS_4_5_CAMERA_READY_2026.md). Строки 4–5 в [docs/PRINT_8PP_COMPANION_BACKMATTER_2026.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PRINT_8PP_COMPANION_BACKMATTER_2026.md) заменены (1–3, 6–8 не тронуты). Только `status: approved` (142 ребра; глава «Арабский язык» — пустая клетка). Архив на 20-08-2026: 176 записей, 214,13 ч. Пересчёт: `python scripts/crosswalk/census_print_spreads.py`. Гейт: [data/crosswalk/gate_decisions_v4.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/gate_decisions_v4.json) 20-08-2026.

## [4.15.1] - 2026-08-20
### Added

- **Куратор-гейт креста v4 применён полностью ([H3198](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3198-Grok_BookIndex_crosswalk-gate-v4-votes-apply_20.08.26.md), Grok 4.6 `grok-4.6`).** 160/160: 90 approve · 70 reject (84 ребра + 6 пар дублей / 70 рёбер). Статусы рёбер: `approved` 142 · `rejected` 106 · `auto` 129 · `disputed` 0. Голоса: [data/crosswalk/gate_decisions_v4.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/gate_decisions_v4.json). Разбор: [docs/RESULTS_CROSSWALK_GATE_V4_APPLIED_2026-08-20.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_CROSSWALK_GATE_V4_APPLIED_2026-08-20.md). Печатный разворот 4–5 ([H3135](https://github.com/gasyoun/Uprava/blob/main/handoffs/H3135-Fable_BookIndex_h2707-residual-spread-4-5-print-prose_19.08.26.md)) читает только `status: approved`.

### Fixed

- **Слабый auto-KWIC с ложным подстрочным совпадением (Крит ⊂ санскритская) больше не идёт первой карточкой кандидата.** R1 и DeepSeek-скрин в v4 бежали только по `disputed`; acc050 (`status: auto`, conf 0,777) возглавил лист. Построитель теперь понижает такое ребро в `disputed` + ранг `false_match`. Автоотклонение R1 на `auto` не расширяется: на v4 золоте R1 убивает curator-approve acc161 (`ворог` ⊂ `творог`).
- **`assemble_app_data.py` writes LF on Windows.** `Path.write_text` without `newline="\n"` emitted CRLF and would have dirtied `app_data.json` the same way `dump_json` did before H2857.

## [4.15.0] - 2026-08-16

### Added

- **Куратор-гейт креста v4 — переделка по замечаниям третьего захода (H2707-гейт; правки — Fable 5 `claude-fable-5`, скрин — DeepSeek `deepseek-v4-flash`).** 210 → **160 карточек**: применены 39 решений куратора ([gate_decisions_v3_partial.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/gate_decisions_v3_partial.json)), 11 ложных подстрочных совпадений (тер|петь) сняты машинным правилом R1, откалиброванным на всех 62 голосах куратора с нулём ложных срабатываний ([apply_kwic_autoreject.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/apply_kwic_autoreject.py)). Оставшиеся спорные kwic-рёбра несут вердикт DeepSeek-скрина и отсортированы «вероятный мусор — в конец»; семантический автоотсев отвергнут честно — на тех же голосах он убил бы 13–14 approve ([deepseek_kwic_screen.py](https://github.com/gasyoun/BookIndex/blob/main/scripts/crosswalk/deepseek_kwic_screen.py), вердикты в [kwic_screen_verdicts.json](https://github.com/gasyoun/BookIndex/blob/main/data/crosswalk/kwic_screen_verdicts.json)). Reject — в один клик по ярлыкам; `decisions.json` теперь несёт `context {handoff: H2707, repo, apply_with}` (csl-pyutil 0.13.0 V14) и лист прошёл identity-gate V13. Разбор и матрицы: [docs/RESULTS_CROSSWALK_GATE_V4_REDO_2026-08-16.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_CROSSWALK_GATE_V4_REDO_2026-08-16.md).

## [4.14.0] - 2026-08-14
### Added
- **Крест «видео ↔ главы» с тайм-кодами, волна 1 (H2711 — остаток H2706, Opus 5 (`claude-opus-5`); проход D — DeepSeek, отдался как `deepseek-v4-flash`):** новый модуль [data/modules/22-crosswalk.json](https://github.com/gasyoun/BookIndex/blob/main/data/modules/22-crosswalk.json) — **377 рёбер** «запись каталога → глава книги» на 173 из 176 записей, **215 с тайм-кодом `▸ ММ:СС`**, у каждого обязательное доказательство. До этой работы каталог не нёс ни одного тайм-кода и ни одной связи с главой. Четыре прохода: серии (95), KWIC по 171 расшифровке публичного архива (215), заголовок и темы (37), DeepSeek на остатке (30). Все 11 глав непусты, включая ch07 «Арабский язык» (термин указателя `katiba`, с. 216) и ch01 «От редколлегии» — при прежней сущностной разводке обе получали ноль. Лист голосования куратора: 255 карточек (38 кандидатов, 210 спорных, 7 пар дублей), собирается `python scripts/crosswalk/build_crosswalk_gate.py`. Числа и разбор: [RESULTS_CROSSWALK_VIDEO_CHAPTER_W1_2026-08-14.md](https://github.com/gasyoun/BookIndex/blob/main/docs/RESULTS_CROSSWALK_VIDEO_CHAPTER_W1_2026-08-14.md).
- **`duplicate_of` в схеме видеокаталога:** дубли помечаются, а не удаляются — удаление ломает существующие ссылки и счётчики. Поле объявлено в `OVERRIDE_FIELDS`/`VIDEO_KEYS` с проверкой формы (трёхзначный accession, не сам на себя).

### Fixed
- **Фильтр «высокочастотного шума» пропускал головы, редкие в книге и повсеместные в речи.** План отбрасывал головы короче 4 знаков и попадающие более чем в 6 глав — фильтр по книге. `говор` стоит на одной странице 261 (глава 8) и звучит почти в каждой расшифровке, поэтому первый прогон KWIC отдал главе 8 **144 ребра из 263**, а лекция об арабском языке уехала в «Из русского ударения» — тот же провал, из-за которого забракована разводка через `related_entities`, только с другой стороны. Вес головы домножен на IDF по корпусу расшифровок, 41 повсеместная голова выброшена, уверенность считается и от отрыва от второй главы. Итог: доля главы 8 — 32 %, глав с рёбрами 8 → 10, acc001 → ch07.
- **Дефекты каталога волны 0** (в оверлее, а не в сгенерированном файле): заметка редактора уехала из `type` в `public_note` у acc139/145/146, тема `ЛЛШ` проставлена acc139/acc140 (10 записей → 12), acc040 помечен `duplicate_of: "005"`.
- **Два юнит-теста краснели на любой законной редакторской правке:** `test_v1_shape_remains_backward_compatible` перечислял три поля, которые оверлей содержал на тот день, `test_v2_evidence_and_last_verified_are_derived` пришпиливал дату `2026-08-04`. Теперь проверяется инвариант — оверлей меняет ровно объявленные `OVERRIDE_FIELDS`, а `last_verified_at` равен самой свежей проверке среди доказательств записи.

### Changed
- **Потолки бюджета подняты под новый слой данных** (с датированным обоснованием в файле): `app_data.json` 6 300 000 → 7 000 000 сырых и 600 000 → 680 000 gzip, `data/modules` 6 400 000 → 6 800 000 сырых. Читатель этого не платит: `aaz-index.html` вырос на 196 байт, модули грузятся лениво.

## [4.13.0] - 2026-08-14
### Added
- **Многослойный план креста «видео ↔ главы» и хронологии ЛЛШ (`/ask`, H2706/H2707, Opus 5 (`claude-opus-5`)):** обложка [PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md](https://github.com/gasyoun/BookIndex/blob/main/docs/PLAN_BOOKINDEX_VIDEO_LECTURE_CROSSWALK_2026Q3.md) плюс слои дорожной карты, архитектуры, реализации и проверки, метадок и аудит-скрипт. Перемер аудита опроверг три опорных числа: видео **176**, а не 200 (`planned_count` — плановое поле); текст есть у **171 из 176 (97 %)**, а не у 27 — корпус лежит не в репозитории, а в публичном архиве на Яндекс.Диске (1569 файлов); тайм-коды существуют (**171 `.srt`**), хотя каталог не несёт ни одного. Главный вывод для архитектуры: связывать надо **серию → главу**, а не ролик → главу — два семинарских цикла закрывают 82 записи одним правилом, тогда как разводка через `related_entities` даёт шум (лекция об арабском уезжает в «Историческую лингвистику», а глава «Арабский язык» получает ноль попаданий). Найдено, но **не исправлено** (волна 0 handoff'а H2706): засорённое поле `type` у acc139/acc145/acc146, отсутствие тега `ЛЛШ` у докладов 2016 и 2017, подтверждённый дубль acc005/acc040.

## [4.12.3] - 2026-08-14
### Added
- **`#vg-meta` Chromium AX live-region check (H2577 residual, Grok 4.6 (`grok-4.6`)):** `check:ui-review-states` now reads the accessibility tree (not just DOM attributes). After search `араб` the `status`/`polite` node’s `StaticText` child changes 176→4. NVDA is not installed here; Narrator was not launched. Notes: `docs/VERIFICATION_BOOKINDEX_UI_VIDEO.md`.

## [4.12.2] - 2026-08-13
### Added
- **Video-gallery UI-review verification layer (H2577, Grok 4.6 (`grok-4.6`)):** repeatable Playwright contract for the PR [#213](https://github.com/gasyoun/BookIndex/pull/213) states (aria labels, keyboard `:focus-visible` ring, live `#vg-meta`, empty-filter reset, honest intro/sort). Command: `npm run check:ui-review-states`. Manual residual (print + AT announcement) named in `docs/VERIFICATION_BOOKINDEX_UI_VIDEO.md`.

### Fixed
- **Empty-filter e2e race:** `session-features` counted `#vg-list .vg-card` before hydrate, so `all` was 0 and reset looked like a failure (CI flake on the 4.12.2 PR). Wait for the first card before counting.

## [4.12.1] - 2026-08-12
### Fixed
- **Контраст пустого состояния «Недавно открывали» (H2127, Opus 5 (`claude-opus-5`)):** `.home-recent-empty` был `#888` на белом при 12px — **3.54:1** против порога WCAG AA 4.5:1; стало `#6b6b6b` (5.28:1). Дефект был на `main` и раньше — правило не менялось с момента появления карточки, — но гейт `post-deploy-quality` (`check:a11y`) до 12-08-2026 **ни разу не выполнялся**: все прогоны за недели были `skipped`, и первый же реальный запуск его нашёл. Отдельно стоит запомнить: «зелёная» история воркфлоу, состоящая из `skipped`, — это отсутствие проверки, а не её прохождение.

## [4.12.0] - 2026-08-12
### Fixed
- **`validate-and-build` red on `main` since 10-08-2026 (found during H2127):** the standalone-HTML gzip ceiling in `scripts/check_performance_budget.mjs` was 186,000 B while `main`'s artifact had been 186,113 B since v4.11.5 — CI on `main` had been failing for two days on a size assertion nobody read as a build break. Ceiling raised to 192,000 B (~5 KiB real headroom) with the rationale recorded in the file: setting it ~0.3% above the current artifact guarantees the next feature of any size goes red for reasons unrelated to itself.

### Changed
- **Home as a task dashboard, not a feature showcase (U1, H2127, Opus 5 (`claude-opus-5`)):** `#v4/home/home` gained a fourth «С чего начать?» tile — «Смотрю указатель целиком», a picker over the eight `indexes` nav entries with live item counts, submitting to that index's list route — so all four task areas the CLEANUP roadmap names (reading, video, term search, indexes) have a home entry. The showcase block («Книга в цифрах» stat hero + seven trivia facts + featured quote) is now appended *after* the route grid and «Недавно открывали» instead of directly under the task strip, so the fold is task-first; routes still precede recents. Task grid is `#home-tasks-grid` and joined the U4 home control set, so the harness guards the task surface. No palette flip, no `index.html` marketing rewrite (H1603 stays out of fence). 3 `session-features` cases (4 tiles, index tile navigation, task-before-showcase order); `check:redesign` 21/21 and the full suite 179/179 green.

## [4.11.5] - 2026-08-10
### Added
- **Video modal player shell + empty-capable timecode list (H2125, Sonnet 5 (`claude-sonnet-5`)):** «Смотреть» on the video detail page opens an in-app `#video-player-modal` (YouTube iframe embed) instead of only linking out to YouTube; the external "Смотреть на YouTube" link remains as a fallback everywhere. Modal never autoplays, traps focus, restores focus on close, closes on Escape/backdrop/close button, and sets `aria-hidden` on the app chrome while open. Timecode list renders each `video.timecodes[]` entry as a seekable link and shows an honest "Разметка глав пока не загружена" empty state when a video has none — no invented chapter markers (D4). U4 harness routes (`materials-video`, `materials-video-detail`) already covered. `check:security:static` and `check:perf` (standalone HTML gzip budget) both pass.

## [4.11.3] - 2026-08-06
### Added
- **Video gallery dense list default + thumbs toggle (H2124, Sonnet 5 (`claude-sonnet-5`)):** `#vg-list` defaults to `.vg-list-dense` (compact full-width rows); a new `«Превью»` checkbox switches to `.vg-list-thumbs` (grid of cards with a lazy, decorative `mqdefault.jpg` thumbnail per card, `alt=""`). Preference persisted in `localStorage` (`bookindex.vg.thumbs`). No thumb requests fire in the default dense mode. 2 new `tests/e2e/session-features.spec.js` cases (dense-default/toggle/persist, 390px no-overflow). Details: `RESULTS_LOG.md` § H2124.

## [4.11.2] - 2026-08-06
### Added
- **Video gallery a11y + honest copy (H2123, Sonnet 5 (`claude-sonnet-5`)):** `#vg-search`/`#vg-chapter`/`#vg-sort` carry `aria-label`; `:focus-visible` ring on `.vg-input`/`.vg-card-title`/`.vg-chip`/`.video-detail-back`/`.video-detail-yt`; `#vg-meta` is now `role="status" aria-live="polite"`; empty-filter state with a reset-and-refocus button; default sort switched `date-desc` → `title` (only 33/175 rows carry a `date`); undated cards show «дата неизвестна»; intro copy no longer claims in-card timecodes. 2 new `tests/e2e/session-features.spec.js` cases. Details: `RESULTS_LOG.md` § H2123.

## [4.11.0] - 2026-08-02
### Added
- **+339 стратифицированных прямых контекстов (H1825, Fable 5 (`claude-fable-5`)):** дренаж очереди missing_context батчем lexicon 190 / lexicon_reverse 90 / lexicon_tech 26 (снята полностью) / names 26 / toponyms 7 (снята полностью). Прямое покрытие 26.8%→36.8% (порог 35% по прямым контекстам взят), эффективное 36.3%→50.0%, очередь 2149→1687. Глоссы редакторские, привязаны к карте лекций, страничным кластерам и KWIC-совпадениям расшифровок; нечитаемые OCR-заголовки помечены «требует сверки» — без выдуманных значений и страниц. Скрипт-инъектор архивирован: `docs/history/scripts/inject_contexts_h1825.py`; итоги: `RESULTS_LOG.md` § H1825.

## [4.10.2] - 2026-08-01
### Fixed
- **V0 video_catalog id collisions (H2122, Grok 4.5 (`grok-4.5`)):** three YouTube ids (`Tz3T7IxsbLU`, `xIoXVxahvDY`, `cJp5ZrnGivw`) held 6–8 distinct seminar titles each (191 raw → 175 unique). Catalog collapsed to one survivor per id (richest `related_entities`, first-on-ties — same as `getDedupedVideoCatalog`); 16 dropped titles tracked in a data-error GitHub issue. No invented URLs.

### Added
- **CI guard for video ids (H2122):** `validate_video_catalog` in `scripts/validate_content.py` fails on duplicate `video_catalog[].id` or id≠YouTube-url extract; unit tests in `tests/unit/test_validate_video_catalog.py`. One-shot census: `scripts/dedupe_video_catalog_v0.py` + `docs/history/H2122_video_catalog_collision_census.json`.

## [4.10.1] - 2026-07-31

### Fixed
- **Восстановлены утерянные открывающие кавычки в цитатах книги (Opus 5 1M (`claude-opus-5[1m]`), 31-07-2026, H2031, issue [#187](https://github.com/gasyoun/BookIndex/issues/187)):**
  шесть символов U+FFFD в `occurrences.mumintroll.contexts` (языки 72 и 98) заменены на `‘`
  — во всех шести случаях глосс имел вид `— <U+FFFD>текст’`, то есть потеряна ровно
  открывающая кавычка при сохранившейся парной закрывающей. Кавычка восстановлена по
  конвенции самого корпуса (`‘…’`). Поправлены и экспортные копии
  `src/content/nemetskiy.md`, `src/content/russkiy.md`.
  **Первоначальная гипотеза о конвейере расшифровок опровергнута:** порча присутствует в
  `app_data.json` с первого коммита корпуса (`964283105`, 14-04-2026), а `Rauhbank`/`Bratpfanne`
  не встречаются ни в `data/imports/`, ни в `pipeline/` — пути, который мог бы пересоздать
  порчу, нет, поэтому правка данных окончательная.

### Changed
- **Проверка кодировки переведена в CI на `--strict` (H2031):** U+FFFD снова жёсткая ошибка.
  Единственное легальное вхождение (проверка очереди качества в
  [`v3_app.js`](https://github.com/gasyoun/BookIndex/blob/main/v3_app.js)) помечено новым
  построчным маркером `// encoding-guard: allow-ufffd`; маркер действует на строку, а не на
  файл, поэтому непомеченное вхождение в том же файле по-прежнему отчитывается.

## [4.10.0] - 2026-07-31

### Added
- **Переработан детектор моджибейка (Opus 5 1M (`claude-opus-5[1m]`), 31-07-2026, H1482):**
  [`scripts/check_encoding.py`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_encoding.py)
  больше не ищет две захардкоженные сигнатуры (одна цепочка порчи). Теперь текст
  перекодируется обратно каждым кандидатом-кодеком, и в потоке ищутся серии корректных
  многобайтовых UTF-8-последовательностей: покрыты UTF-8 как CP1252/Latin-1, CP1251,
  KOI8-R, CP866, Mac Cyrillic и двойное UTF-8-кодирование, в отчёт попадает
  восстановленный исходный текст. Ловится порча, спрятанная в одной строке чистого
  файла, — старые сигнатуры её пропускали. U+FFFD понижен до предупреждения (легальный
  код цитирует символ намеренно), `--strict` возвращает жёсткое падение, `--warn-only`
  даёт неблокирующий прогон. Markdown сканируется с вырезанными код-спанами, поэтому
  документация может приводить битый текст как пример — закрыт пункт 4 фазы D2 дорожной
  карты. Калибровка: ноль ложных срабатываний на 5592 закоммиченных файлах. `ftfy`
  рассмотрена и отклонена по замеру (пропускает KOI8-R, CP866, Mac Cyrillic).
  Метод и пороги — [`docs/ENCODING_GUARD.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/ENCODING_GUARD.md),
  таблицы — [`RESULTS_LOG.md`](https://github.com/gasyoun/BookIndex/blob/main/RESULTS_LOG.md).
- [`tests/unit/test_check_encoding.py`](https://github.com/gasyoun/BookIndex/blob/main/tests/unit/test_check_encoding.py) —
  25 фикстур на каждый класс порчи плюс негативные примеры из реального текста проекта.
  Добавлены `tests/__init__.py` и `tests/unit/__init__.py`: без них питоновские
  юнит-тесты не запускались вовсе. Два новых шага CI — проверка кодировки документации и
  `python -m unittest discover`.

## [4.9.0] - 2026-07-31

### Changed
- **Phase V2 — точечные UX-доработки семи модулей VIZ (Fable 5 (`claude-fable-5`), 31-07-2026, H1822):** все семь строк таблицы «Phase V2» из [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) закрыты одним заходом, только правки модулей в [`scripts/viz/`](https://github.com/gasyoun/BookIndex/tree/main/scripts/viz) и CSS шаблона:
  - **VIZ-01 (карта по векам):** автопоказ уважает `prefers-reduced-motion` — из ссылки с `autoplay=1` тур больше не самозапускается (в тулбаре появляется пояснение), запустить его можно только явной кнопкой Play; смена системной настройки на «уменьшить анимацию» останавливает идущий тур.
  - **VIZ-02 (граф сосуществования):** порог min weight прижимается к максимальному весу ребра текущей лекции — фильтром больше нельзя получить пустой граф; в сводке при этом появляется «порог снижен до N, выше граф пуст», и прижатое значение пишется в URL.
  - **VIZ-03 (лента открытий):** внутри адаптивной сетки появились полосы эпох — заголовки полувековых интервалов на всю ширину; полосы без видимых карточек скрываются вместе с фильтрами, прокрутка к карточке не использует smooth при reduced motion.
  - **VIZ-04 (тепловая матрица):** подписи лекций и левая дендрограмма вынесены в отдельный липкий (`position: sticky`) svg — при горизонтальной прокрутке матрицы они остаются на месте; сама матрица рисуется с реальной шириной ячейки (16 px) и прокручивается вместо сжатия в фиксированную рамку; тултип крупнее и называет лекцию по имени; экспорт SVG склеивает подписи и матрицу в один файл.
  - **VIZ-05 (Sankey «Слово»):** честное состояние частичных данных — узел без привязанного аргумента раньше молча заимствовал текст первого аргумента, теперь он рисуется пунктиром и полупрозрачным, панель детали объясняет отсутствие источника, в сводке появляется «данные частичны: без источника N из M узлов»; анимация потоков отключается при reduced motion.
  - **VIZ-06 (хорда языков):** новые фильтры топ-N (8/12/16/24/все) и семьи языков (по полю `family` указателя языков), оба сохраняются в URL; цвета стали стабильными — они привязаны к позиции языка в общем списке и совпадают с точками легенды, поэтому язык не меняет цвет при смене фильтров.
  - **VIZ-07 (bump-chart рангов):** пунктирные линии-выноски связывают подпись, смещённую защитой от коллизий, с концом её линии (и участвуют в подсветке серии); значение `top` из ссылки прижимается к диапазону 5–30 и пишется обратно в URL, чтобы скопированная ссылка воспроизводила ровно видимый вид.

## [4.4.1] - 2026-07-30
### Fixed
- **Брейнсторм по восьми полосам сверен с трекинг-issue [#135](https://github.com/gasyoun/BookIndex/issues/135) — и одна ошибка исправлена (Opus 5 1M `claude-opus-5[1m]`, 30-07-2026):** первая редакция [`BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md) писалась по одному брифу H1609 и не проверила issue, где владелец уже зафиксировал вводные. Следствие: четыре из шести концепций предлагали «одну сводную азбучную полосу», тогда как вводная № 2 прямо запрещает сжимать три алфавита на одну полосу. Заменено на два режима владельца — компакт (3 полосы) и простор (6). Добавлен § 4c с блоками, которых в брейнсторме не было вовсе: разворот карты археологических раскопок Великого Новгорода (не путать с картой топонимов), реклама издательства, 3 уже пустые страницы, сценарий 4 фоторазворотов, отложенная грамматика древнерусского. Бюджет владельца (компакт 7, простор 10 полос) означает, что обязательные блоки в просторном режиме сами не влезают в 8 — это сужает выбор концепций сильнее, чем предполагала первая редакция.

## [4.8.0] - 2026-07-30

### Added
- **Палитра команд / быстрый переключатель (Ctrl+K) (Opus 5 (`claude-opus-5`), 30-07-2026, H1824):** одно модальное окно, из которого доступна вся навигация и часть действий, без обхода шапки и вкладок. Реестр строится из того же `NAV_SECTIONS`, что рисует переключатель разделов, — 24 маршрута плюс 5 действий (фокус в глобальный поиск, три режима плотности, «назад»), поэтому новый раздел появляется в палитре сам, без второго списка, который разошёлся бы с первым. Три источника результатов в одном поле ввода: команды, недавно открытые записи (`Zalizniakiada.recentItems.v1`, показываются без запроса) и содержание указателя через уже существующий `getGlobalSearchMatches` (Fuse + устаревший точный поиск как запас) — палитра ничего из этого не переизобретает.
- Отбор команд — по подпоследовательности с приоритетом префикса (`совпадение с начала` 100, вхождение 70 − смещение, подпоследовательность 20), поэтому «глосс», «плтнст» и «лекц» находят нужную строку. Клавиатура закрыта целиком: Ctrl+K / ⌘K открывает и закрывает (работает и когда фокус стоит в поле ввода — обработчик стоит выше `shouldIgnoreGlobalHotkeys`, который глушит хоткеи с модификаторами), ↑↓ с закольцовыванием, Enter, Esc с возвратом фокуса туда, откуда палитру позвали. Для мыши и мобильных — кнопка «⌘K» в шапке рядом с поиском.
- Доступность: `role="dialog"` + `aria-modal`, `aria-hidden` снимается только на время показа, поле ввода — `combobox` с `aria-controls`/`aria-activedescendant`, строки — `option` с `aria-selected`. Заголовки в текст выводятся через `textContent`/`appendHighlightedSearchText` (контракт C3/H1607: никакого `innerHTML` на данных).
- [`tests/e2e/command-palette.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/command-palette.spec.js) — 12 тестов: открытие хоткеем и кнопкой, три способа закрытия, фильтрация с переходом по Enter, стрелки, клик по строке, попадание в содержание указателя, открытие поверх фокуса в поле поиска с возвратом фокуса, недавние записи без запроса, смена плотности, пустой результат, атрибуты доступности.

### Fixed
- Enter (и стрелки) сразу после быстрого набора выполняли **предыдущий** список: рендер результатов отложен на 80 мс, и активной оставалась строка от прошлого запроса. Добавлен принудительный сброс отложенного рендера перед действием, а выбранная запись теперь хранится на самой строке (`row._entry`), а не только по индексу, — клик выполняет то, что человек видел, даже если список успел перерисоваться.
- Два теста падали в полном прогоне и проходили по отдельности (числились в `.ai_state.md` как «order-dependent flakes» после H1823): причина не в утечке `localStorage`, а в том, что оба трогали интерфейс до `wireGlobalUI()` — `fill()` по `#global-search` без привязанного `oninput` и `selectOption()` по `#density-select` без обработчика `change` тихо не давали эффекта. Оба теперь ждут признак загрузки приложения; полный набор — 169 тестов зелёными подряд.

### Changed
- Потолок `v3_app.js` в [`scripts/check_performance_budget.mjs`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs): 670 000 → 700 000 B raw, 156 000 → 162 000 B gzip. Палитра стоит +27,8 KiB raw / +1,9 KiB gzip (реестр, скорер, отрисовка); прежний потолок был выбран под H1604 и не оставлял места.

## [4.7.0] - 2026-07-30

### Added
- **Phase U4 — верификационная обвязка перед редизайном интерфейса (Opus 5 (`claude-opus-5`), 30-07-2026, H1823):** [`tests/e2e/redesign-baseline.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/redesign-baseline.spec.js) — 17 тестов на восемь маршрутов из § «Phase U4» [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md), каждый на двух ширинах (1366×900 и 390×844). Проверяется всё, что перечислено в спецификации: горизонтальное переполнение, наличие и видимость основных элементов управления, их непересечение (попарный тест ограничивающих прямоугольников, вложенные пары исключены), непустые поверхности отрисовки при наличии данных, нулевой бюджет ошибок консоли. Скриншоты пишутся в `test-results/redesign-baseline/` как артефакты для глазного сравнения, а не как пиксельные эталоны: растеризация шрифтов на Windows и в CI различается, поэтому закоммиченный эталон `toHaveScreenshot` падал бы везде, кроме машины-автора. Запуск отдельно — `npm run check:redesign`; в `npm run check:e2e` набор попадает автоматически.
- Семнадцатый тест набора (16 маршрутных + 1) — контрактный: он перечитывает список маршрутов прямо из § «Phase U4» дорожной карты и падает, если спецификация и обвязка разойдутся. Объявленные поверхности данных тоже строгие — селектор, который перестал совпадать, роняет тест, а не тихо пропускает проверку (эта же ошибка была допущена и найдена при разработке: `.viz-module-body` не существует, у VIZ-03 это `.viz-card` + `.tl-wrap`).

## [4.6.0] - 2026-07-30

### Added
- **VIZ-08, второй центр карты — режим «Центр: сущность» (Opus 5 (`claude-opus-5`), 30-07-2026, H1821, добор до полной спецификации):** `v4.5.0` выпустил карту с центром на *направлении исследований*, а Phase V3 в [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md) специфицирует центр на *выбранной сущности* с прогрессивным раскрытием и переиспользованием `cross_links`. Теперь есть оба: переключатель «Центр: направление / сущность». В режиме сущности — первый круг связей по умолчанию, второй по требованию, тип связей переключается между `cross_links` (типизированные, с весами) и `semantic_links` (нетипизированные, по общим страницам); рядом с картой — страницы книги, лекции/главы, термины глоссария и видео с таймкодом. Клик по узлу переносит центр карты (обход графа через URL), клик по центру открывает карточку. Ссылка воспроизводима: `mode`, `entity`, `rel`, `depth`.
- Четыре ключа состояния (`mode`, `entity`, `depth`, `rel`) добавлены в `ALLOWED_KEYS` [`scripts/viz/viz-state.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/viz-state.js) — совместимо со всеми остальными модулями.
- Тесты режима сущности в [`tests/e2e/research-map.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/research-map.spec.js): 7 → 12 (первый круг + URL, второй круг с проверкой после reload, переключение `cross`/`semantic`, перенос центра кликом, видимость полей по режиму и сброс).

### Fixed
- `.viz-toolbar label` ставил `display:inline-flex`, перебивая атрибут `[hidden]`: поля, относящиеся только к одному режиму, не скрывались. Добавлено `.viz-toolbar label[hidden] { display: none; }` — правило общее для всех модулей, так что тот же класс дефектов закрыт и на будущее.

## [4.5.0] - 2026-07-30

### Added
- **VIZ-08 «Исследовательская карта» — восьмой модуль визуализаций, первый интегративный (Opus 5 (`claude-opus-5`), 30-07-2026, H1821):** [`scripts/viz/research-map.js`](https://github.com/gasyoun/BookIndex/blob/main/scripts/viz/research-map.js) собирает исследовательскую программу А. А. Зализняка в один экран — семь направлений (сравнительно-историческое языкознание, акцентология, берестяные грамоты, «Слово о полку Игореве», диалектология, морфология, против любительской лингвистики), каждое агрегирует четыре слоя данных: свидетельства из `scholar.*`, границы глав и страниц, сущности указателя и связанные видео из `video_catalog`. Остальные семь модулей показывают по одному срезу; этот показывает, как срезы сходятся. Обзор — концентратор с семью узлами (размер ∝ числу свидетельств) и пунктирными мостиками по общим сущностям; раскрытое направление — спутники-сущности с переходом в карточку. Панель справа ведёт к главам (`openLecturePage`), к видео (`openVideoDetail`), в смежные направления и в профильный модуль VIZ-01…07. Состояние в URL (`filter`, `top`), SVG-экспорт, полная обвязка `VizShell`. Замеры охвата и мостиков: [`RESULTS_LOG.md`](https://github.com/gasyoun/BookIndex/blob/main/RESULTS_LOG.md) § H1821.
- Регрессионный набор [`tests/e2e/research-map.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/research-map.spec.js) (7 тестов: обзор, мостики, раскрытие с состоянием в URL, глубокая ссылка, сброс, переход в карточку, клик по сводной таблице) плюс `viz08` в контрактном [`tests/e2e/viz-shell.spec.js`](https://github.com/gasyoun/BookIndex/blob/main/tests/e2e/viz-shell.spec.js).

### Changed
- Потолок gzip для `aaz-index.html` в [`scripts/check_performance_budget.mjs`](https://github.com/gasyoun/BookIndex/blob/main/scripts/check_performance_budget.mjs) поднят 180 000 → 186 000 B: предыдущий `main` уже занимал 179 435 B (99,7%), из-за чего любая новая панель ломала гейт независимо от своей цены. Стили VIZ-08 — ~871 B gzip.
- Из дорожных карт вычеркнуты два устаревших пункта дрейфа (H1878, [PR #171](https://github.com/gasyoun/BookIndex/pull/171)): [`docs/DH_ROADMAP_2026.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/DH_ROADMAP_2026.md), [`docs/CLEANUP_AND_UI_ROADMAP.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/CLEANUP_AND_UI_ROADMAP.md).

### Fixed
- Версия синхронизирована по всем файлам: релиз `v4.4.0` был тегирован, но `package.json`, `CITATION.cff` и README остались на `4.3.1`. Теперь все три несут `4.5.0`, а `date-released` в `CITATION.cff` — дату этого релиза.

## [4.4.0] - 2026-07-29
### Added
- **Брейнсторм по восьми полосам печатного спутника (Opus 5 1M `claude-opus-5[1m]`, 29-07-2026, [PR #168](https://github.com/gasyoun/BookIndex/pull/168)):** ruling MG «я не решил что именно будет на 8 полосах, надо brainstorm» открыл всю тетрадь, а не только полосу 8, которую держал открытой бриф H1609. [`docs/BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md`](https://github.com/gasyoun/BookIndex/blob/main/docs/BRAINSTORM_PRINT_8PP_SIGNATURE_CONCEPTS_2026.md) — шесть цельных концепций тетради, пул из 14 вариантов по отдельным полосам (4 новых, найдены в самих данных: указатель имён как «кто есть кто» на 176 персоналий, этнонимический разворот на 66, практикум поиска по 3 708 KWIC-сегментам, «слова-звёзды» из 1 403 обратных лексических входов) и замер того, что набирается из готовых массивов против того, что требует авторского текста.

### Fixed
- **Две поправки к производственному брифу, найденные при замере (тот же проход):** (1) вариант 3 «мини-словарь лингвистических терминов 30–40» вышел с оговоркой «не дублировать глоссарий, если он уже есть» — глоссарий **уже есть**, 36 статей в [`data/modules/21-materials.json`](https://github.com/gasyoun/BookIndex/blob/main/data/modules/21-materials.json), ровно тот объём, так что это не «написать словарь», а «отобрать и сверстать существующее»; (2) вариант 9 (колофон) помечен в брифе как слабый «пока не выпущен Zenodo-DOI» — **DOI выпущен**, concept `10.5281/zenodo.21630473` (см. [4.3.1] от 27-07-2026, на день позже брифа), поэтому колофон разблокирован и одно из четырёх решений человека снято за ненадобностью.

## [4.3.1] - 2026-07-27
### Added
- Real Zenodo DOI wired in (H1601 follow-up): the Zenodo↔GitHub webhook (configured 2026-07-09, previously undocumented) minted a concept DOI `10.5281/zenodo.21630473` and version DOI `10.5281/zenodo.21630474` from the `v4.3.0` release. Backfilled into `CITATION.cff` (`identifiers:` block), README (DOI badge + citation section), `LICENSE-DATA.md`, and `docs/ZENODO_RU.md` status note. ORCID is still the one open item — no human input yet, placeholder stays commented.

## [4.3.0] - 2026-07-27
### Note
First tagged GitHub release since `v4.2.0` (2026-04-18). The sections previously
dated `[1.0.0] - 2026-06-13` and `[2.3.0] - 2026-05-26` below were drafted in this
file but never actually tagged or released — `package.json`, `CITATION.cff` and
the README all stayed at `2.2.0` the whole time, and no `v1.0.0`/`v2.2.0`/`v2.3.0`
git tag was ever cut (only `v2.1.0`, `v4.1.0`, `v4.2.0` exist). This release folds
that drafted-but-unshipped content together with everything accumulated under
`[Unreleased]` since into one real release, and continues the actual git-tag
sequence (`v4.2.0` → `v4.3.0`) rather than the changelog's separate internal
numbering. It also lands the citability/Zenodo release packaging (H1601).

### Added
- Landing-promotion decision brief (H1603): `docs/LANDING_SUSTAINABLE_PROMOTION_DECIDE_2026.md` —
  adopt/hybrid/reject brief for promoting `mockups/sustainable.html` (H654) to the live
  `index.html`. No ruling was on record at launch, so per the handoff's own gate the session
  stopped with this brief instead of force-adopting. Key facts: current landing is already
  near-sustainable (15.6 KB, 0 webfonts/trackers, SVG-only); mockup's real delta is the dark
  scheme (−2.7 KB cosmetic); the app it opens into is light-only parchment, so a moss-dark
  front door creates a dark→light handoff. Recommendation: hybrid (dark scheme on the
  existing parchment tokens), else reject. Human `@DECIDE` mirrored in Uprava GTD.
- Print-companion brief (H1609): `docs/PRINT_8PP_COMPANION_BACKMATTER_2026.md` — 8-page
  endmatter signature for «Из жизни слов и языков» (mumintroll, 2026): fixed map for
  pages 1–7 (Devanagari / Arabic / Old-Russian charts, video-archive spread with measured
  176 lectures ≈213 h / 27 transcripts, two sibling-book cards), 10 ranked options for the
  open page 8 with a recommendation (QR guide), fallback one-alphabet layout, typesetting
  and rights notes. Page-8 pick is an open human `@DECIDE` (mirrored in Uprava GTD).
- VIZ Phase V1 shell (H1605): shared `scripts/viz/viz-shell.js` chrome for all seven
  active modules — module header (title + data-source chip + Сброс/Ссылка/SVG),
  toolbar grammar (filters left / view right), unified loading/empty/error states,
  focus rings and max-width overflow guards. Exceptions documented in
  `docs/VIZ_SHELL_EXCEPTIONS_H1605.md`.
- Video **detail card** (H1604 / B4 residual): hash route `#v4/materials/video/<id>` shows title, date, duration, YouTube link, related-entity chips (`navigateToItem`), and an honesty note on book-chapter thematic overlap (not a recording of the chapter). Reachable from the video gallery titles and the home «Я смотрю видео» search; gallery keeps a separate YouTube deep link. Home search uses `getDedupedVideoCatalog` so counts are not inflated. E2E in `tests/e2e/session-features.spec.js`.
- H1602 context-coverage batch: **+88** direct contexts (stratified: lexicon 50, names 12, languages 6, toponyms 6, ethnonyms 5, lexicon_tech 5, lexicon_reverse 4). Direct coverage **24.2% → 26.8%** (816→904); effective **32.3% → 36.3%** (clears 35% target). Metrics in `RESULTS_LOG.md`; `validate_content.py` green.
- Volume-II entity **candidates** from lectures-v2 (DH C3 residual, H1599):
  `scripts/extract_entities_from_transcripts.py --candidates` proposes heads
  *absent* from `app_data` (names with initials, languages, quoted subjects;
  ethnonym hints) with type guess, first-mention timecode and frequency caps.
  Emits `data/imports/lectures-v2/entity_candidates.{json,csv}` plus
  `ENTITY_CANDIDATES_README.md` (review protocol + `import_source.py` promotion).
  Never writes unreviewed heads into `app_data`.
- «Сообщить об ошибке» flow (DH roadmap C4): entity cards link to a prefilled GitHub issue form (`.github/ISSUE_TEMPLATE/entity_correction.yml`) carrying the entity's slug, type, canonical URL and a `[правка] <head>` title; new `type:correction` label completes the four-group taxonomy for reader-reported corrections.
- KWIC over lectures matches accent-tolerantly — «победа» also matches the stressed transcript form «побе́да».
- Entity-card secondary actions (show on map, copy link, export .md) collapse into a «⋯ еще» menu; prev/next/back stay visible (B5).
- Regression E2E suite (`tests/e2e/session-features.spec.js`) covering the home task dashboard, chapter ribbon, lecture KWIC, video gallery, card order/dedup/actions, page citations and the lecture↔video link.
- Authority review worklist: `scripts/retier_authority_candidates.py` (`npm run authority:retier`) emits `data/authority_review.{json,csv}` — the 209 unconfirmed Wikidata candidates tiered by decision effort (decide / research / none) with a suggested QID and a `decision` column.
- Entity-card content priority (B5): the card now orders sections by reader value — pages + contexts, then the «Видео» chips (moved up above the cross-link cluster), then cross-links with the «Авторитетные записи» chips grouped right after them, then external-DB (LOD) links and the citation widget.
- Video gallery (B3.5): a new «Видеогалерея» tab under Материалы lists all 175 (deduplicated) videos with title, date, duration and clickable entity chips, plus search (by title or mentioned entity), a book-chapter filter, and sort by date or duration.
- Video ↔ chapter linkage (B3.4): each lecture/chapter page now lists topically related videos — public lectures whose discussed entities overlap that chapter's pages — under «Видео по теме главы», with an explicit note that they are related lectures, not recordings of the book chapter. The chapter ↔ page-range mapping was already shown («стр. X–Y»).
- Page-level citations + canonical links (B2): the entity card's «скопировать ссылку» now copies the stable clean canonical URL (the prerendered page) instead of the app hash route, and the on-card citation widget (ГОСТ/APA/MLA/Chicago) now includes the page reference («С. 157») and the correct book title from `corpus.books`, citing the clean canonical URL.
- Home as a task dashboard (B4): the home page now leads with a "С чего начать?" band of three reader tasks — «Я читаю страницу книги» (page number → page view), «Я смотрю видео» (inline title search over the 191-video catalog), «Найти слово, имя, термин» (→ global index search). The stats/showcase moved below.
- Book-spine chapter ribbon (B1): the «Читаю сейчас» page view gained a navigable density mini-map of the 11 chapters — each segment is sized by page span and shaded by mention density, the current page's chapter is highlighted, and clicking a segment jumps the page view to that chapter.
- KWIC over the lecture corpus: the concordance gained a "Лекции (видео)" source that searches the ~240k-word timecoded transcript corpus and links each hit to the exact minute in the video (`&t=<sec>s`). Backed by a compact, lazy-loaded index (`data/lectures_kwic.json`, built by `scripts/build_lectures_kwic.py` / `npm run kwic:build`) so it never bloats the main artifact.
- Live GitHub Pages health checks plus Lighthouse and axe accessibility quality gates.
- Video-production pipeline tracker: `data/video_pipeline.json` (per-video proof-reading stage, transcription quality, assignees, dates, links) migrated from `video-archive.xlsx`, plus a self-contained volunteer dashboard at `pipeline/index.html` (`npm run pipeline:dashboard`).
- Reverse video links on entity cards: names, languages, ethnonyms, toponyms, lexicon and subject cards now list the lectures/talks that mention them (built from `video_catalog[].related_entities`), newest first, with duration and a total count.
- Lecture transcript corpus (`data/imports/lectures-v2/`): `scripts/ingest_transcripts.py` fetches edited transcripts from public Yandex.Disk links recorded in `data/video_pipeline.json`, extracts timecoded segments (`.docx`/`.srt`, stdlib only), and stores one reviewable JSON per lecture plus a corpus index. 27 lectures ingested (~240k words, ~3.7k timecoded segments) with proof-reading-stage provenance; feeds upcoming deep video links (B3.2), entity extraction (C3) and lecture KWIC.
- Deep video links by timecode (B3.2): `scripts/build_transcript_timecodes.py` matches each entity against the transcript corpus and writes the first-mention timecode onto `video_catalog[].related_entities[].t`; entity-card video links now jump straight to that minute (`&t=<sec>s`) and show a `▸ MM:SS` marker. 85 of 113 entity/video pairs on transcribed lectures are timecoded; the rest fall back to a plain link.
- TEI standOff + CSV exports (A6): `scripts/export_tei.py` (`npm run export:tei`) generates `exports/bookindex.tei.xml` (`listPerson`/`listPlace`/`listNym` + language/subject lists, each with `xml:id`, authority `<idno>`, canonical `<ptr>` and page/source notes) plus per-type CSV dumps. Output is deterministic and self-validated for XML well-formedness; TEI is an export format, not an authoring format.
- Simulator source audit (A5): `docs/SIMULATOR_AUDIT_RU.md` inventories every claim in the three linguistic simulators (sound laws, accent reconstructor, orthography hydrator) with a source/status for each (standard / authoritative / illustrative). Each simulator now carries a visible source footnote framing it as an educational/illustrative tool — accent paradigms A/B/C attributed to Zaliznyak's accentology (1985/2008), sound changes to standard comparative Slavistics, and the orthography hydrator's substring matching flagged as approximate.
- Provenance of derived layers (A4): `docs/METHODS_RU.md` and machine-readable `data/provenance.json` document how `edges`, `language_edges`, `cross_links` and `semantic_links` are derived (proximity-weighted co-mention / similarity), and state honestly that no generator is committed so the exact formulas are not reproducible from the repo. The name and language co-mention graphs now carry a provenance caption ("связи вычислены автоматически… поисковый сигнал, не нормативное утверждение") linking to the methods doc.
- Authority identifiers (A3): `scripts/align_authorities.py` aligns names/toponyms/ethnonyms to Wikidata (with VIAF/GND/GeoNames pulled from the matched item). 131 of 340 high-confidence matches auto-written to `authority` blocks in `app_data.json` (`src: wikidata-auto`); the rest are left in `data/authority_candidates.json` for manual review. Persons are verified by instance-of=human + surname + initials + a scholarly/historical domain filter (rejects off-domain same-name matches). Entity cards show an "Авторитетные записи" chip row; prerendered pages add schema.org `sameAs`. Schema extended with an `authority` property.
- Stable canonical entity URIs (A2): a frozen slug registry (`data/slug_registry.json`, keyed by each entity's `canonical_id`) makes URL slugs stable across releases — a head rename never changes the URL. `scripts/build_slug_registry.mjs` (`npm run slug:freeze`) maintains it; `scripts/prerender.mjs` consumes it. Entity pages now declare the clean prerendered path as `<link rel="canonical">`, `og:url` and JSON-LD `@id` (was the app hash route). Added a retired-slug redirect table (`data/slug_redirects.json`) consulted by `404.html`. URIs stay global (one merged entity = one URI), matching the by-head identity model; introduced with zero change to existing slugs.
- Citability / scholarly infrastructure (A1): `CITATION.cff` (CFF 1.2.0, GitHub "Cite this repository"), `.zenodo.json` for DOI minting on release, `LICENSE-DATA.md` separating code (Apache-2.0), index data (CC BY 4.0) and book quotes/transcripts (© rights holders, cited with permission), a "Как цитировать" + license section in the README, and `docs/ZENODO_RU.md` deposit guide.
- Entity↔lecture linking from the corpus (C3): `scripts/extract_entities_from_transcripts.py` links known index entities (names, toponyms, ethnonyms, languages, subject terms — lexicon excluded as too noisy) to the lectures that mention them, with first-mention timecodes. Adds 807 `src:"transcript"` edges to `video_catalog[].related_entities`, raising the number of entities with a video section from ~48 to ~239. Russian matching uses stemmed prefixes, strict multiword phrases, and surname anchoring with epithet/patronymic/collision guards.
- **Sound Law Simulator**: Interactive po-shagovaya historical phonology engine showing the evolution of Proto-Slavic reconstructed roots to modern Slavic descendants (Russian, Polish, Czech).
- **Linguistic Database Interoperability (LOD)**: Direct Glottolog, WALS, Vasmer's Dictionary on Starling, and Russian National Corpus (RNC) connections integrated in Language and Lexicon SPA cards.
- **Old Russian Accentology Paradigm Simulator**: Dynamic reconstructor for Accent Paradigms A (baritone), B (oxytone), and C (mobile) tracing nominal declensions across three historical stages.
- **Old East Slavic Orthography Hydrator**: Real-time medieval grapheme processing engine translating modern Russian words to Old East Slavic spelling forms (`ѣ`, `ъ`/`ь`, `ѫ`/`Ѧ`, `ѡ`).
- Complete E2E and visual check suite passing all 104 Playwright tests cleanly.

### Changed
- Regenerated `tests/index-audit-queue.json` + `tests/context-entry-pack.{json,md}` after H1602 context drain (missing_context 2285→2149).
- H1598 lecture-transcript ingest re-check: still **27/176** videos with `links.text` — NO-OP documented in `docs/LECTURE_TRANSCRIPT_INGEST_H1598_NOOP_24.07.2026.md` (no corpus/KWIC regeneration).
- Raised the axe accessibility gate to require zero critical and zero serious violations on audited routes.
- Switched the standalone app from embedding the full `app_data.json` payload to lazy-loaded `data/modules/*.json` chunks that are pre-cached for offline use.
- Darkened muted helper text in the app shell so route metadata, index summary chips, chapter labels and KWIC controls meet contrast requirements.
- Replaced script CSP `unsafe-inline` with build-generated SHA-256 hashes for the landing page and standalone app shell.
- Replaced broad style CSP `unsafe-inline` with build-generated SHA-256 hashes for inline style blocks.
- Removed the remaining `style-src-attr 'unsafe-inline'` exception by moving runtime style attributes to `data-*` driven DOM style updates.
- Opted GitHub workflows into the Node 24 JavaScript action runtime ahead of the June 2026 migration.
- Raised the `v3_app.js` runtime-script performance budget to match the app's real size after the corpus/video/DH feature growth (the budget had been exceeded since a pre-existing commit); the gate is enforceable again.

### Fixed
- Deploy-asset drift (found while running the `build:vite` step of this release): `public/sw.js` had silently fallen out of sync with the root `sw.js` since commit `ed2b7faa` (26-05-2026) — it was still precaching `zaliznyak_portrait.png` instead of `.webp` and missing `404.html`, so every `npm run build:vite` run regenerated a stale service worker. Synced `public/sw.js`, added the missing `public/zaliznyak_portrait.webp`, and added `zaliznyak_portrait.webp` to the `deployAssets` list in `scripts/vite/postbuild-copy.mjs` so the drift can't reoccur silently.
- `npm audit` CI gate: bump transitive `brace-expansion` **2.1.0 → 2.1.2** (GHSA-3jxr-9vmj-r5cp high / DoS). Clears `check:security` (`npm audit --audit-level=moderate`) which had been failing every main push.
- C3 / H1607: priority UI paths (global search rows, entity list heads, KWIC empty/result rows, card context + source-quote rows) render untrusted text via `textContent` / DOM APIs instead of data-bearing `innerHTML`; `escapeHtml` stays as defense-in-depth for residual template joins. Regression: `tests/e2e/dom-render-harden.spec.js`.
- Restored the README «Audit Summary» section (dropped by the H550 README refresh), un-reddening the `validate_content.py` CI gate that had failed on every push to `main` since.
- Reverse video links now de-duplicate by video id (`video_catalog` contains duplicate-id rows), so entity-card video counts and lists are no longer inflated; the chapter-related-videos and gallery views share the same deduped catalog.
- Entity citations fall back to per-book `occurrences` pages when `page_list` is empty, so the «С. N» reference is no longer dropped (e.g. «Saloni Z.» → «С. 157»).
- Security hardening (defensive, author-curated data): escape interpolated values in the app + prerender citation widgets and the prerendered JSON-LD (`</script>` guard); validate the 404 retired-slug redirect against `^[a-z0-9-]+$`; CSV formula-injection guard in the TEI exports; `</script>` guard in the pipeline dashboard.
- Matcher precision: whole-word (not substring) surname matching in the authority aligner; a ≥4-char floor in the transcript timecoder.

### Removed
- Dead root build artifact `v13_app_test.js` archived to `docs/history/v13_app_test.js` (H1506) — May-2026 concatenated output of the old `bundle.js` pipeline; zero live references in package.json/CI; `npm run build`, `check:js`, and Playwright (127) still pass.
- Root runtime dead copies `v3_app.js.orig` (tracked) and ignore-policy for `*.orig` / existing `*.bak` (H1608) — large backup siblings of live `v3_app.js` that confused greps and inflated the tree; no package/docs references.
- Retired `video-archive.xlsx` from the repository; the canonical production status now lives in `data/video_pipeline.json`.

## [4.2.0] - 2026-04-18

# Release Notes - v4.2.0 (2026-04-18)

## Highlights

- ???????? ???????????? `runtime_test.py`:
  - ????-????? Node.js ????? `NODE_BINARY`, PATH ? ??????? ???? Windows;
  - ???????? ??????????? ????????? ??? ?????????? Node.js.
- ???????? `scripts/content_report.py`:
  - ??????? ??????? ?? `app_data.json`;
  - ??????? ??????: Markdown (`--format md`) ? JSON (`--format json`).
- ????????? ????????? reduced motion:
  - CSS-????????? ??? `prefers-reduced-motion: reduce`;
  - ?????????? smooth-scroll ? ?????? ? scholar-??????? ??? reduced motion.
- ????????? ????????????:
  - ????? `README.md` ? ?????????? ????????? ???????????;
  - ????????? ??????? ?????????? `KIDS_GUIDE_RU.md`.

## QA (?????? 2026-04-18)

- `python runtime_test.py` (c `NODE_BINARY`) - OK (`21/21`).
- `npx playwright test` (????? ????????? Node.js) - OK (`34 passed`).

## GitHub

- Merged PR:
  - `#50` runtime_test Node guard.
  - `#52` content audit report.
  - `#54` reduced motion support.
- Closed issues:
  - `#49`, `#51`, `#53`.

## [4.1.0] - 2026-04-17

# Release Notes - v4.1.0 (2026-04-17)

## Highlights

- `#43` KWIC MVP ??????? ?? ??????????? DoD:
  - ????? ?? `lexicon` ? `glossary`;
  - ?????? ????????? ???????;
  - ?????????? ?? ??????/??????? ????????? ? ????????;
  - ???????? ? ???????? ? ? ?????? ?????????.
- ????????? ??????????? ? ??????? guard'? ??? ????????? KWIC-??????????:
  - ???????????? `contexts` ?? ????? ?????????? ??????;
  - ?????????? ???????? ?? ??????????;
  - ?????? ?? ?????? ????????? ? ?????????? ????? ??????;
  - ????? ???? ???????? ?????? ? ????????? ? UI ("???????? ?????? N").
- `#45` ???? ?????????? ????????? ?? `D3.js`:
  - zoom/pan;
  - ?????? ???????????? ???? ?????;
  - tooltip ? ???????;
  - ???? ?? ???? ????????? ???????? ???????.
- `#46` PWA foundations:
  - `manifest.webmanifest`;
  - `sw.js` (cache shell + offline fallback);
  - ?????? `icon-192.svg`, `icon-512.svg`;
  - ??????????? service worker ? ????????.
- `#47` BibTeX export:
  - ??????? scholar bibliography;
  - ??????? further reading;
  - ??????? ?????????? ?? ????????.

## KWIC Perf Snapshot

??????? ???? ?? ????????? ?????? ????????:

```bash
node scripts/profile_kwic.js
```

???? ?? 30 ????????? ?? ??????:

- Lexicon KWIC: ???????? `avg ~14.1ms`, ???????? `p95 ~30.8ms`, ?? `593` ?????.
- Glossary KWIC: ???????? `avg ~61.2ms`, ???????? `p95 ~78.5ms`, capped at `1200` ????? (`truncated=true` ??? ??????? ????????).
- ?????????? `left` ?? 400 ?????: ???????? `avg ~34.5ms`, ???????? `p95 ~50.7ms`.

## QA

- `python scripts/build_aaz_index.py` - OK.
- `python scripts/check_encoding.py` - OK.
- `python scripts/validate_content.py app_data.json` - OK (`0 errors`, `2` ????????? warning ?? ?????? ??????).
- `python runtime_test.py` - OK (`21/21`).
- `playwright test` - OK (`34 passed`).

## Included Artifacts

- `aaz-index.html` (standalone SPA build).

## Notes

- ?????? PR [#48](https://github.com/gasyoun/BookIndex/pull/48) (Ready for review) ?? ????? `codex/v4.1-local-finalize`.
- ? `#44/#45/#46/#47` ????????? ??????????? ?? ??????? ?? PR `#48`; ???????? ???????? ????? `Closes #...` ? PR body.

## [2.2.0] - 2026-05-17
### Added
- Open Graph, Twitter Card and JSON-LD metadata for `index.html` and `aaz-index.html`.
- Local Leaflet CSS/JS assets so runtime scripts no longer depend on `unpkg.com`.
- Full Playwright CI gate, npm audit, static security policy guard, performance budget, Dependabot and CodeQL.
- `robots.txt`, `sitemap.xml`, PWA icons, manifest copies and portrait preview asset for GitHub Pages.

### Changed
- Restored the tested `v3_template.html` + `v3_app.js` standalone runtime after the temporary `src/entry.js` path failed full parity.
- Kept Vite as a standalone build smoke and deploy-asset copy path.
- Updated Vite to the current 8.x line and kept dependency audit at zero vulnerabilities.
- Normalized README, Codex workflow, Claude guidance, changelog and documentation archive notes.

## [2.1.0] - 2026-04-15

# Release Notes — v2.1.0 (2026-04-15)

## Highlights

- Closed full v2 backlog (`#16`–`#25`).
- Added density modes (`compact`, `reader`, `research`) with persistence.
- Added lecture comparison panel (intersection and unique entities).
- Added page-range trends analytics with interactive window selection.
- Added analytics export to `CSV` and `Markdown`.
- Added data schema versioning and migrations:
  - `schema_version` / `schema_migrations` in `app_data.json`;
  - runtime migration layer in `v3_app.js`;
  - validation checks in `scripts/validate_content.py`;
  - standalone migration tool `scripts/migrate_app_data.py`.

## Build and QA

- Built fresh standalone artifact: `aaz-index.html`.
- Validation: `python scripts/validate_content.py app_data.json` — `0 errors`.
- Runtime smoke: `python runtime_test.py` — `20/20`.

## Included artifact

- `aaz-index.html` (standalone SPA build for browser use).
