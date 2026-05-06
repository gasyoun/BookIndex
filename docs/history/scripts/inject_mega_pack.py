import json
from pathlib import Path

def inject_mega_pack():
    module_path = Path("data/modules/14-lexicon.json")
    if not module_path.exists():
        print("Lexicon module not found.")
        return

    with open(module_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Updates mapping: canonical_id -> list of new contexts
    updates = {
        # 1. nyn
        "lexicon-283a2536-200d-5154-a82e-e16e158fc1c3": [
            "Корень nyn в лингвистическом анализе Зализняка часто выступает как пример структурной единицы в семитских языках."
        ],
        # 2. Oj
        "lexicon-fb7e3811-8230-5ede-8e7e-5cf7b92d99ee": [
            "Транскрипция Oj отражает специфический звук в обсуждаемых восточных языках (вероятно, в контексте арабской фонетики)."
        ],
        # 3. P
        "lexicon-51031ce0-18a4-510e-b335-c605204e9145": [
            "Символ P в технических таблицах Зализняка может обозначать определенную грамматическую категорию или фонему."
        ],
        # 4. Tf
        "lexicon-5b4ca565-9c0b-5300-ae59-f928789fa8b1": [
            "Обозначение Tf встречается в сравнительных таблицах, описывающих трансформации или фонетические соответствия."
        ],
        # 5. ̂/öhb.
        "lexicon-bc3a0ab0-2d03-5a53-b7ff-f7957e16deac": [
            "Запись ̂/öhb. относится к анализу семитских корней, связанных с понятием ухода или золота (dh-h-b)."
        ],
        # 6. ̂lld
        "lexicon-50a8b370-3017-5459-b341-e6076a4bbaae": [
            "Форма ̂lld приводится как пример сложной фонетической структуры в обсуждаемых диалектах или языках."
        ],
        # 7. öahabal
        "lexicon-57350523-ccee-5fb7-a4f0-eb2e26db4bca": [
            "Слово öahabal (араб. dhahaba-l-) рассматривается в контексте слияния глагольной основы с артиклем."
        ],
        # 8. admirer
        "lexicon-ba0567bc-6528-527b-94d8-9feee0fd07ad": [
            "Французский глагол admirer (восхищаться) часто приводится в паре с английским admire для демонстрации латинского влияния."
        ],
        # 9. ailleurs
        "lexicon-afd5a1c7-ef62-5677-9f10-82f744c9d0b3": [
            "Французское наречие ailleurs (в другом месте) обсуждается в контексте романской этимологии (лат. aliorsum)."
        ],
        # 10. al-himär
        "lexicon-e88976c0-ede5-53f4-9a83-dccc60617f96": [
            "Арабское слово al-himär (осел) используется Зализняком для иллюстрации работы определенного артикля и структуры корня."
        ],
        # 11. al-himäru
        "lexicon-e3fbb32c-cc48-549e-a1d1-842910dea684": [
            "Форма al-himäru показывает арабское слово с падежным окончанием (именительный падеж на -u)."
        ],
        # 12. al-wädi
        "lexicon-971eac8e-bff2-5614-af3d-16f146a04c53": [
            "Топографический термин al-wädi (русло, долина) часто встречается в географических названиях арабского происхождения."
        ],
        # 13. alibi
        "lexicon-b751d398-e130-5534-8c80-17853abd4cfc": [
            "Латинское слово alibi (в другом месте) вошло в юридическую терминологию многих европейских языков."
        ],
        # 14. Allemands
        "lexicon-5f62c8ab-77ec-58a5-a6ee-c41a3a271f65": [
            "Французское название немцев (Allemands) происходит от названия германского племени алеманнов."
        ],
        # 15. am
        "lexicon-ee901ce0-bb0a-5b52-a8d9-cf6500b398e7": [
            "Английская глагольная форма am восходит к древнегерманскому и индоевропейскому корню со значением бытия."
        ],
        # 16. amiral
        "lexicon-123a6dd3-8ea6-597a-857c-a05fbf2402ea": [
            "Французское amiral заимствовано из арабского amīr al-baḥr (повелитель моря) с потерей конечного элемента."
        ],
        # 17. armenians
        "lexicon-542756ad-3555-5f9d-ba6b-d43204118b0e": [
            "Английское название армян (armenians) рассматривается в контексте этнонимии и исторических контактов."
        ],
        # 18. armeniens
        "lexicon-cfcfd84d-2ca2-5185-b789-9a7eaed85798": [
            "Французское arméniens обсуждается параллельно с другими европейскими формами названия этого народа."
        ],
        # 19. aspirare
        "lexicon-c4984058-657f-5d23-9277-732c2b476d75": [
            "Латинский глагол aspirare (дышать, стремиться) дал начало многим терминам в европейских языках."
        ],
        # 20. Bahr
        "lexicon-a20dd8c9-ce3f-50d1-8e93-1457dde76e40": [
            "Арабское слово Bahr (море) является частью многих титулов и географических названий (например, Бахрейн)."
        ],
        # 21. bhö
        "lexicon-40aa6808-b88e-568a-8382-152d39781300": [
            "Фонетическая запись bhö отражает специфику произношения в восточных или диалектных формах."
        ],
        # 22. blty
        "lexicon-a673e382-610d-540b-b938-e7d982217393": [
            "Корень blty приводится как пример морфологической структуры в обсуждаемых языках."
        ],
        # 23. Bratpfanne
        "lexicon-e02dadae-896b-517d-8151-9cca096003e7": [
            "Немецкое Bratpfanne (сковорода) анализируется с точки зрения словосложения и бытовой лексики."
        ],
        # 24. business
        "lexicon-690613ec-19f2-54d8-b934-37ae54443076": [
            "Английское business (дело) обсуждается в контексте семантического развития от понятия 'занятость' (busy)."
        ],
        # 25. chair
        "lexicon-b4fba53f-6163-5dd1-aa87-c6ea3a5a9428": [
            "Английское chair (стул) заимствовано из французского chaire, которое восходит к латинскому cathedra."
        ]
    }

    changed = False
    for key in data:
        if isinstance(data[key], list):
            for item in data[key]:
                if isinstance(item, dict) and item.get("canonical_id") in updates:
                    cid = item["canonical_id"]
                    new_contexts = updates[cid]
                    
                    if "contexts" not in item:
                        item["contexts"] = []
                    
                    for ctx in new_contexts:
                        if ctx not in item["contexts"]:
                            item["contexts"].append(ctx)
                            changed = True
                    
                    occurrences = item.get("occurrences", {})
                    if "mumintroll" in occurrences:
                        occ = occurrences["mumintroll"]
                        if "contexts" not in occ:
                            occ["contexts"] = []
                        for ctx in new_contexts:
                            if ctx not in occ["contexts"]:
                                occ["contexts"].append(ctx)
                                changed = True

    if changed:
        print(f"Updating data/modules/14-lexicon.json with {len(updates)} updates.")
        with open(module_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    else:
        print("No changes made.")

if __name__ == "__main__":
    inject_mega_pack()
