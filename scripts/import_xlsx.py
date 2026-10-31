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
    "condiments": [31, 32, 36, 91, 94, 95, 96, 97, 100],
    "drinks": [34, 93],
    "meals": [104, 105, 106, 108, 109, 111, 113, 118],
    "supplements": [114, 119],
}
GROUP_OF = {row: group for group, rows in GROUPS.items() for row in rows}
SKIP = {103}  # duplicate of sugar (row 72)
FAVS = {15, 17, 21, 37, 112, 118, 119}  # what was on the plan when exported
NAMES = {
    34: "beer, non-alcoholic (330 g can)",
    73: "wonderbread (24 g toast slice)",
    91: "nutritional yeast (second entry)",
}
NUTRIENTS = ["kcal", "prot", "fiber", "satFat", "unsatFat", "salt"]


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


def event(kind, key, **payload):
    return {"id": f"import:{kind}:{key}", "t": T, "dev": "import", "type": kind, **payload}


def main(xlsx, last_weigh_in, out_dir):
    cells, notes = read_sheet(xlsx)
    events, foods = [], {}

    for row in range(2, 120):
        raw = cells.get(f"E{row}")
        if not isinstance(raw, str) or row in SKIP:
            continue
        basis, name = food_name(raw)
        name = NAMES.get(row, name)
        food = {
            "id": slug(name),
            "name": name,
            "basis": basis,
            "group": GROUP_OF[row],
            "fav": row in FAVS,
            "note": notes.get(f"E{row}", ""),
            **{key: cells.get(f"{col}{row}", 0.0) for key, col in zip(NUTRIENTS, "FGHIJK")},
        }
        foods[row] = food
        events.append(event("food.upsert", food["id"], food=food))

    for col in "AB":
        ingredients = [
            {"foodId": food["id"], "amount": round(cells[f"{col}{row}"] * (100 if food["basis"] == "100g" else 1), 1)}
            for row, food in foods.items()
            if isinstance(cells.get(f"{col}{row}"), float)
        ]
        recipe = {
            "id": f"recipe-{col.lower()}",
            "name": f"recipe {col}",
            "ingredients": ingredients,
            "totalG": cells.get(f"{col}130", 0.0),
            "containerG": cells.get(f"{col}131", 0.0),
        }
        events.append(event("recipe.upsert", recipe["id"], recipe=recipe))

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
