# regimen

Offline calorie and weigh-in tracker for Linux and Android, synced with Syncthing.

```
pnpm install
pnpm tauri dev
pnpm test
```

## Reference foods

`public/reference.json` bundles generic foods from the USDA SR Legacy table
(public domain) and the ANSES-CIQUAL 2020 table (CC BY 4.0), searchable offline.
To rebuild it, download the two archives listed in `scripts/build_reference.py`
into `.cache/` and run:

```
python -I scripts/build_reference.py .cache/usda/sr.zip .cache/ciqual/xml.zip public/reference.json
```
