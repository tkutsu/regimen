# regimen

An offline calorie and weigh-in tracker for Linux and Android. There is no
server and no account: each device writes its own log into a folder that
Syncthing keeps in sync, and every device reads all the logs.

- Today: log what you eat and see what's left of the day's calories and nutrients.
- Foods: your own foods with groups, variants and containers, plus bundled
  reference foods you can search offline.
- Recipes: weigh the cooked pot to get values per 100 g, and start a new batch
  when you cook it again.
- Weight: a weigh-in chart and an estimate of maintenance calories for each
  cut or bulk phase.

Built with Tauri 2, React and Tailwind.

## Run and build

```
pnpm install
pnpm tauri dev
pnpm test
```

To install the desktop app for the current user (binary in `~/.local/bin`,
plus a launcher entry):

```
scripts/install-linux.sh
```

For Android, `pnpm tauri android build --apk` with `ANDROID_HOME` and
`NDK_HOME` set. On first run, pick the synced folder and a name for the device.

## Reference foods

`public/reference.json` bundles foods searchable offline, normalized to kcal,
protein, fiber, saturated fat, unsaturated fat, salt and sugar per 100 g:

- USDA FoodData Central SR Legacy (public domain)
- ANSES-CIQUAL 2020 (CC BY 4.0)
- Open Food Facts products sold in Greece (ODbL)

The database also stores reported vitamins and minerals for future use. These
columns follow sugar in each food row; the top-level `nutrients` array gives the
key and unit of every numeric column, in order. Micronutrients use `mg` or `ug`
(micrograms) per 100 g. Open Food Facts amounts are converted from grams, as
specified in its [nutrition schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/).
The current UI continues to read only the original seven nutrients.

Food names stay separate from comma-separated search keywords. Keywords can
include Greek names, alternate spellings and other terms; the food picker and
Foods tab use the same fuzzy matching for both fields. Accents and final sigma
do not affect Greek matching. Keywords are saved and synced with the food.

The reference catalogue includes Greek keywords from
`scripts/food_keywords.el.json`, attached by exact source name during a rebuild.
These are machine translations supplemented with reviewed common food terms.
For brand-only names, source-reported food categories can supply Greek keywords.
Uncommon names may need correction; keywords are editable after adding a food.
Translations are bundled, so searching needs no network connection.
Reviewed spelling and nutrient corrections, Slavic-language product exclusions and duplicate
merges are recorded in `scripts/food_cleanup.json` and reapplied on rebuild.
Duplicates require the same food identity and matching reported nutrients,
allowing small rounding differences across macros and micronutrients. Missing
values remain distinct from zero. Explicitly reviewed package duplicates can
keep a canonical record with additional micronutrients, provided no known value
is lost or conflicts; sodium allows 1 mg rounding. Label corrections record
their source and expected previous value so changed source data stops the rebuild
for inspection. Unsupported amounts and label bounds remain unknown.
Reviewed identity merges can also consolidate the same food across sources when
their reported nutrients differ. Each merge records the retained ID, a reason,
alternate search names and hashes of the normalized rows, including every
nutrient. Packaged-food reviews also guard the source name, brand, quantity and
ingredients. A changed record stops the rebuild for review. The retained row
keeps its own nutrient profile; values are never averaged or filled from a
different source. Cultivar, edible
portion, preparation, fat percentage and known formulation differences remain
separate.
Search keywords omit repeated English words
and translated brand labels.

Distinct vitamin forms stay separate: vitamin A as reported, vitamin A RAE,
retinol and beta-carotene; vitamin E as reported and alpha-tocopherol; vitamin K
as reported, K1 and K2; total folate, folic acid, food folate and folate DFE.
These columns are alternatives or components, not values to add together.
No conversions between vitamin forms are inferred.

A value the source lacks stays unknown unless derived as described here. Exact zero carbohydrate can establish
zero sugar, and exact zero fat can establish zero fatty acids. Fiber stays
unknown unless supplied by the source. Bounds and traces stay unknown, and
unsaturated fat uses an explicit value or both mono- and polyunsaturated fat when
available. Otherwise, known total and saturated fat can provide an estimate:
total fat minus saturated fat, provided the result is nonnegative. These rows are
listed in `estimatedUnsatFat` and labelled in the food's note when loaded or saved.
This is an approximation because total fat also includes non-fatty-acid components
([FAO](https://www.fao.org/4/y4705e/y4705e22.htm)). Existing reported values are preserved.

The importer rejects unusable names, impossible nutrient amounts and inconsistent
nutrition. It also excludes Open Food Facts products with source-reported
nutrition errors. A source's generic name can replace a missing or barcode-only
product name. Equivalent rows with the same name and nutrient values are
collapsed within each source; unreviewed matching names with different values stay separate.

Run the importer regression checks with:

```
python -B -I -m unittest discover -s scripts -p 'test_build_reference.py'
```

To rebuild, download the three archives listed in `scripts/build_reference.py`
into `.cache/` and run:

```
python -I scripts/build_reference.py .cache/usda/sr.zip .cache/ciqual/xml.zip \
    .cache/off/products.csv.gz public/reference.json
```
