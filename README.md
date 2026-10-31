# regimen

Offline calorie and weigh-in tracker for Linux and Android, synced with Syncthing.

```
pnpm install
pnpm tauri dev
pnpm test
```

## Reference foods

`public/reference.json` bundles foods searchable offline, normalized to kcal,
protein, fiber, saturated fat, unsaturated fat, salt and sugar per 100 g:

- USDA FoodData Central SR Legacy (public domain)
- ANSES-CIQUAL 2020 (CC BY 4.0)
- Open Food Facts products sold in Greece (ODbL)

A value the source lacks stays unknown, unless it follows from another (no
carbohydrate means no sugar or fiber). To rebuild, download the three archives
listed in `scripts/build_reference.py` into `.cache/` and run:

```
python -I scripts/build_reference.py .cache/usda/sr.zip .cache/ciqual/xml.zip \
    .cache/off/products.csv.gz public/reference.json
```
