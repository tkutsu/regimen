# Food catalogue review

Reviewed on 2026-11-18. The translation and sugar review covered 13,662 foods: 3,808 USDA, 2,116 CIQUAL and 7,738 Open Food Facts entries. Title and translation change lists describe that review snapshot; the missing-sugar list covers the current catalogue.

A [follow-up relevance review](catalogue-relevance.md), updated on 2026-11-19, excluded 401 entries, including infant foods, industrial ingredients, low-priority regional meats and the additional candidates approved for removal. An [additional review](catalogue-followup.md) consolidated 50 similar product records into 24 profiles using a 5% limit for every reported nutrient. The subsequent [generic staple review](generic-staples.md) retained one Water profile, excluded seven water alternatives and the suspect sugar entry, and consolidated another 32 records into 16 profiles under the same 5% limit. The subsequent [fortification review](fortification-review.md) adds 142 conditional exclusions, restores plain profiles hidden by earlier merges and adds searchable pasta/rice variant notes. Explicit exclusions total 551. The current catalogue contains 13,119 foods. The [merge commit audit](merge-audit.md) confirms that older rules still violate the current 5% policy and contain meaningful identity differences; those older problems remain to be repaired.

The scan covered every row. Corrections address repeated translation errors, missing food descriptors, capitalization, and the order of standalone fat and cooking qualifiers. It does not certify every remaining machine translation. Product names that need a label or a more precise identification are listed separately.

## Changes

| Change | Foods |
| --- | ---: |
| Normalized titles | 5,478 |
| Corrected or supplemented Greek search terms | 1,183 |
| Added confirmed sugar values | 3 |
| Remaining missing sugar values | 1,503 |
| Names needing further review | 163 |

The translation and sugar review preserved all food IDs, source groups and existing nutrient values. The later relevance exclusions are listed separately. The three sugar additions are the only nutrient changes.

Titles use sentence case, retaining brand spellings, recognized proper names and scientific identifiers. Composition-table titles put identifying details first, then standalone fat/lean content, cooking status/method, and salt/draining qualifiers. Packaged product descriptions retain their original clause order. Leading dairy fat percentages move after the food name; chocolate percentages retain their meaning. Title normalization retains identifying preparation, cultivar, flavour, fat, lactose and source wording. The separate commit audit documents where older merge rules had already removed distinctions between source profiles.

Examples of translation corrections include hash browns, poultry drumsticks, moringa leaves/pods, radishes, caraway versus cumin, and currants versus raisins. Freshwater drum now includes its English species name and Aplodinotus grunniens, rather than only a generic freshwater-fish description. The scientific identity is supported by the [USGS species record](https://nas.er.usgs.gov/queries/FactSheet.aspx?SpeciesID=946). English identifiers remain where a dependable everyday Greek name was not established.

## Confirmed sugar additions

All values below are grams per 100 g. Each correction checks the complete prior catalogue row before applying, so a changed source profile stops the rebuild.

| Food | ID | Sugar | Evidence |
| --- | --- | ---: | --- |
| Ola Bio tapioca starch | off-5204217902170 | 3.4 | [Exact-barcode label transcription](https://biozita.gr/proion/amylo-tapiokas-vio-350gr/); matches energy, carbohydrate, protein and fibre. Corroborated by [Biologiko Xorio](https://www.biologikoxorio.gr/amylo-tapiokas) and [Planet Health](https://planethealth.gr/product/viologiko-amylo-tapiocas-350gr-ola-bio/). |
| Wild Souls plain pistachio butter | off-5201049186761 | 7.8 | [Manufacturer](https://www.wildsouls.gr/en/product/fistikovoytyro-aiginis/); matches energy, fat, carbohydrate and protein. The truffle version is a different product. |
| 3alfa wild/parboiled rice mix, dry | off-5201399020210 | 0.0 | [Retailer label](https://www.mymarket.gr/3alfa-ryzi-agrio-parboiled-500gr); matches the existing energy, protein, carbohydrate, fibre and fat profile and explicitly declares zero sugar. |

## Missing sugar estimates

[Download the complete list](missing-sugar.csv). Every unresolved food has an ID, title, source annotation, estimate method and explanation. There are 1,492 tentative estimates and 11 entries without enough product information for a useful guess. Estimates remain outside the app database.

| Evidence or estimate method | Entries |
| --- | ---: |
| Researched labels with unresolved conflicts, units or OCR | 6 |
| Source upper bounds, including the reviewed Super Fresco limit | 71 |
| Unquantified source traces | 45 |
| Incomplete sums of individual USDA sugars | 7 |
| Comparable catalogue foods | 456 |
| Food-category estimates, including unidentified products | 918 |

Guesses and illustrative ranges use g/100 g. They are capped at the source's reported carbohydrate value where available. Comparison estimates use the median of up to three foods with matching identifying terms, compatible preparation and similar energy/protein. Their illustrative range extends the observed values by the larger of 0.5 g or 30% of the median. This is not a statistical confidence interval. Category estimates are broader working guesses.

A source bound remains a bound: for example, `<0.2 g` does not prove zero. The midpoint is supplied only as a guess. “Traces” has no numeric limit; its 0.05 g working estimate does not establish an upper bound. Incomplete component sums establish a lower bound, not an exact total. These distinctions follow the [CIQUAL source documentation](https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202020_doc_XML_ENG_2020%2007%2007.pdf).

Some researched examples:

| Food | Working guess | Why it remains unknown |
| --- | ---: | --- |
| Emelia sugarcane molasses | 63 g | The [manufacturer](https://www.emelia.eu/product/melasa-emelia/) lists glucose, fructose and sucrose summing to 63 g, without an explicit total-sugars declaration. |
| Kalamata Papadimitriou mustard with olive oil | 4.6 g | Exact-barcode OCR reports 4.6 g, but the rest of that label conflicts with the current row's nutrient profile. |
| 3alfa glase rice | 0.1 g | Retailer values disagree between zero and 0.2 g and do not reconcile with the existing profile. |
| Vlaha egg hilopitaki | 3.9 g | Product identity matches, but the available label profile has not been reconciled with the existing row. |
| Rodopaki Classic | About 10.8 g/100 g | The [manufacturer](https://www.rodopaki.gr/en/rodopakia/classic/) confirms 11.1 g/100 ml. Conversion to 100 g needs density; the guess assumes approximately 1.03 g/ml. The existing catalogue's beverage basis needs review. |
| Sergal yogurt | About 4.2 g | OCR cannot reliably distinguish a final digit from the `g` unit. A package image is needed. |

## Change lists and unresolved names

- [Title changes](title-changes.csv), with original and normalized names.
- [Translation changes](translation-changes.csv), with original and corrected keywords.
- [Names needing review](names-needing-review.csv), including products too poorly identified to translate reliably.
- [Matching normalized titles](matching-titles.csv): 34 groups of names that previously differed by case/style. Each source ID and nutrient profile remains separate; these are not approved duplicates.

## Verification

These checks describe the original translation and sugar review. Verification of the current exclusions is in the [relevance review](catalogue-relevance.md#data-and-verification).

The importer regression checks passed: 46 tests. The full application suite passed: 177 tests, including the 16 reference/search checks. Eight searches were also checked against the complete rebuilt catalogue, including freshwater drum, its scientific name, moringa, lime, currant and caraway. Data checks verified unchanged IDs and existing nutrients, the three intended sugar additions, retained title information, repeatable title normalization, and a complete sugar review list with valid bounds.

The catalogue was rebuilt from the cached USDA, CIQUAL and Greece OFF exports. Corrections are maintained in `scripts/food_cleanup.json` and the guarded `reviewedFoods` section of `scripts/food_keywords.el.json`; title normalization runs after identity curation and translation lookup.

The current frontend production build passed. An independent rebuild is byte-identical to `public/reference.json`, and the built `dist/reference.json` matches it. Catalogue SHA-256: `ddb263aba129a5b02d8b70adc90f0862f2943edd4c237424c6ce16b106c58c50`. Current targeted test and search results are in the [fortification review](fortification-review.md#sugar-queue-and-verification).

No technical blockers remain. Older invalid merges, conflicting labels, incomplete product identities, uncertain Greek terminology and beverage units remain documented review items.
