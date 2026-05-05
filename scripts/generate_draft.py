import json
import os

draft = {
  "book_id": "zametki",
  "title": "Из заметок о любительской лингвистике",
  "author": "А. А. Зализняк",
  "year": 2025,
  "edition": "2-е изд., испр. и доп. — М. : Альпина нон-фикшн, 2025",
  "status": "draft",
  "source_type": "book",
  "pages_total": 208,
  "default_route": "#v4/home/home",
  "content_modules": ["app_data.json"],
  "import_meta": {
    "imported_at": "2026-05-04T00:00:00Z",
    "source_file": "PDFtoTXT/AAZ_Zametki_2025.txt",
    "importer_script": "scripts/import_source.py",
    "importer_version": "1.0"
  },
  "data": {
    "names": [
      {"id": "name-aaz", "name": "А. А. Зализняк", "contexts": ["Автор книги, лингвист."], "pages": [1]},
      {"id": "name-atf", "name": "А. Т. Фоменко", "contexts": ["Автор «Новой хронологии», математик, академик РАН."], "pages": [2, 161, 164, 165, 167]},
      {"id": "name-sk", "name": "Г. В. Носовский", "contexts": ["Соавтор книг по «Новой хронологии»."], "pages": [164, 167]},
      {"id": "name-mirolyubov", "name": "Ю. П. Миролюбов", "contexts": ["Историк-любитель, опубликовавший «Велесову книгу»."], "pages": [170, 171]},
      {"id": "name-izenbek", "name": "Али Изенбек", "contexts": ["Офицер, нашедший дощечки «Велесовой книги»."], "pages": [170]},
      {"id": "name-kur", "name": "А. Кур (Куренков)", "contexts": ["Генерал, историк-любитель, публиковавший статьи о «Велесовой книге»."], "pages": [171]},
      {"id": "name-asov", "name": "А. И. Асов", "contexts": ["Главный пропагандист «Велесовой книги» в России."], "pages": [171, 172, 174]},
      {"id": "name-tvorogov", "name": "О. В. Творогов", "contexts": ["Лингвист, автор критики «Велесовой книги»."], "pages": [172]},
      {"id": "name-alekseev", "name": "А. А. Алексеев", "contexts": ["Лингвист, автор критики «Велесовой книги»."], "pages": [172]},
      {"id": "name-solzhenitsyn", "name": "А. И. Солженицын", "contexts": ["Упомянут в связи с вручением Литературной премии его имени."], "pages": [197]},
      {"id": "name-darvin", "name": "Дарвин", "contexts": ["Упомянут в контексте отношения к научному знанию."], "pages": [201]}
    ],
    "toponyms": [
      {"id": "top-cordoba", "name": "Кордова", "contexts": ["Географическое название, сопоставляемое Фоменко со словом 'Орда'."], "pages": [162]},
      {"id": "top-thessaloniki", "name": "Фессалоники (Салоники)", "contexts": ["Греческий город."], "pages": [164]},
      {"id": "top-novgorod", "name": "Новгород", "contexts": ["Древний город на Руси."], "pages": [170, 178]},
      {"id": "top-ruskolan", "name": "Русколань", "contexts": ["Страна русов, фигурирующая в «Велесовой книге»."], "pages": [176]},
      {"id": "top-greckolan", "name": "Грецколань", "contexts": ["Название Греции в «Велесовой книге»."], "pages": [176]},
      {"id": "top-kiev", "name": "Киев", "contexts": ["Древний город."], "pages": [194]}
    ],
    "ethnonyms": [
      {"id": "ethno-rusi", "name": "русы (русские)", "contexts": ["Упоминаются в контексте 'русско-ордынской империи'."], "pages": [167]},
      {"id": "ethno-ordyncy", "name": "ордынцы", "contexts": ["Упоминаются вместе с русскими в теории Фоменко."], "pages": [167]},
      {"id": "ethno-goty", "name": "готы", "contexts": ["Племя, упоминаемое в «Велесовой книге»."], "pages": [174]},
      {"id": "ethno-hazary", "name": "хазары", "contexts": ["Племя, упоминаемое в «Велесовой книге»."], "pages": [174]},
      {"id": "ethno-varyagi", "name": "варяги", "contexts": ["Племя, упоминаемое в «Велесовой книге»."], "pages": [174]},
      {"id": "ethno-ariev", "name": "арии", "contexts": ["Племена, фигурирующие в «Велесовой книге»."], "pages": [173]},
      {"id": "ethno-dasyu", "name": "дасью", "contexts": ["Племена, фигурирующие в «Велесовой книге»."], "pages": [173]}
    ],
    "languages": [
      {"id": "lang-latin", "name": "Латынь", "contexts": ["Язык, по Фоменко 'изобретенный' в XVII веке."], "pages": [161, 164]},
      {"id": "lang-french", "name": "Французский язык", "contexts": ["По Фоменко 'изобретен' вместе с латынью."], "pages": [161, 164]},
      {"id": "lang-german", "name": "Немецкий язык", "contexts": ["По Фоменко 'изобретен' вместе с латынью."], "pages": [161, 164]},
      {"id": "lang-spanish", "name": "Испанский язык", "contexts": ["По Фоменко 'изобретен' вместе с латынью."], "pages": [161, 164]},
      {"id": "lang-english", "name": "Английский язык", "contexts": ["По Фоменко 'изобретен' вместе с латынью."], "pages": [161, 164]},
      {"id": "lang-church-slavonic", "name": "Церковнославянский язык", "contexts": ["Язык священной традиции."], "pages": [178]},
      {"id": "lang-polish", "name": "Польский язык", "contexts": ["Элементы (полонизмы) присутствуют в «Велесовой книге»."], "pages": [180, 182, 188]},
      {"id": "lang-czech", "name": "Чешский язык", "contexts": ["Элементы (богемизмы) присутствуют в «Велесовой книге»."], "pages": [180, 188]},
      {"id": "lang-serbian", "name": "Сербский язык", "contexts": ["Элементы (сербизмы) присутствуют в «Велесовой книге»."], "pages": [180, 182, 188]}
    ],
    "lexicon": [],
    "lexicon_reverse": [],
    "lexicon_tech": [
      {"id": "tech-velesovica", "name": "Велесовица", "contexts": ["Шрифт, которым написана «Велесова книга», слегка видоизмененная кириллица."], "pages": [173]},
      {"id": "tech-polonism", "name": "Ложные полонизмы", "contexts": ["Имитация польских форм в «Велесовой книге» (замена гласной на 'ен')."], "pages": [182]},
      {"id": "tech-churchslavism", "name": "Ложные церковнославянизмы", "contexts": ["Имитация церковнославянских форм в «Велесовой книге» (замена 'ж' на 'жд')."], "pages": [182]},
      {"id": "tech-serbism", "name": "Ложные сербизмы", "contexts": ["Имитация сербских форм будущего времени в «Велесовой книге»."], "pages": [182]}
    ],
    "subject_index": [
      {"id": "subj-fomenko-critique", "name": "Критика «Новой хронологии» А. Т. Фоменко", "contexts": ["Разбор антинаучных лингвистических и исторических теорий Фоменко."], "pages": [161]},
      {"id": "subj-amateur-ling", "name": "Любительская лингвистика", "contexts": ["Анализ методов и ошибок любительской лингвистики."], "pages": [161]},
      {"id": "subj-veles-book", "name": "«Велесова книга» (ВК)", "contexts": ["Лингвистический анализ и доказательство поддельности текста."], "pages": [170]},
      {"id": "subj-truth-in-science", "name": "Истина в науке", "contexts": ["Размышления о существовании объективной истины в гуманитарных науках."], "pages": [197]}
    ],
    "glossary": [],
    "chapters": [],
    "edges": [],
    "language_edges": []
  }
}

os.makedirs('data/imports/zametki', exist_ok=True)
with open('data/imports/zametki/draft.json', 'w', encoding='utf-8') as f:
    json.dump(draft, f, ensure_ascii=False, indent=2)

print("Draft JSON generated successfully.")
