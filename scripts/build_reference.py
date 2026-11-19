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
import hashlib
import html
import io
import itertools
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
# Open Food Facts amounts above these per 100 g are unit slips, even in fortified foods.
# The composition tables keep their real extremes, such as iodine in dried seaweed.
OFF_MICRO_LIMITS = {
    "calcium": 3000, "iron": 100, "magnesium": 1500, "phosphorus": 3000, "potassium": 10000,
    "zinc": 100, "copper": 30, "manganese": 100, "selenium": 2000, "iodine": 5000,
    "vitaminA": 30000, "vitaminD": 100, "vitaminE": 200, "vitaminK": 2000, "vitaminC": 3000,
    "vitaminB1": 30, "vitaminB2": 30, "vitaminB3": 200, "vitaminB5": 100, "vitaminB6": 30,
    "biotin": 500, "folate": 3000, "folicAcid": 3000, "vitaminB12": 200,
}
# On a label, fat this far above saturated + mono + poly means those columns can't be right.
# Composition tables measure them, and their fat can include more than fatty acids.
FATTY_ACID_GAP, FATTY_ACID_SHARE = 2, .25
# Foods of one type may merge when each macro is within this share or the absolute amount,
# whichever is larger: labels round small amounts, so a percentage alone would split them.
SAME_TYPE_SHARE = .1
SAME_TYPE_FLOORS = {"kcal": 15, "prot": 1, "fiber": 1, "satFat": 1, "unsatFat": 1, "salt": .2, "sugar": 1.5}


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
        if source == "off" and fat and sat is not None:
            if sat == 0 and unsat == 0 and fat >= 1:
                sat = unsat = None  # Every fatty acid is a placeholder zero.
            elif fat - sat - unsat > max(FATTY_ACID_GAP, fat * FATTY_ACID_SHARE):
                unsat = None  # Placeholder or wrong-unit fatty acids: estimate from the total below.
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


def off(path, estimates=None, identities=None, display_brands=None, nutrition_identities=None):
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
                if v[key] is not None and v[key] > OFF_MICRO_LIMITS.get(key, math.inf):
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
            if display_brands is not None:
                display_brands[f"off-{row[at['code']]}"] = brand
            if identities is not None:
                identities[f"off-{row[at['code']]}"] = row_fingerprint([
                    row[at[field]] if field in at else "" for field in
                    ["product_name", "generic_name", "brands", "quantity", "ingredients_text"]])
            if nutrition_identities is not None:
                nutrition_identities[f"off-{row[at['code']]}"] = row_fingerprint([
                    [field, row[at[field]]] for field in sorted(at) if field.endswith("_100g")])
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


def close_nutrients(left, right, compatible=False):
    """Compare reported values; reviewed merges may retain extra known micronutrients."""
    if len(left) != len(right):
        return False
    for i, (a, b) in enumerate(zip(left[4:], right[4:])):
        if a is None or b is None:
            if a != b and not (compatible and i >= 7 and a is None):
                return False
        else:
            absolute = 2 if i == 0 else .02 if i == 5 else .2 if i < 7 else .001
            if compatible and i == len(MACRO_UNITS) + list(MICRO_UNITS).index("sodium"):
                absolute = 1  # One mg sodium can round to the same displayed salt value.
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


def same_type(row, canonical):
    """Whether a food can share a type's row: every macro both report is close enough."""
    for i, (key, floor) in enumerate(SAME_TYPE_FLOORS.items()):
        a, b = row[4 + i], canonical[4 + i]
        if a is not None and b is not None and abs(a - b) > max(floor, max(a, b) * SAME_TYPE_SHARE) + 1e-9:
            return False
    return True


def row_fingerprint(row):
    """Hash a normalized food row or source identity fields for a guarded review."""
    return hashlib.sha256(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def merge_profiles(rows, merges, product_identities, nutrition_identities):
    """Keep reviewed whole profiles only when every pair satisfies the nutrient limit."""
    for merge in merges:
        canonical, expected = merge["canonical"], merge["expectedRows"]
        if not any(key != canonical and key in rows for key in expected):
            continue
        if canonical not in expected or any(
                key not in rows or row_fingerprint(rows[key]) != fingerprint
                for key, fingerprint in expected.items()):
            raise ValueError(f"Reviewed profile no longer matches: {canonical}")
        for identities, field in [(product_identities, "expectedProducts"),
                                  (nutrition_identities, "expectedNutrition")]:
            if any((identities or {}).get(key) != fingerprint
                   for key, fingerprint in merge.get(field, {}).items()):
                raise ValueError(f"Reviewed source profile no longer matches: {canonical} {field}")
        for left, right in itertools.combinations(expected, 2):
            a, b = rows[left][4:], rows[right][4:]
            if len(a) != len(b) or any(
                    x != y if x is None or y is None else
                    abs(x - y) > min(x, y) * merge["maxRelativeDifference"] + 1e-9
                    for x, y in zip(a, b)):
                raise ValueError(f"Reviewed profile exceeds nutrient limit: {left} -> {right}")
        for key in expected:
            if key != canonical:
                del rows[key]


def curate(foods, corrections, product_identities=None, nutrition_identities=None):
    """Apply reviewed product exclusions, names and equivalent-food merges on rebuild."""
    excluded = set(corrections.get("excludeNames", []))
    names = corrections.get("names", {})
    rows, excluded_after_merges = {}, set()
    for food in foods:
        if food[0] == "off" and (re.search(r"[\u0400-\u052f]", food[2]) or food[2] in excluded):
            continue
        key = f"{food[0]}-{food[1]}"
        exclusion = corrections.get("excludeFoods", {}).get(key)
        if exclusion:
            if food[2] != exclusion["expectedName"]:
                raise ValueError(f"Reviewed exclusion no longer matches: {key}")
            if not exclusion.get("afterMerges"):
                continue
            excluded_after_merges.add(key)
        row = food[:]
        row[2] = names.get(key, row[2])
        for nutrient, change in corrections.get("nutrients", {}).get(key, {}).items():
            column = 4 + list({**MACRO_UNITS, **MICRO_UNITS}).index(nutrient)
            if row[column] not in (change["from"], change["to"]):
                raise ValueError(f"Reviewed nutrient no longer matches: {key} {nutrient}")
            if row[column] == change["from"] and change.get("expectedRow") \
                    and row_fingerprint(row) != change["expectedRow"]:
                raise ValueError(f"Reviewed nutrient profile no longer matches: {key} {nutrient}")
            row[column] = change["to"]
        rows[key] = row
    for removed, canonical in corrections.get("duplicates", {}).items():
        if removed not in rows:
            continue
        if canonical not in rows or not close_nutrients(rows[removed], rows[canonical]):
            raise ValueError(f"Reviewed duplicate no longer matches: {removed} -> {canonical}")
        del rows[removed]
    for removed, canonical in corrections.get("compatibleDuplicates", {}).items():
        if removed not in rows:
            continue
        if canonical not in rows or not close_nutrients(rows[removed], rows[canonical], compatible=True):
            raise ValueError(f"Reviewed duplicate no longer matches: {removed} -> {canonical}")
        del rows[removed]
    # Collapse automatic equivalents before a reviewed removal can uncover one.
    rows = {f"{row[0]}-{row[1]}": row for row in deduplicate(rows.values())}
    for merge in corrections.get("identityDuplicates", []):
        canonical, expected = merge["canonical"], merge["expectedRows"]
        if not any(key != canonical and key in rows for key in expected):
            continue
        if canonical not in expected or canonical not in rows or any(
                key not in rows or row_fingerprint(rows[key]) != fingerprint
                for key, fingerprint in expected.items()):
            raise ValueError(f"Reviewed food identity no longer matches: {canonical}")
        if any((product_identities or {}).get(key) != fingerprint
               for key, fingerprint in merge.get("expectedProducts", {}).items()):
            raise ValueError(f"Reviewed product identity no longer matches: {canonical}")
        for key in expected:
            if key != canonical:
                del rows[key]
    # The nutrients themselves are the guard here: a member that drifts stops the rebuild.
    for generic in corrections.get("generics", []):
        kept = rows.get(generic["canonical"])
        members = [key for key in generic["members"] if key in rows]
        if members and kept is None:
            raise ValueError(f"Reviewed generic no longer matches: {generic['canonical']}")
        for key in members:
            if not same_type(rows[key], kept):
                raise ValueError(f"Reviewed generic no longer matches: {key} -> {generic['canonical']}")
            del rows[key]
        if kept is not None and generic.get("name"):
            kept[2] = generic["name"]
    merge_profiles(rows, corrections.get("profileDuplicates", []), product_identities, nutrition_identities)
    return [row for key, row in drop_unused(rows, corrections).items() if key not in excluded_after_merges]


def drop_unused(rows, corrections):
    """Cut food groups not eaten here and salted twins of unsalted foods.

    This runs after the merges because a retained row can sit in a cut group.
    """
    groups = corrections.get("dropGroups", {})
    kept = {*corrections.get("keepFoods", []),
            *(merge["canonical"] for merge in corrections.get("identityDuplicates", [])),
            *(merge["canonical"] for merge in corrections.get("profileDuplicates", [])),
            *(generic["canonical"] for generic in corrections.get("generics", []))}
    names = {row[2].casefold() for row in rows.values()}

    def unused(key, row):
        name = row[2].casefold()
        return key not in kept and (row[3] in groups.get(row[0], ()) or (
            "with salt" in name and name.replace("with salt", "without salt") in names))

    return {key: row for key, row in rows.items() if not unused(key, row)}


def normalize_title(name, source, brand=""):
    """Use sentence case and order whole qualifiers, preserving brands and food identity."""
    name = clean_name(name)
    # Protect actual brand spellings, parenthesized product brands, proper names and acronyms.
    protected = {}

    def protect(match):
        token = f"\ue000{len(protected)}\ue001"
        protected[token] = match.group()
        return token

    if source == "off":
        name = re.sub(r"\([^()]*\)$", protect, name)
    if brand:
        name = re.sub(re.escape(brand), protect, name, flags=re.I)
    name = re.sub(r"\([A-Z][a-z]+ [a-z]+(?: [a-z]+)?\)", protect, name)
    name = re.sub(r"\b(?:New Zealand|Grana Padano|Brie de Meaux|Brie de Melun|"
                  r"Atlantic|Pacific|Alaska|Greenland|Mediterranean|Greek|French|Italian|"
                  r"English|American|Canadian|Australian|Chinese|Japanese|Indian|Thai|"
                  r"Dijon|Camembert|Roquefort|Comté|Emmental|Gouda|Edam|Savoy|"
                  r"Μυτιλήνης|Καλαμών|Θεσσαλονίκης|Κρήτης|Αιγίνης|Ελλάδας|Ελλάδος|"
                  r"Ιμαλαΐων|Δράμας|Καστοριάς|Σερρών|Νάξου|"
                  r"USDA|USA|UHT|PDO|DOP|BBQ|ISO|BCAA|DHA|EPA|B12|B6|XL|XXL|"
                  r"Aplodinotus grunniens)\b", protect, name, flags=re.I)
    accents = dict(pair.split(":") for pair in (
        "γαλα:γάλα γιαουρτι:γιαούρτι τυρι:τυρί ψωμι:ψωμί ρυζι:ρύζι καφε:καφέ καφες:καφές "
        "βρωμη:βρώμη βρωμης:βρώμης μελι:μέλι μελιου:μελιού ζαχαρη:ζάχαρη ζαχαρης:ζάχαρης "
        "σοκολατα:σοκολάτα σοκολατας:σοκολάτας φυστικοβουτυρο:φυστικοβούτυρο φιστικοβουτυρο:φιστικοβούτυρο "
        "βουτυρο:βούτυρο καρυδοψιχα:καρυδόψιχα αλατι:αλάτι τονος:τόνος χυμος:χυμός "
        "καλαμποκι:καλαμπόκι κοτοπουλο:κοτόπουλο κατσικισιο:κατσικίσιο αγελαδινο:αγελαδινό "
        "στραγγιστο:στραγγιστό στραγγιστό:στραγγιστό ελαφρυ:ελαφρύ γευση:γεύση γαλακτος:γάλακτος "
        "σαλτσα:σάλτσα ντοματα:ντομάτα ντοματας:ντομάτας λαδερα:λαδερά πιτα:πίτα πιτες:πίτες "
        "ολικης:ολικής αλεσης:άλεσης αλεσεως:αλέσεως χωρις:χωρίς λιπαρα:λιπαρά "
        "επιδoρπιο:επιδόρπιο επιδορπιο:επιδόρπιο γλυκο:γλυκό γλυκια:γλυκιά κρεμα:κρέμα "
        "κρεμας:κρέμας μπαρα:μπάρα μπαρες:μπάρες μπανανa:μπανάνα μπανανα:μπανάνα "
        "φραουλα:φράουλα φραουλας:φράουλας αμυγδαλα:αμύγδαλα φουντουκι:φουντούκι "
        "καρυδα:καρύδα καρυδας:καρύδας πρωτεινη:πρωτεΐνη πρωτεινης:πρωτεΐνης "
        "ψημενο:ψημένο ψημενα:ψημένα αλατισμενα:αλατισμένα αναλατα:ανάλατα κανελα:κανέλα"
    ).split())
    name = re.sub(r"\b[^\W\d_]+(?:[-'][^\W\d_]+)*\b", lambda m: (
        m.group() if m.group() in {"A", "B", "C", "D", "E", "K"}
        or (source != "off" and m.group().isupper() and len(m.group()) > 1)
        or (any(c.islower() for c in m.group()[1:]) and any(c.isupper() for c in m.group()[1:]))
        else accents.get(m.group().lower(), m.group().lower())), name)
    for token, value in protected.items():
        name = name.replace(token, value)
    name = re.sub(r"(?<=\d),(?=\d+\s*%)", ".", name)
    name = re.sub(r"\s+%", "%", name)
    # Percentages in dairy titles describe fat; percentages in chocolate, fruit, etc. do not.
    if source == "off":
        name = re.sub(r"^(\d+(?:\.\d+)?%) lactose free (yogurt|yoghurt|milk)\b",
                      r"\2, \1 fat, lactose free", name, flags=re.I)
        name = re.sub(r"^(\d+(?:\.\d+)?%) (?:fat )?((?:Greek |cow |strained )?(?:milk|yogurt|yoghurt))\b",
                      r"\2, \1 fat", name, flags=re.I)
    parts, start, depth = [], 0, 0
    for i, char in enumerate(name):
        depth += (char == "(") - (char == ")")
        if char == "," and depth == 0 and not (i > 0 and i + 1 < len(name)
                                               and name[i - 1].isdigit() and name[i + 1].isdigit()):
            parts.append(name[start:i].strip())
            start = i + 1
    parts.append(name[start:].strip())
    fat_names = {"lowfat": "low fat", "low-fat": "low fat", "fat-free": "fat free",
                 "nonfat": "fat free", "nonfat or fat free": "fat free", "2%fat": "2% fat"}
    parts = [fat_names.get(part, part) for part in parts]

    def rank(part):
        if re.fullmatch(r"(?:(?:around|approximately) )?\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?% (?:milk)?fat|"
                        r"\d+% lean(?: meat)? / \d+% fat|"
                        r"(?:low|reduced|full|without) fat|fat free|(?:separable )?lean (?:only|and fat)", part):
            return 1
        if re.fullmatch(r"(?:(?:fast|slow|dry|oil) )?(?:raw|uncooked|unprepared|cooked|cooked-roasted|boiled|roasted|baked|"
                        r"grilled|fried|steamed|braised|stewed|sauteed|sautéed|pan-fried|pan fried|"
                        r"stir-fried|simmered|poached|pan-broiled|broiled|dry heat|moist heat|roasted/baked|grilled/pan-fried|"
                        r"boiled/cooked in water)(?: \([^()]*\))?", part):
            return 2
        if re.fullmatch(r"(?:with(?:out)? salt(?: added)?|no salt added|unsalted|salted|drained|"
                        r"drained solids|solids and liquids|solids and liquid)", part):
            return 3
        return 0

    # Packaged names often contain comma-separated marketing text; retain their original order.
    if source != "off" and len(parts) > 1:
        parts = [parts[0], *sorted(parts[1:], key=rank)]
    name = ", ".join(parts)
    # Uppercase the first letter only, even when a title starts with a percentage or numeral.
    return re.sub(r"[^\W\d_]", lambda m: m.group().upper(), name, count=1)


def main(usda_zip, ciqual_zip, off_csv, out):
    estimates = set()
    product_identities = {}
    nutrition_identities = {}
    display_brands = {}
    corrections = json.loads(Path(__file__).with_name("food_cleanup.json").read_text())
    # Collapse exact source-export copies first, so a reviewed removal cannot uncover one.
    source_rows = {}
    for food in (*usda(usda_zip, estimates), *ciqual(ciqual_zip, estimates),
                 *off(off_csv, estimates, product_identities, display_brands, nutrition_identities)):
        if food:
            source_rows.setdefault((food[0], clean_name(food[2]).casefold(), *food[3:]), food)
    foods = curate(source_rows.values(), corrections, product_identities, nutrition_identities)
    kept_ids = {f"{food[0]}-{food[1]}" for food in foods}
    aliases = json.loads(Path(__file__).with_name("food_keywords.el.json").read_text())
    translations = aliases["foods"]
    # Translate before display normalization: reviewed translations use source titles.
    keywords = reference_keywords(foods, translations, merged_names(corrections), aliases.get("reviewedFoods"))
    profiles = {merge["canonical"]: merge for merge in corrections.get("profileDuplicates", [])}
    for row in foods:
        key = f"{row[0]}-{row[1]}"
        if key in profiles:
            row[2] = profiles[key]["name"]
            keywords[key] = clean_keywords(row[2], [*keywords.get(key, []), *profiles[key]["aliases"]])
        row[2] = normalize_title(row[2], row[0], display_brands.get(key, ""))
    data = {
        "sources": {
            "usda": "USDA FoodData Central, SR Legacy 2018-04 (public domain)",
            "ciqual": "ANSES-CIQUAL French food composition table 2020 (CC BY 4.0)",
            "off": "Open Food Facts, products sold in Greece (ODbL)",
        },
        "nutrients": [{"key": key, "unit": unit} for key, unit in {**MACRO_UNITS, **MICRO_UNITS}.items()],
        "estimatedUnsatFat": sorted(estimates & kept_ids),
        "generics": sorted({generic["canonical"] for generic in
                            [*corrections.get("generics", []), *profiles.values()]
                            if generic.get("name") and generic["canonical"] in kept_ids}),
        "keywords": keywords,
        "foods": foods,
    }
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    counts = {source: sum(food[0] == source for food in foods) for source in data["sources"]}
    print(f"{len(foods)} foods {counts} -> {out}")


def merged_names(corrections):
    """Alternate names by retained ID, so merged foods stay findable under their old names."""
    aliases = {}
    for merge in corrections.get("identityDuplicates", []):
        aliases.setdefault(merge["canonical"], []).extend(merge["aliases"])
    for generic in corrections.get("generics", []):
        aliases.setdefault(generic["canonical"], []).extend(generic.get("aliases", []))
    return aliases


def reference_keywords(foods, translations, aliases=None, reviewed=None):
    """Keep translated keywords and reviewed alternate names on the retained food ID."""
    aliases = aliases or {}
    result = {}
    for row in foods:
        key = f"{row[0]}-{row[1]}"
        keywords = clean_keywords(row[2], translations.get(row[2], []), row[0] == "off")
        if key in aliases:
            # Reviewed source names retain real brand aliases, unlike machine translations.
            keywords = clean_keywords(row[2], [*keywords, *aliases[key]])
        if key in (reviewed or {}):
            correction = reviewed[key]
            if row[2] != correction["name"]:
                raise ValueError(f"Reviewed translation no longer matches: {key}")
            # Reviewed phrases can include the English species name where Greek has none.
            keywords = list(dict.fromkeys(clean_name(term) for term in correction["keywords"] if clean_name(term)))
        if keywords:
            result[key] = keywords
    return result


if __name__ == "__main__":
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    main(*sys.argv[1:])
