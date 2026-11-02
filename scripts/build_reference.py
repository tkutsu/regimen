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
import html
import io
import json
import math
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

# Each food starts with source, id, name, group, followed by the nutrient columns.
# Existing macro columns keep their positions; micronutrients follow sugar.
# null means the source has no value. Unsaturated fat may be estimated from total
# minus saturated fat; estimated rows are identified in the database metadata.
FIELDS = ["kcal", "prot", "fiber", "sat", "mufa", "pufa", "unsat", "fat", "carbs", "salt", "sugar"]
MACRO_UNITS = {"kcal": "kcal", "prot": "g", "fiber": "g", "satFat": "g",
               "unsatFat": "g", "salt": "g", "sugar": "g"}
MICRO_UNITS = {
    "calcium": "mg", "iron": "mg", "magnesium": "mg", "phosphorus": "mg",
    "potassium": "mg", "sodium": "mg", "zinc": "mg", "copper": "mg",
    "manganese": "mg", "selenium": "ug", "iodine": "ug", "chloride": "mg",
    "chromium": "ug", "molybdenum": "ug", "fluoride": "mg",
    "vitaminA": "ug", "vitaminARAE": "ug", "retinol": "ug", "betaCarotene": "ug",
    "vitaminD": "ug", "vitaminE": "mg", "vitaminEAlphaTocopherol": "mg",
    "vitaminK": "ug", "vitaminK1": "ug", "vitaminK2": "ug", "vitaminC": "mg",
    "vitaminB1": "mg", "vitaminB2": "mg", "vitaminB3": "mg", "vitaminB5": "mg",
    "vitaminB6": "mg", "biotin": "ug", "folate": "ug", "folicAcid": "ug",
    "folateFood": "ug", "folateDFE": "ug", "vitaminB12": "ug", "choline": "mg",
}
USDA_MICROS = {
    "1087": "calcium", "1089": "iron", "1090": "magnesium", "1091": "phosphorus",
    "1092": "potassium", "1093": "sodium", "1095": "zinc", "1098": "copper",
    "1101": "manganese", "1103": "selenium", "1100": "iodine", "1096": "chromium",
    "1099": "fluoride",
    "1106": "vitaminARAE", "1105": "retinol", "1107": "betaCarotene",
    "1114": "vitaminD", "1109": "vitaminEAlphaTocopherol", "1185": "vitaminK1",
    "1162": "vitaminC", "1165": "vitaminB1", "1166": "vitaminB2",
    "1167": "vitaminB3", "1170": "vitaminB5", "1175": "vitaminB6", "1176": "biotin",
    "1177": "folate", "1186": "folicAcid", "1187": "folateFood",
    "1190": "folateDFE", "1178": "vitaminB12", "1180": "choline",
}
CIQUAL_MICROS = {
    "10200": "calcium", "10260": "iron", "10120": "magnesium", "10150": "phosphorus",
    "10190": "potassium", "10110": "sodium", "10300": "zinc", "10290": "copper",
    "10251": "manganese", "10340": "selenium", "10530": "iodine", "10170": "chloride",
    "51200": "retinol", "51330": "betaCarotene", "52100": "vitaminD",
    "53100": "vitaminE", "54101": "vitaminK1", "54104": "vitaminK2",
    "55100": "vitaminC", "56100": "vitaminB1", "56200": "vitaminB2",
    "56310": "vitaminB3", "56400": "vitaminB5", "56500": "vitaminB6",
    "56700": "folate", "56600": "vitaminB12",
}
OFF_MICROS = {
    "calcium": "calcium", "iron": "iron", "magnesium": "magnesium", "phosphorus": "phosphorus",
    "potassium": "potassium", "sodium": "sodium", "zinc": "zinc", "copper": "copper",
    "manganese": "manganese", "selenium": "selenium", "iodine": "iodine", "chloride": "chloride",
    "chromium": "chromium", "molybdenum": "molybdenum", "fluoride": "fluoride",
    "vitamin-a": "vitaminA", "vitamin-d": "vitaminD", "vitamin-e": "vitaminE",
    "vitamin-k": "vitaminK", "vitamin-c": "vitaminC", "vitamin-b1": "vitaminB1",
    "vitamin-b2": "vitaminB2", "vitamin-pp": "vitaminB3", "pantothenic-acid": "vitaminB5",
    "vitamin-b6": "vitaminB6", "biotin": "biotin", "folates": "folate",
    "vitamin-b9": "folicAcid", "vitamin-b12": "vitaminB12",
}


def micronutrients(values):
    """Keep valid reported amounts in mg or ug; invalid or absent amounts stay unknown."""
    result = []
    for key, unit in MICRO_UNITS.items():
        value = values.get(key)
        maximum = 100_000 if unit == "mg" else 100_000_000
        result.append(round(value, 6) if value is not None and math.isfinite(value)
                      and 0 <= value <= maximum else None)
    return result


def clean_name(name):
    """Decode source markup and collapse whitespace before displaying or comparing names."""
    return " ".join(html.unescape(name).split())


def normalize(source, food_id, name, group, v, estimates=None):
    """Validate source values and preserve unknowns; return None for unusable foods."""
    name = clean_name(name)
    if v.get("kcal") is None or not name or not any(c.isalpha() for c in name) or "\ufffd" in name:
        return None
    for key in FIELDS:
        value = v.get(key)
        if value is not None and (not math.isfinite(value) or value < 0 or value > (1000 if key == "kcal" else 100)):
            return None
    fat, carbs = v.get("fat"), v.get("carbs")
    if v.get("sugar") is not None and carbs is not None and v["sugar"] > carbs + 0.5:
        return None
    known_mass = sum(v.get(k) or 0 for k in ["prot", "fat", "fiber", "sugar"])
    if known_mass > 105:
        return None
    none_if = lambda total: total == 0
    pick = lambda key, total: v.get(key) if v.get(key) is not None else 0.0 if none_if(total) else None
    sat = pick("sat", v.get("fat"))
    unsat = v.get("unsat")
    if unsat is None and v.get("mufa") is not None and v.get("pufa") is not None:
        unsat = v["mufa"] + v["pufa"]
    if unsat is None and none_if(fat):
        unsat = 0.0
    estimated = unsat is None and fat is not None and sat is not None and fat >= sat
    if estimated:
        unsat = fat - sat
    if (unsat is not None and unsat > 100) or (sat or 0) + (unsat or 0) > 100.5:
        return None
    if fat is not None and (sat or 0) + (unsat or 0) > fat + max(0.5, fat * 0.05):
        return None
    if estimated and estimates is not None:
        estimates.add(f"{source}-{food_id}")
    values = [v["kcal"], v.get("prot"), v.get("fiber"), sat, unsat, v.get("salt"), pick("sugar", v.get("carbs"))]
    return [source, food_id, name, group,
            *[None if x is None else round(x, 2 if i == 5 else 1) for i, x in enumerate(values)],
            *micronutrients(v)]


def usda(path, estimates=None):
    prefix = "FoodData_Central_sr_legacy_food_csv_2018-04/"
    ids = {"1008": "kcal", "1003": "prot", "1079": "fiber", "1258": "sat", "1292": "mufa", "1293": "pufa",
           "1004": "fat", "1005": "carbs", "2000": "sugar", **USDA_MICROS}
    with zipfile.ZipFile(path) as z:
        rows = lambda name: csv.DictReader(io.TextIOWrapper(z.open(prefix + name), encoding="utf-8"))
        groups = {r["id"]: r["description"] for r in rows("food_category.csv")}
        foods = {r["fdc_id"]: (r["description"], groups.get(r["food_category_id"], "")) for r in rows("food.csv")}
        values = {}
        for r in rows("food_nutrient.csv"):
            if r["nutrient_id"] in ids:
                key = ids[r["nutrient_id"]]
                # USDA reports fluoride in ug; our fluoride column uses mg.
                amount = float(r["amount"]) / (1000 if key == "fluoride" else 1)
                values.setdefault(r["fdc_id"], {})[key] = amount
    for fdc_id, (name, group) in foods.items():
        v = values.get(fdc_id, {})
        if "sodium" in v:
            v["salt"] = v["sodium"] * 2.5 / 1000
        yield normalize("usda", fdc_id, name, group, v, estimates)


def ciqual(path, estimates=None):
    """Read CIQUAL's cp1252 XML; bounds and traces have no exact value."""
    ids = {"328": "kcal", "333": "jones", "25000": "prot", "34100": "fiber", "40302": "sat", "40303": "mufa",
           "40304": "pufa", "40000": "fat", "31000": "carbs", "10004": "salt", "32000": "sugar",
           **CIQUAL_MICROS}
    field = lambda tag, text: [v.strip() for v in re.findall(rf"<{tag}>(.*?)</{tag}>", text, re.S)]

    def number(text):
        return float(text.replace(",", ".")) if re.fullmatch(r"\d+(?:,\d+)?", text) else None

    with zipfile.ZipFile(path) as z:
        read = lambda name: z.read(next(n for n in z.namelist() if n.startswith(name))).decode("cp1252")
        groups_xml, foods_xml, compo_xml = read("alim_grp_"), read("alim_2"), read("compo_")
    groups = dict(zip(field("alim_grp_code", groups_xml), field("alim_grp_nom_eng", groups_xml)))
    foods = zip(field("alim_code", foods_xml), field("alim_nom_eng", foods_xml),
                field("alim_nom_fr", foods_xml), field("alim_grp_code", foods_xml))
    values = {}
    for code, const, amount in zip(field("alim_code", compo_xml), field("const_code", compo_xml), field("teneur", compo_xml)):
        if const in ids:
            values.setdefault(code, {})[ids[const]] = number(amount)
    for code, name, french_name, group in foods:
        if name.count("(") != name.count(")") and french_name.count("(") == french_name.count(")"):
            name = french_name
        v = values.get(code, {})
        if v.get("kcal") is None:  # the Jones-factor kcal stands in for the EU-regulation one
            v["kcal"] = v.get("jones")
        yield normalize("ciqual", code, name, groups.get(group, ""), v, estimates)


def off(path, estimates=None):
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
            errors = row[at["data_quality_errors_tags"]].split(",")
            if any(tag.startswith(("en:nutrition-", "en:energy-")) for tag in errors):
                continue
            v = {}
            for column, key in columns.items():
                try:
                    v[key] = float(row[at[column]])
                except ValueError:
                    v[key] = None
            # OFF's normalized _100g columns use grams, including vitamins and minerals.
            for nutrient, key in OFF_MICROS.items():
                column = nutrient + "_100g"
                try:
                    v[key] = float(row[at[column]]) * (1000 if MICRO_UNITS[key] == "mg" else 1_000_000)
                except (KeyError, ValueError):
                    v[key] = None
            if not 0 < (v["kcal"] or 0) <= 900 or v["prot"] is None or v["prot"] > 100:
                continue
            try:
                kj = float(row[at["energy-kj_100g"]])
            except ValueError:
                kj = None
            if kj is not None and (not math.isfinite(kj) or kj < 0 or abs(kj / 4.184 - v["kcal"]) > max(20, v["kcal"] * 0.1)):
                continue
            minimum_kcal = 4 * v["prot"] + 9 * (v["fat"] or 0) + 4 * (v["sugar"] or 0)
            if minimum_kcal - v["kcal"] > max(20, v["kcal"] * 0.1):
                continue
            name = clean_name(row[at["product_name"]])
            brand = clean_name(row[at["brands"]].split(",")[0])
            # Short numeric product names (Lindt 85%, Yam Tales 03) are legitimate; barcodes are not.
            usable = lambda text: bool(text) and "\ufffd" not in text and (
                any(c.isalpha() for c in text) or bool(brand and re.fullmatch(r"\d{1,3}(?:[.,]\d+)?%?", text)))
            if not usable(name):
                name = clean_name(row[at["generic_name"]])
            if not usable(name):
                continue
            label = f"{name} ({brand})" if brand and brand.lower() not in name.lower() else name
            products[row[at["code"]]] = normalize("off", row[at["code"]], label, "packaged (Greece)", v, estimates)
    return products.values()


def words(text):
    """Match spelling, accents and punctuation without changing displayed names."""
    text = unicodedata.normalize("NFD", text.casefold()).replace("ς", "σ")
    return re.findall(r"[^\W_]+", "".join(c for c in text if not unicodedata.combining(c)))


def clean_keywords(name, keywords, packaged=False):
    """Keep alternate search terms, omitting repeated title words and translated brands."""
    title = set(words(name))
    result, seen = [], set()
    for keyword in keywords:
        if packaged:
            # OFF appends a brand in parentheses; its machine translation is not a food.
            keyword = re.sub(r"\([^()]*\)\s*$", "", keyword).strip()
        keyword = re.sub(r"Δωρεάν Mp3 Download", "", keyword, flags=re.I)
        tokens = re.findall(r"[^\W_]+(?:[.,]\d+)?%?", keyword, re.UNICODE)
        if set(words(keyword)) <= title:
            continue
        kept = [token for token in tokens
                if not (re.search(r"[a-zA-Z]", token) and set(words(token)) <= title)]
        if not any(any(c.isalpha() for c in token) for token in kept):
            continue
        value = " ".join(kept)
        key = tuple(words(value))
        if key and key not in seen:
            seen.add(key)
            result.append(value)
    return result


def close_nutrients(left, right):
    """Allow rounding differences across every reported nutrient, never unknown versus zero."""
    if len(left) != len(right):
        return False
    for i, (a, b) in enumerate(zip(left[4:], right[4:])):
        if a is None or b is None:
            if a != b:
                return False
        else:
            absolute = 2 if i == 0 else .02 if i == 5 else .2 if i < 7 else .001
            relative = .01 if i == 0 else .02
            if abs(a - b) > max(absolute, max(abs(a), abs(b)) * relative) + 1e-9:
                return False
    return True


def deduplicate(foods):
    """Collapse equivalent names per source when all reported nutrients agree closely."""
    unique, kept = {}, []
    for food in foods:
        key = (food[0], tuple(words(clean_name(food[2]))), food[3])
        peers = unique.setdefault(key, [])
        if not any(close_nutrients(food, peer) for peer in peers):
            peers.append(food)
            kept.append(food)
    return kept


def curate(foods, corrections):
    """Apply reviewed product exclusions, names and equivalent-food merges on rebuild."""
    excluded = set(corrections.get("excludeNames", []))
    names = corrections.get("names", {})
    rows = {}
    for food in foods:
        if food[0] == "off" and (re.search(r"[\u0400-\u052f]", food[2]) or food[2] in excluded):
            continue
        key = f"{food[0]}-{food[1]}"
        row = food[:]
        row[2] = names.get(key, row[2])
        rows[key] = row
    for removed, canonical in corrections.get("duplicates", {}).items():
        if removed not in rows:
            continue
        if canonical not in rows or not close_nutrients(rows[removed], rows[canonical]):
            raise ValueError(f"Reviewed duplicate no longer matches: {removed} -> {canonical}")
        del rows[removed]
    return deduplicate(rows.values())


def main(usda_zip, ciqual_zip, off_csv, out):
    estimates = set()
    corrections = json.loads(Path(__file__).with_name("food_cleanup.json").read_text())
    # Collapse exact source-export copies first, so a reviewed removal cannot uncover one.
    source_rows = {}
    for food in (*usda(usda_zip, estimates), *ciqual(ciqual_zip, estimates), *off(off_csv, estimates)):
        if food:
            source_rows.setdefault((food[0], clean_name(food[2]).casefold(), *food[3:]), food)
    foods = curate(source_rows.values(), corrections)
    kept_ids = {f"{food[0]}-{food[1]}" for food in foods}
    aliases = json.loads(Path(__file__).with_name("food_keywords.el.json").read_text())
    translations = aliases["foods"]
    data = {
        "sources": {
            "usda": "USDA FoodData Central, SR Legacy 2018-04 (public domain)",
            "ciqual": "ANSES-CIQUAL French food composition table 2020 (CC BY 4.0)",
            "off": "Open Food Facts, products sold in Greece (ODbL)",
        },
        "nutrients": [{"key": key, "unit": unit} for key, unit in {**MACRO_UNITS, **MICRO_UNITS}.items()],
        "estimatedUnsatFat": sorted(estimates & kept_ids),
        "keywords": reference_keywords(foods, translations),
        "namesToReview": [f"{row[0]}-{row[1]}" for row in foods if row[2] not in translations or row[2] in aliases.get("review", {})],
        "foods": foods,
    }
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    counts = {source: sum(food[0] == source for food in foods) for source in data["sources"]}
    print(f"{len(foods)} foods {counts} -> {out}")


def reference_keywords(foods, translations):
    """Attach alternate Greek search terms without repeating words in the displayed name."""
    return {f"{row[0]}-{row[1]}": cleaned for row in foods
            if (cleaned := clean_keywords(row[2], translations.get(row[2], []), row[0] == "off"))}


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
