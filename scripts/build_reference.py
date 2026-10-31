"""Builds public/reference.json: generic foods from open composition tables, bundled
with the app so they can be searched offline and copied into your own foods.

    python -I scripts/build_reference.py .cache/usda/sr.zip .cache/ciqual/xml.zip public/reference.json

Sources:
  USDA FoodData Central SR Legacy (public domain)
    https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
  ANSES-CIQUAL 2020 (CC BY 4.0)
    https://zenodo.org/records/4770600/files/XML_2020_07_07.zip
"""

import csv
import io
import json
import re
import sys
import zipfile

# Each food: [source, id, name, group, kcal, prot, fiber, satFat, unsatFat, salt], per 100 g.


def usda(path):
    prefix = "FoodData_Central_sr_legacy_food_csv_2018-04/"
    nutrients = {"1008": 0, "1003": 1, "1079": 2, "1258": 3, "1292": 4, "1293": 5, "1093": 6}
    with zipfile.ZipFile(path) as z:
        rows = lambda name: csv.DictReader(io.TextIOWrapper(z.open(prefix + name), encoding="utf-8"))
        groups = {r["id"]: r["description"] for r in rows("food_category.csv")}
        foods = {r["fdc_id"]: (r["description"], groups.get(r["food_category_id"], "")) for r in rows("food.csv")}
        values = {}
        for r in rows("food_nutrient.csv"):
            slot = nutrients.get(r["nutrient_id"])
            if slot is not None:
                values.setdefault(r["fdc_id"], [None] * 7)[slot] = float(r["amount"])
    for fdc_id, (name, group) in foods.items():
        kcal, prot, fiber, sat, mufa, pufa, sodium = values.get(fdc_id, [None] * 7)
        if kcal is None:
            continue
        unsat = (mufa or 0) + (pufa or 0)
        yield ["usda", fdc_id, name, group, kcal, prot or 0, fiber or 0, sat or 0, unsat, (sodium or 0) * 2.5 / 1000]


def ciqual(path):
    """CIQUAL ships cp1252 XML; values use decimal commas, "-" for unknown, "traces" and "< x" for tiny."""
    # 333 (Jones-factor kcal) stands in when the EU-regulation kcal (328) is missing.
    nutrients = {"328": 0, "25000": 1, "34100": 2, "40302": 3, "40303": 4, "40304": 5, "10004": 6, "333": 7}
    field = lambda tag, text: [v.strip() for v in re.findall(rf"<{tag}>(.*?)</{tag}>", text, re.S)]

    def number(text):
        return float(text.replace(",", ".")) if re.fullmatch(r"[\d,.]+", text) else 0.0 if text != "-" else None

    with zipfile.ZipFile(path) as z:
        read = lambda name: z.read(next(n for n in z.namelist() if n.startswith(name))).decode("cp1252")
        groups_xml, foods_xml, compo_xml = read("alim_grp_"), read("alim_2"), read("compo_")
    groups = dict(zip(field("alim_grp_code", groups_xml), field("alim_grp_nom_eng", groups_xml)))
    foods = list(zip(field("alim_code", foods_xml), field("alim_nom_eng", foods_xml), field("alim_grp_code", foods_xml)))
    values = {}
    for code, const, amount in zip(field("alim_code", compo_xml), field("const_code", compo_xml), field("teneur", compo_xml)):
        slot = nutrients.get(const)
        if slot is not None:
            values.setdefault(code, [None] * 8)[slot] = number(amount)
    for code, name, group in foods:
        kcal, prot, fiber, sat, mufa, pufa, salt, jones = values.get(code, [None] * 8)
        kcal = kcal if kcal is not None else jones
        if kcal is None:
            continue
        unsat = (mufa or 0) + (pufa or 0)
        yield ["ciqual", code, name, groups.get(group, ""), kcal, prot or 0, fiber or 0, sat or 0, unsat, salt or 0]


def main(usda_zip, ciqual_zip, out):
    foods = [*usda(usda_zip), *ciqual(ciqual_zip)]
    for food in foods:
        food[4:] = [round(v, 2 if i == 5 else 1) for i, v in enumerate(food[4:])]
    data = {
        "sources": {
            "usda": "USDA FoodData Central, SR Legacy 2018-04 (public domain)",
            "ciqual": "ANSES-CIQUAL French food composition table 2020 (CC BY 4.0)",
        },
        "foods": foods,
    }
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(foods)} foods -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
