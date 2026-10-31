"""Builds public/reference.json: foods from open composition tables, bundled with the
app so they can be searched offline and copied into your own foods.

    python -I scripts/build_reference.py .cache/usda/sr.zip .cache/ciqual/xml.zip \\
        .cache/off/products.csv.gz public/reference.json

Sources:
  USDA FoodData Central SR Legacy (public domain)
    https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
  ANSES-CIQUAL 2020 (CC BY 4.0)
    https://zenodo.org/records/4770600/files/XML_2020_07_07.zip
  Open Food Facts, products sold in Greece (ODbL)
    https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv.gz
"""

import csv
import gzip
import io
import json
import re
import sys
import zipfile

# Each food: [source, id, name, group, kcal, prot, fiber, satFat, unsatFat, salt, sugar], per 100 g.
# null means the source has no value. A value is only filled in when it follows from
# another: no carbohydrate means no sugar or fiber, no fat means no fat of either kind.
FIELDS = ["kcal", "prot", "fiber", "sat", "mufa", "pufa", "unsat", "fat", "carbs", "salt", "sugar"]


def normalize(source, food_id, name, group, v):
    """v maps FIELDS to numbers or None. Returns a row, or None without kcal."""
    if v.get("kcal") is None or not name:
        return None
    none_if = lambda total: total is not None and total <= 0.5
    pick = lambda key, total: v.get(key) if v.get(key) is not None else 0.0 if none_if(total) else None
    sat = pick("sat", v.get("fat"))
    unsat = v.get("unsat")
    if unsat is None and (v.get("mufa") is not None or v.get("pufa") is not None):
        unsat = (v.get("mufa") or 0) + (v.get("pufa") or 0)
    if unsat is None and v.get("fat") is not None and sat is not None:
        unsat = max(0.0, v["fat"] - sat)
    if unsat is None and none_if(v.get("fat")):
        unsat = 0.0
    values = [v["kcal"], v.get("prot"), pick("fiber", v.get("carbs")), sat, unsat, v.get("salt"), pick("sugar", v.get("carbs"))]
    return [source, food_id, name, group, *[None if x is None else round(x, 2 if i == 5 else 1) for i, x in enumerate(values)]]


def usda(path):
    prefix = "FoodData_Central_sr_legacy_food_csv_2018-04/"
    ids = {"1008": "kcal", "1003": "prot", "1079": "fiber", "1258": "sat", "1292": "mufa", "1293": "pufa",
           "1004": "fat", "1005": "carbs", "1093": "sodium", "2000": "sugar"}
    with zipfile.ZipFile(path) as z:
        rows = lambda name: csv.DictReader(io.TextIOWrapper(z.open(prefix + name), encoding="utf-8"))
        groups = {r["id"]: r["description"] for r in rows("food_category.csv")}
        foods = {r["fdc_id"]: (r["description"], groups.get(r["food_category_id"], "")) for r in rows("food.csv")}
        values = {}
        for r in rows("food_nutrient.csv"):
            if r["nutrient_id"] in ids:
                values.setdefault(r["fdc_id"], {})[ids[r["nutrient_id"]]] = float(r["amount"])
    for fdc_id, (name, group) in foods.items():
        v = values.get(fdc_id, {})
        if "sodium" in v:
            v["salt"] = v["sodium"] * 2.5 / 1000
        yield normalize("usda", fdc_id, name, group, v)


def ciqual(path):
    """CIQUAL ships cp1252 XML; values use decimal commas, "-" for unknown, "traces" and "< x" for tiny."""
    ids = {"328": "kcal", "333": "jones", "25000": "prot", "34100": "fiber", "40302": "sat", "40303": "mufa",
           "40304": "pufa", "40000": "fat", "31000": "carbs", "10004": "salt", "32000": "sugar"}
    field = lambda tag, text: [v.strip() for v in re.findall(rf"<{tag}>(.*?)</{tag}>", text, re.S)]

    def number(text):
        return float(text.replace(",", ".")) if re.fullmatch(r"[\d,.]+", text) else None if text == "-" else 0.0

    with zipfile.ZipFile(path) as z:
        read = lambda name: z.read(next(n for n in z.namelist() if n.startswith(name))).decode("cp1252")
        groups_xml, foods_xml, compo_xml = read("alim_grp_"), read("alim_2"), read("compo_")
    groups = dict(zip(field("alim_grp_code", groups_xml), field("alim_grp_nom_eng", groups_xml)))
    foods = zip(field("alim_code", foods_xml), field("alim_nom_eng", foods_xml), field("alim_grp_code", foods_xml))
    values = {}
    for code, const, amount in zip(field("alim_code", compo_xml), field("const_code", compo_xml), field("teneur", compo_xml)):
        if const in ids:
            values.setdefault(code, {})[ids[const]] = number(amount)
    for code, name, group in foods:
        v = values.get(code, {})
        if v.get("kcal") is None:  # the Jones-factor kcal stands in for the EU-regulation one
            v["kcal"] = v.get("jones")
        yield normalize("ciqual", code, name, groups.get(group, ""), v)


def off(path):
    """Products tagged as sold in Greece. The export is tab-separated and unquoted."""
    columns = {"energy-kcal_100g": "kcal", "proteins_100g": "prot", "fiber_100g": "fiber", "saturated-fat_100g": "sat",
               "monounsaturated-fat_100g": "mufa", "polyunsaturated-fat_100g": "pufa", "unsaturated-fat_100g": "unsat",
               "fat_100g": "fat", "carbohydrates_100g": "carbs", "salt_100g": "salt", "sugars_100g": "sugar"}
    csv.field_size_limit(1 << 30)
    products = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(reader)
        at = {name: i for i, name in enumerate(header)}
        for row in reader:
            if len(row) != len(header) or "en:greece" not in row[at["countries_tags"]].split(","):
                continue
            v = {}
            for column, key in columns.items():
                try:
                    v[key] = float(row[at[column]])
                except ValueError:
                    v[key] = None
            if not 0 < (v["kcal"] or 0) <= 900 or v["prot"] is None or v["prot"] > 100:
                continue
            name = row[at["product_name"]].strip()
            brand = row[at["brands"]].split(",")[0].strip()
            label = f"{name} ({brand})" if brand and brand.lower() not in name.lower() else name
            products[row[at["code"]]] = normalize("off", row[at["code"]], label, "packaged (Greece)", v)
    return products.values()


def main(usda_zip, ciqual_zip, off_csv, out):
    foods = [food for food in (*usda(usda_zip), *ciqual(ciqual_zip), *off(off_csv)) if food]
    data = {
        "sources": {
            "usda": "USDA FoodData Central, SR Legacy 2018-04 (public domain)",
            "ciqual": "ANSES-CIQUAL French food composition table 2020 (CC BY 4.0)",
            "off": "Open Food Facts, products sold in Greece (ODbL)",
        },
        "foods": foods,
    }
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    counts = {source: sum(food[0] == source for food in foods) for source in data["sources"]}
    print(f"{len(foods)} foods {counts} -> {out}")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
