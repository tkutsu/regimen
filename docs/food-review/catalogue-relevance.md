# Catalogue relevance review

Reviewed on 2026-11-18 for adults tracking food intake, weight and training, with packaged foods sold in Greece. Updated on 2026-11-19 after the user approved the 220 remaining candidates and a further 79 exclusions.

There are 551 explicit reference exclusions, including seven water alternatives removed after the user requested one generic Water profile, the suspect sugar profile reporting 0.9 g salt/100 g and 142 fortified variants with identified plain counterparts. After the [additional exclusions and product consolidations](catalogue-followup.md), [generic staple review](generic-staples.md) and [fortification review](fortification-review.md), the catalogue contains 13,119 foods: 3,483 USDA, 1,990 CIQUAL and 7,646 Open Food Facts entries. [Download the exact exclusions and evidence](excluded-foods.csv).

The first pass removed 23 entries around infant feeding. The broader pass removed another 79 after checking the composition-table groups, product-title patterns and the packaged-food source categories. A further 220 entries were removed on explicit user approval. The [additional review](catalogue-followup.md) removed another 79 and consolidated 26 redundant product records under 24 retained profiles. These are catalogue relevance decisions for the intended audience; the excluded profiles still describe distinct source foods.

| Excluded type | Entries | Reason |
| --- | ---: | --- |
| Infant/toddler products and human milk | 23 | Outside adult meal tracking. |
| Industrial fat/oil formulations | 33 | Factory frying, coating, filling and manufacturing fats, rather than identifiable household ingredients. |
| Mechanically recovered meat ingredients | 7 | Meat-processing inputs; finished packaged products have their own labels. |
| Industrial egg preparations | 7 | Stabilized, glucose-reduced dried egg and salted/sugared frozen egg inputs. Ordinary eggs, pasteurized egg whites and generic egg-white powder remain. |
| Regional game meats | 18 | Muskrat, opossum, squirrel, bear, caribou, moose, raccoon, beaver, antelope and beefalo are low-priority foods for this Greece-focused catalogue. |
| Emu cuts | 12 | Specialist farmed-bird cuts with little expected use for this audience. |
| Green turtle | 1 | Low-priority regional meat for the intended catalogue. |
| Glucosamine tablet supplement | 1 | A tablet formulation rather than a meal ingredient or sports nutrition food. |
| Legacy USDA branded products | 116 | User approved removal of the complete candidate list. |
| Named CIQUAL mineral and spring waters | 79 | User approved removal of all named-water candidates; generic water profiles remain. |
| Separated animal-fat samples | 21 | User approved removal of these samples; lard, tallow and ordinary cooking fats remain. |
| Specialty oils and fats | 4 | User approved removal of babassu, nutmeg butter, cupu assu and ucuhuba butter. |

The USDA "Baby Foods" and CIQUAL "baby food" groups were already excluded. The remaining packaged products included infant formula, follow-on milk, cereal creams, fruit purees, biscuits, toddler bars and a jarred baby meal. Some had no baby-food category in the source export. Nutricia's product page confirms that [Biskotti are infant biscuits for ages six months and above](https://www.nutricia.com/el-gr/product/biskotti-180g). An exact-barcode listing identifies the misleading "Rice flour (Nutricia)" entry as [infant cereal cream with milk](https://www.smile-pharmacy.gr/en/vendors/nutricia/nutricia-infant-cream-vanilla-rice-250gr.htm).

The first table covers the earlier 322 exclusions; [the additional 79 exclusions are listed separately](additional-relevance.csv). Each exclusion names a specific source ID and expected source title in `scripts/food_cleanup.json`. A changed title stops the rebuild for review. None of the additional 79 or approved 220 rows is a canonical row or dependency in an existing reviewed merge. There is no blanket rule for "baby", children's brands or milk powder. The [glucosamine supplement's exact barcode listing](https://www.biologikoxorio.gr/en/meta-flex-glucosamine-hyaluronic-acid-chondroitin-msm-60-tabs) identifies the tablet product.

## Foods retained

Baby carrots, baby potatoes, salad leaves and Babybel remain. Children's ordinary milk, yogurt and cocoa milk also remain useful food profiles. Frezylac corn-heart snacks stay because the [manufacturer explicitly includes adults](https://www.frezyderm.gr/paidikh-brefikh-diatrofh/viologika-snak-frezylac-/frezylac-the-snack-viologikes-kardies-kalampokiou/).

Sports supplements, meal replacements and the adult diabetes nutrition supplement remain relevant to tracking intake. Rabbit, wild boar, deer, goat, ostrich, seafood and edible offal remain. Offal can be part of Greek dishes; broad rules for organs or game would remove useful foods. Ordinary cooking oils, lard, tallow and household shortening remain. The [commit audit](merge-audit.md) identifies older merges that incorrectly cross dairy fat percentages or other identity distinctions.

## Approved additional removals

The broader screen identified 220 further entries. The user approved removing all of them on 2026-11-19. [Download the approved candidate list](relevance-candidates.csv); every row now records its removal.

| Type | Entries | Scope |
| --- | ---: | --- |
| Legacy USDA branded products | 116 | Includes Chobani, Silk, Kraft, Hormel and other branded 2018 profiles. Packaged Greek products and generic food profiles outside the approved list remain. |
| Named CIQUAL mineral and spring waters | 79 | Includes Avra, Evian, Perrier and San Pellegrino as well as less familiar brands. Generic tap, bottled and mineral-water profiles remain. |
| Separated animal-fat samples | 21 | Removes the listed separated-fat samples, preserving ordinary meat cuts and their fat percentages. |
| Specialty oils and fats | 4 | Babassu, nutmeg butter, cupu assu and ucuhuba butter. |

No other whole source group was selected for removal. The remaining broad groups contain ordinary adult foods. Before the broader pass, 4,593 of the 7,716 packaged entries had an unknown PNNS food group in the source export, so category tags alone cannot establish exhaustive relevance. Name screening and the existing name-review list help identify candidates, but this review does not claim that every poorly identified product has been resolved.

## Data and verification

The exclusions affect the bundled reference catalogue, which supplies foods to copy into a personal list. No personal event logs, saved foods, recipes or meal entries were edited.

All retained nutrient values are unchanged. The additional review changed 24 shared display titles and retained their original product names and Greek terms as aliases. The later generic staple review changed another 16 shared titles plus Water and is documented separately. The current list contains 1,503 unresolved foods, with unchanged retained guesses and three additional low-confidence estimates for restored plain profiles. The fortification review describes the changes. Earlier title and name-review lists remain historical records and may mention an excluded food.

The importer checks passed (52 tests), including exclusion identity drift, exclusions of retained IDs, the strict 5% profile limit and preservation of Babybel and baby carrots. All 177 application checks passed. Two rebuilds from cached source exports produced identical catalogue bytes. Those checks describe the earlier exclusion pass. Current verification is in the fortification review. Native Linux and Android installation results are reported separately at release time.
