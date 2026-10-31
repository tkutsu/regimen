"""Imports the old Google Sheet (regimen tab) into events/import.jsonl.

    python -I scripts/import_xlsx.py Regimen.xlsx 2026-10-31 ~/_shared/mobile/regimen

The date is the day of the last weigh-in; weigh-ins were daily, so earlier rows
count back from it. Event ids are fixed, so re-running replaces the import, and
every import event is timestamped in 2000, so anything entered in the app wins.
"""

import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import date, timedelta

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
T = "2000-01-01T00:00:00.000Z"
LAST_ROW = 160

GROUPS = {
    "meat": [5, 6, 7, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52],
    "fish": [8, 9, 10, 11, 12, 13, 53, 54, 55, 56, 57, 58],
    "dairy & eggs": [2, 3, 4, 37, 38, 39, 40, 42, 101, 115],
    "carbs": [16, 17, 18, 19, 20, 21, 64, 65, 66, 67, 68, 69, 70, 71, 73, 74, 80, 102, 110],
    "legumes": [81, 83, 84, 85, 116],
    "veg": [22, 23, 24, 35, 82, 86, 87, 88, 89, 90, 99],
    "fruit": [25, 26, 27, 28, 29, 30, 75, 76, 77, 78, 79],
    "nuts & fats": [59, 60, 61, 62, 63, 98, 117],
    "sweets": [14, 15, 33, 72, 92, 107, 112],
    "condiments": [31, 32, 91, 94, 95, 96, 97, 100],
    "drinks": [34, 93],
    "meals": [104, 105, 106, 108, 109, 111, 113, 118],
    "supplements": [114, 119],
}
GROUP_OF = {row: group for group, rows in GROUPS.items() for row in rows}
SKIP = {36, 103}  # nutritional yeast (merged into row 91), sugar (duplicate of row 72)
NOTE_FROM = {91: 36}  # row 36 held the vitamin label for nutritional yeast
FAVS = {15, 17, 21, 37, 112, 118, 119}  # what was on the plan when exported
NAMES = {
    73: "wonderbread (24 g toast slice)",
}
NUTRIENTS = ["kcal", "prot", "fiber", "satFat", "unsatFat", "salt"]

# Rows that lumped several foods together, split with researched values per 100 g:
# (name, (kcal, prot, fiber, satFat, unsatFat, salt), source). USDA ids are SR Legacy.
SPLITS = {
    7: [
        ("chicken thigh, roasted", (179, 24.8, 0, 2.3, 5.1, 0.27), "USDA FDC 172388"),
        ("beef liver, pan-fried", (175, 26.5, 0, 2.5, 2.1, 0.19), "USDA FDC 168627"),
    ],
    12: [
        ("sea bream (tsipoura), raw", (121, 20.7, 0, 0.9, 2.1, 0.2), "INRAN (orata); salt from Cromaris label"),
        ("anchovy (gavros), raw", (131, 20.4, 0, 1.3, 2.8, 0.26), "USDA FDC 174182"),
    ],
    18: [
        ("oats, rolled", (379, 13.2, 10.1, 1.1, 4.3, 0.01), "USDA FDC 173904"),
        ("trahanas, sour", (365, 12.0, 3.0, 1.7, 1.3, 2.08), "Vlaha label (Open Food Facts 5201418000094); fiber estimated"),
    ],
    19: [
        ("amaranth, popped", (371, 13.6, 6.7, 1.5, 4.5, 0.01), "USDA FDC 170682 (dry grain)"),
        ("buckwheat, puffed", (343, 13.2, 10.0, 0.7, 2.1, 0), "USDA FDC 170286 (dry grain)"),
        ("wheat, puffed", (364, 14.7, 4.4, 0.2, 0, 0.01), "USDA FDC 173913"),
    ],
    22: [
        ("bell pepper, red", (26, 1.0, 2.1, 0.1, 0.2, 0.01), "USDA FDC 170108"),
        ("tomato", (18, 0.9, 1.2, 0, 0.1, 0.01), "USDA FDC 170457"),
        ("cabbage", (25, 1.3, 2.5, 0, 0, 0.04), "USDA FDC 169975"),
        ("eggplant", (25, 1.0, 3.0, 0, 0.1, 0.01), "USDA FDC 169228"),
    ],
    23: [
        ("carrot", (41, 0.9, 2.8, 0, 0.1, 0.17), "USDA FDC 170393"),
        ("onion", (40, 1.1, 1.7, 0, 0, 0.01), "USDA FDC 170000"),
        ("green peas, frozen", (77, 5.2, 4.5, 0.1, 0.2, 0.27), "USDA FDC 170016"),
        ("kale", (35, 2.9, 4.1, 0.2, 0.8, 0.13), "USDA FDC 168421"),
        ("dill", (43, 3.5, 2.1, 0.1, 0.9, 0.15), "USDA FDC 172233"),
    ],
    24: [
        ("green onion", (32, 1.8, 2.6, 0, 0.1, 0.04), "USDA FDC 170005"),
        ("zucchini", (17, 1.2, 1.0, 0.1, 0.1, 0.02), "USDA FDC 169291"),
        ("broccoli", (34, 2.8, 2.6, 0.1, 0.1, 0.08), "USDA FDC 170379"),
    ],
    25: [
        ("apple", (52, 0.3, 2.4, 0, 0.1, 0), "USDA FDC 171688"),
        ("pineapple", (50, 0.5, 1.4, 0, 0.1, 0), "USDA FDC 169124"),
        ("orange", (47, 0.9, 2.4, 0, 0, 0), "USDA FDC 169097"),
    ],
    26: [
        ("banana", (89, 1.1, 2.6, 0.1, 0.1, 0), "USDA FDC 173944"),
        ("sweet corn, boiled", (96, 3.4, 2.4, 0.2, 1.0, 0), "USDA FDC 169999"),
    ],
    28: [
        ("nectarine", (44, 1.1, 1.7, 0, 0.2, 0), "USDA FDC 169914"),
        ("peach", (39, 0.9, 1.5, 0, 0.2, 0), "USDA FDC 169928"),
    ],
    30: [
        ("kiwi", (61, 1.1, 3.0, 0, 0.3, 0.01), "USDA FDC 168153"),
        ("mango", (60, 0.8, 1.6, 0.1, 0.2, 0), "USDA FDC 169910"),
    ],
    31: [
        ("ketchup", (101, 1.0, 0.3, 0, 0.1, 2.27), "USDA FDC 168556"),
        ("mustard, yellow", (60, 3.7, 4.0, 0.2, 3.0, 2.76), "USDA FDC 172234"),
    ],
    34: [
        ("beer", (43, 0.5, 0, 0, 0, 0.01), "USDA FDC 168746"),
        ("beer, non-alcoholic", (37, 0.2, 0, 0, 0.1, 0.03), "USDA FDC 174863"),
    ],
    38: [
        ("cream cheese, light", (208, 7.8, 0, 10.0, 4.6, 0.79), "USDA FDC 169079"),
        ("mizithra, fresh", (228, 10.0, 0, 12.2, 6.2, 0.49), "foodforhealth.gr (USDA branded 361973)"),
    ],
    42: [
        ("parmesan", (392, 35.8, 0, 14.8, 8.1, 2.94), "USDA FDC 170848"),
        ("cheddar", (403, 22.9, 0, 18.9, 10.3, 1.63), "USDA FDC 173414"),
    ],
    46: [
        ("lamb, lean, braised", (223, 33.7, 0, 3.1, 4.3, 0.17), "USDA FDC 172509"),
        ("beef chuck, lean, braised", (216, 30.5, 0, 4.0, 5.6, 0.16), "USDA FDC 169444"),
    ],
    51: [
        ("beef liver, raw", (135, 20.4, 0, 1.2, 0.9, 0.17), "USDA FDC 169451"),
    ],
    63: [
        ("peanuts", (567, 25.8, 8.5, 6.3, 40.0, 0.04), "USDA FDC 172430"),
        ("pistachios", (560, 20.2, 10.6, 5.9, 37.6, 0), "USDA FDC 170184"),
        ("almonds", (579, 21.1, 12.5, 3.8, 43.9, 0), "USDA FDC 170567"),
    ],
    66: [
        ("bulgur, dry", (342, 12.3, 12.5, 0.2, 0.7, 0.04), "USDA FDC 170688"),
        ("couscous, dry", (376, 12.8, 5.0, 0.1, 0.3, 0.03), "USDA FDC 169699"),
        ("orzo, dry", (371, 13.0, 3.2, 0.3, 0.7, 0.01), "USDA FDC 169736"),
        ("semolina (simigdali), dry", (360, 12.7, 3.9, 0.1, 0.6, 0), "USDA FDC 169715"),
    ],
    79: [
        ("strawberry", (32, 0.7, 2.0, 0, 0.2, 0), "USDA FDC 167762"),
        ("watermelon", (30, 0.6, 0.4, 0, 0.1, 0), "USDA FDC 167765"),
    ],
    82: [
        ("cauliflower", (25, 1.9, 2.0, 0.1, 0.1, 0.07), "USDA FDC 169986"),
        ("green beans", (31, 1.8, 2.7, 0.1, 0.1, 0.01), "USDA FDC 169961"),
    ],
}
# A split row's note belongs to one part only; other split rows' notes apply to every part.
NOTE_ONLY = {22: "tomato", 25: "apple", 31: "ketchup", 42: "cheddar"}
# Recipes that used a split row, divided between its parts.
RECIPE_PARTS = {23: {"carrot": 0.5, "onion": 0.5}}

# Raw/cooked factors from the sheet's notes: amount × factor gives the listed food's values.
VARIANTS = {
    "chicken-breast-baked": [("raw", 0.65)],
    "baked-salmon": [("raw", 0.8)],
    "sea-bream-tsipoura-raw": [("cooked", 1.4)],
    "anchovy-gavros-raw": [("cooked", 1.4)],
    "lavraki-raw": [("cooked", 1.4)],
    "potato": [("baked", 1.5)],
    "beef-10-raw": [("cooked", 1.25)],
    "chicken-mince-raw": [("cooked", 1.266)],
    "pasta-boiled": [("raw", 2.4)],
    "buckwheat-fagopiro-boiled": [("raw", 2.8)],
    "bulgur-dry": [("cooked", 0.33)],
    "couscous-dry": [("cooked", 0.33)],
    "orzo-dry": [("cooked", 0.33)],
    "semolina-simigdali-dry": [("cooked", 0.33)],
    "rice-cooked": [("raw", 3.25)],
    "quinoa-cooked": [("raw", 3.33)],
    "chickpea-revithi-boiled": [("raw", 2.0)],
    "white-beans-fasolia-raw": [("boiled", 0.41)],
    "split-pea-fava-cooked": [("raw", 3.41)],
    "lentils-cooked": [("raw", 2.22)],
}

# Separate products the notes described relative to another food: (name, group, [(base id, factor)]).
DERIVED = [
    ("tortilla", "carbs", [("pita", 0.82)]),
    ("tomato paste", "veg", [("tomato", 4)]),
    ("tomato puree", "veg", [("tomato", 1.5)]),
    ("ketchup, stevia", "condiments", [("ketchup", 0.6)]),
    ("arla hard cheese", "dairy & eggs", [("cheddar", 0.8)]),
    ("sardines (sardela), baked", "fish", [("mackerel-skoubri-baked", 1)]),
    ("barracuda (loutsos), baked", "fish", [("mackerel-skoubri-baked", 1)]),
    ("lentils, red, dry", "legumes", [("lentils-dry", 0.92)]),
    ("mayo, regular", "condiments", [("mayo-light", 1 / 0.38)]),
    ("whole chicken, roasted", "meat", [("chicken-breast-baked", 0.4), ("chicken-thigh-roasted", 0.6)]),
]
WHISKEY = ("whiskey", (250, 0, 0, 0, 0, 0), "sheet note on white wine")


def read_sheet(path):
    with zipfile.ZipFile(path) as z:
        strings = [
            "".join(t.text or "" for t in si.iter(NS + "t"))
            for si in ET.fromstring(z.read("xl/sharedStrings.xml"))
        ]
        cells = {}
        with z.open("xl/worksheets/sheet1.xml") as f:
            for _, el in ET.iterparse(f):
                if el.tag == NS + "row":
                    if int(el.get("r")) > LAST_ROW:
                        break
                    for c in el:
                        v = c.find(NS + "v")
                        if v is None or v.text is None:
                            continue
                        kind = c.get("t")
                        cells[c.get("r")] = (
                            strings[int(v.text)] if kind == "s" else v.text if kind == "str" else float(v.text)
                        )
                    el.clear()
        notes = {
            c.get("ref"): "".join(t.text or "" for t in c.iter(NS + "t")).strip()
            for c in ET.fromstring(z.read("xl/comments1.xml")).iter(NS + "comment")
        }
    return cells, notes


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def food_name(raw):
    basis = "item" if raw.startswith("1x.") else "100g"
    name = raw.split(".", 1)[1].replace(" (notes)", "").strip()
    return basis, name.replace("_", " ").replace(".", ", ")


def make_food(name, basis, group, fav, note, values):
    return {
        "id": slug(name),
        "name": name,
        "basis": basis,
        "group": group,
        "fav": fav,
        "note": note,
        **{key: round(value, 2) for key, value in zip(NUTRIENTS, values)},
    }


def join(*lines):
    return "\n".join(line for line in lines if line)


def event(kind, key, **payload):
    return {"id": f"import:{kind}:{key}", "t": T, "dev": "import", "type": kind, **payload}


def main(xlsx, last_weigh_in, out_dir):
    cells, notes = read_sheet(xlsx)
    foods_by_row = {}

    for row in range(2, 120):
        raw = cells.get(f"E{row}")
        if not isinstance(raw, str) or row in SKIP:
            continue
        basis, name = food_name(raw)
        note = notes.get(f"E{NOTE_FROM.get(row, row)}", "")
        group, fav = GROUP_OF[row], row in FAVS
        if row in SPLITS:
            only = NOTE_ONLY.get(row)
            foods_by_row[row] = [
                make_food(part, basis, group, fav, join(note if only in (None, part) else "", f"source: {source}"), values)
                for part, values, source in SPLITS[row]
            ]
        else:
            values = [cells.get(f"{col}{row}", 0.0) for col in "FGHIJK"]
            foods_by_row[row] = [make_food(NAMES.get(row, name), basis, group, fav, note, values)]

    foods = {food["id"]: food for parts in foods_by_row.values() for food in parts}
    for name, group, bases in DERIVED:
        values = [sum(foods[base][key] * factor for base, factor in bases) for key in NUTRIENTS]
        recipe = " + ".join(f"{foods[base]['name']} ×{factor:.3g}" for base, factor in bases)
        food = make_food(name, "100g", group, False, f"derived: {recipe}", values)
        foods[food["id"]] = food
    name, values, source = WHISKEY
    foods[slug(name)] = make_food(name, "100g", "drinks", False, f"source: {source}", values)
    for food_id, variants in VARIANTS.items():
        foods[food_id]["variants"] = [{"name": name, "factor": factor} for name, factor in variants]

    events = [event("food.upsert", food["id"], food=food) for food in foods.values()]

    for col in "AB":
        ingredients = []
        for row, parts in foods_by_row.items():
            amount = cells.get(f"{col}{row}")
            if not isinstance(amount, float):
                continue
            shares = RECIPE_PARTS.get(row) or ({parts[0]["name"]: 1} if len(parts) == 1 else None)
            if shares is None:
                sys.exit(f"recipe {col} uses split row {row}; add it to RECIPE_PARTS")
            for part in parts:
                if part["name"] in shares:
                    grams = amount * shares[part["name"]] * (100 if part["basis"] == "100g" else 1)
                    ingredients.append({"foodId": part["id"], "amount": round(grams, 1)})
        recipe = {
            "id": f"recipe-{col.lower()}",
            "name": f"recipe {col}",
            "ingredients": ingredients,
            "totalG": cells.get(f"{col}130", 0.0),
            "containerG": cells.get(f"{col}131", 0.0),
        }
        events.append(event("recipe.upsert", recipe["id"], recipe=recipe))

    # "metal bowl: 575g, 260g, 255gx2" -> one container per weight; "1.103g" uses a thousands dot.
    containers = []
    for row in range(131, 143):
        name, _, weights = str(cells.get(f"E{row}", "")).partition(":")
        for weight in weights.split(","):
            grams = int(re.sub(r"\D", "", weight.split("g")[0]) or 0)
            if grams:
                containers.append({"id": slug(f"{name} {grams}"), "name": name.strip(), "grams": grams})
    events.append(event("settings", "containers", settings={"containers": containers}))

    weigh_ins = [row for row in range(1, LAST_ROW) if isinstance(cells.get(f"M{row}"), float)]
    last = date.fromisoformat(last_weigh_in)
    for row in weigh_ins:
        day = (last - timedelta(days=weigh_ins[-1] - row)).isoformat()
        events.append(event("weight", day, date=day, kg=cells[f"M{row}"]))
        offset = cells.get(f"L{row}")
        if isinstance(offset, float):
            phase = "cut" if offset < 0 else "bulk" if offset > 0 else "maintain"
            events.append(event("day.upsert", day, day={"date": day, "phase": phase, "steps": 0, "extraKcal": 0, "offset": offset}))

    path = os.path.join(os.path.expanduser(out_dir), "events")
    os.makedirs(path, exist_ok=True)
    target = os.path.join(path, "import.jsonl")
    with open(target + ".tmp", "w") as f:
        f.writelines(json.dumps(e, ensure_ascii=False) + "\n" for e in events)
    os.replace(target + ".tmp", target)
    print(f"{len(foods)} foods, 2 recipes, {len(weigh_ins)} weigh-ins -> {target}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    main(*sys.argv[1:])
