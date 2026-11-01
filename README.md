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

A value the source lacks stays unknown, unless it follows from another (no
carbohydrate means no sugar or fiber). To rebuild, download the three archives
listed in `scripts/build_reference.py` into `.cache/` and run:

```
python -I scripts/build_reference.py .cache/usda/sr.zip .cache/ciqual/xml.zip \
    .cache/off/products.csv.gz public/reference.json
```
