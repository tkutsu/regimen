# Generic water and further staple candidates

Reviewed on 2026-11-19. The user requested one generic water entry, then approved a wider staple review including pasta and bread while retaining the 5% limit for every reported nutrient. The suspect sugar entry was also explicitly approved for removal. This document records that pass. The later [fortification and variant-note review](fortification-review.md) leaves 13,119 foods and 551 exclusions; the [commit audit](merge-audit.md) documents inherited merge errors.

## Applied: one plain-water profile

The catalogue retains `usda-174158`, renamed Water, with its complete existing nutrient profile. Seven plain-water alternatives were excluded. Their previous titles and Greek search terms remain aliases of Water. This pass left 13,228 foods and 408 explicit reference exclusions. The subsequent staple consolidations and sugar removal below leave 13,211 foods and 409 exclusions.

| Removed ID | Previous title |
| --- | --- |
| usda-173647 | Beverages, water, tap, drinking |
| ciqual-18009 | Water, bottled, low mineral (average) |
| ciqual-18044 | Water, mineral, bottled (average) |
| ciqual-18045 | Water, mineral, non-carbonated, bottled (average) |
| ciqual-18046 | Water, mineral, carbonated, bottled (average) |
| ciqual-18066 | Water, municipal |
| ciqual-18430 | Water, bottled |

This is an explicit simplification requested by the user. These mineral profiles do not agree within 5%. Water's retained mineral values describe the selected source profile; they cannot represent every local supply or brand. No nutrient values were averaged or filled. The bottled-water exclusion runs after existing merges so its previously consolidated source record cannot reappear.

Flavoured waters, tonic, coconut water and foods containing water remain separate. Personal foods, recipes and meal history were not edited.

## Reviewed staple families

The wider screen covered 5,285 potentially relevant foods using source categories, titles and Greek search terms. This is a broad candidate screen: it includes prepared foods mentioning a staple, and family counts overlap. Unidentified products can still escape name/category screening. Each family needs separate profiles where the distinctions below matter.

| Family | Distinctions preserved | Examples screened |
| --- | --- | --- |
| Bread and rusks | Grain, wholemeal status, seeds, loaf/slices/rolls, size and preparation | Wheat sandwich rolls with sesame, white toast bread, Kythira-style olive-oil rusks, sunflower breadsticks |
| Pasta | Grain, egg/milk, gluten-free status, protein enrichment, dry/cooked and fillings/flavours; shapes may share a product under the later instruction | Melissa pasta, Makvel pasta, Misko protein pasta, milk-and-egg hilopites |
| Plain oats | Rolled, quick and oat flour separately; exclude flavoured and protein blends | Quaker quick oats, Crownfield fine oat flakes, Nutri Valley oat flakes |
| Rice | White versus brown and dry versus cooked; white-rice varieties may share a product under the later instruction | Agrino brown parboiled rice, Ben's Original parboiled long-grain rice |
| Flour | All-purpose wheat, strong/bread, wholemeal, self-raising and other grains separately | Allatini all-purpose flour, AB soft all-purpose flour |
| Cooking oils | One profile per oil type; preserve blends and infused oils | Mythogea olive oil, Galaxias corn oil, Gustona sunflower oil |
| Sugar | White, raw/brown and icing sugar separately; keep sweetener blends separate | White sugar, Fytro raw cane sugar, Fytro dark sugar |
| Tahini | Plain hulled and wholegrain separately; preserve cocoa, honey and other flavours | Olympos plain/wholegrain tahini, Marata plain tahini |
| Nut butters | One per nut, smooth/crunchy and ingredient formulation | Go On roasted-peanut butter, Filedem 100% peanut butter; Haitoglou sweetened peanut butter needs a separate profile |
| Nuts and seeds | Species, raw/roasted, salted/unsalted and shelled status | Alesto shelled almonds, Sklavenitis raw almonds |
| Pulses | Species, dry versus cooked/canned, drained status and added salt | Sklavenitis fine lentils, dry lentils, dry chickpeas |
| Plain vegetables | Species and raw/frozen/cooked state; preserve mixes, sauces and added fat | Bonduelle plain spinach, Natural Cool leaf spinach |
| Cocoa | Unsweetened cocoa by fat content and alkalisation; preserve sweetened drink powders | Belbake cocoa, Bonora cocoa, Giotis cocoa |
| Vinegar | Wine, apple cider and balsamic separately; preserve sweetened glazes | Wisdom of Nature white vinegar, AB balsamic vinegar |
| Milk and yogurt | Species, fat percentage, straining, lactose status, fortification and fermentation type | Plain 1.5% cow's milk, plain 2% strained yogurt |
| Cheese | Cheese type, milk, fat, physical form and named formulation | Sliced Edam, light cream cheese, sliced versus grated Gouda/mozzarella |
| Honey | Plain honey with botanical types retained where useful; exclude syrups and blends | Agrevi honey, flower honey with thyme |
| Salt | Later instruction removes iodine/fluoride-fortified variants where a plain variant exists | Iodised salt, iodised and fluoridated salt |
| Coffee and tea | Beans/grounds/capsules/brewed, flavour, caffeine and added ingredients | Greek coffee, espresso beans, coffee capsules, prepared tea drinks |
| Eggs | Whole/white/yolk, fresh/dried and cooking state | Source egg profiles and foods mentioning egg as an ingredient |

The comparison found 112 pairs within 5% across all 45 catalogue nutrient fields. Eighteen failed additional raw source checks, leaving 94 for identity review. Sixteen pairs were consolidated; the other 78 retained separate profiles because their identities differ or remain unresolved. [Every candidate-pair decision](staple-candidate-decisions.csv) is recorded, including the source fields that failed the limit.

The rule is `abs(a - b) / min(a, b) <= 0.05`. Zero matches only zero, and known/unknown coverage must match. Every pair in a group must qualify. Source total fat and carbohydrate coverage must match too; all additional source values reported by both records are checked. The new groups' largest difference is 3.773585%, including these raw source values. Exact food-row, product-identity and raw nutrition hashes guard the reviewed decisions against source changes.

The earlier nine illustrative pairs all failed: white sugar, corn oil, oat flakes, plain tahini, wholegrain tahini, raw almonds, dry lentils, cocoa and all-purpose flour. The wider screen found a different qualifying wholegrain-tahini pair. No additional qualifying rice, flour, oil, sugar, oat, nut, honey or vinegar consolidation was established in this screen.

## Applied staple profiles

Thirty-two records now share 16 retained profiles, removing 16 redundant records. Each profile keeps one complete source row; no nutrition was averaged or filled. Original names and Greek search terms remain aliases. The [exact retained IDs, removed IDs, differences and identity evidence](staple-profile-merges.csv) are recorded.

| Type | Shared profiles |
| --- | --- |
| Bread and rusks (5) | Wheat sandwich rolls with sesame; white sliced wheat toast bread; Kythira-style olive-oil wheat rusks; sliced wheat rusks; sunflower-seed wheat breadsticks |
| Pasta (1) | Dry hilopites with milk and eggs |
| Yogurt | Cow-milk yogurt, 3.9% fat |
| Yogurt | Delta strained yogurt, 10% fat |
| Yogurt | Plain strained yogurt, 0% fat |
| Yogurt | Cow-milk yogurt, 2% fat |
| Cheese | Sliced Edam |
| Cheese | Light cream cheese |
| Peanut butter (2) | Calve sweetened formulation; smooth 100% peanuts |
| Tahini (2) | Wholegrain; honey |

Each yogurt and cheese row above is an independent profile; these are not one shared yogurt or cheese product. Package photos resolved several incomplete titles. Adoro Edam is sliced and Royal cream cheese is light, allowing those pairs to merge. The Gouda entry `off-5201953000375` is grated, so it remains separate from sliced Gouda. Source photos were inspected for 12 products. Where a source lacks an ingredient list, the decision uses its explicit food type and qualifiers plus matching nutrition; it does not certify identical undisclosed ingredients.

For the plain peanut butter, exact-barcode records identify both the [300 g pack](https://biomesogeios.com/fystikoboytyro-300gr-ellinikos-karpos-60-063) and [1 kg pack](https://nutsbox.gr/product/fystikovoutyro-ellinikos-karpos/) as smooth 100% peanut butter from Ellinikos Karpos. The removed source brand was incorrect. The [Marata own-label ingredient list](https://www.sklavenitis.gr/eidi-artozacharoplasteioy/kritsinia-paximadia-bake-rolls/paximadia-ladioy-sitoy/marata-paximadakia-ladiou-tupou-kuthiron-400gr-1550884/) confirms the matching 14% olive-oil wheat rusks. The [Tis Giagias manufacturer](https://tisgiagias.gr/product/tis-giagias-xylopites-500gr/) confirms semolina, milk and egg for the hilopites pair.

This pass did not consolidate the other screened pasta records. The later user instruction accepts grouping shapes and rice varieties; the fortification review adds notes and aliases to three existing shared profiles. Lactose status, flavour, protein/egg formulations, cooking state and cheese forms remain meaningful distinctions. The separate commit audit identifies inherited rules that had already crossed such distinctions or exceeded 5%. Water remains the explicitly requested exception to nutrient equivalence.

## Removed suspect sugar

`off-5206558810015`, titled Sugar, reported 0.9 g salt/100 g. The user explicitly requested its removal. The source was excluded with a prior-name guard; no alternative salt or sugar value was inferred. This decision concerns that source profile, rather than establishing that any trace of sodium makes a sugar product invalid.

## Verification

All 52 importer tests and 16 reference/search unit tests passed. Forty full-catalogue search checks cover all 32 original merged names, Greek queries and preserved variants. The production web build passed. A repeated full source rebuild matches the bundled catalogue byte for byte.

Compared with the water-only snapshot, exact ID checks confirm 16 merged removals, one excluded sugar entry, 16 title/alias updates and no added foods. Every retained nutrient value is unchanged; other retained titles and aliases are unchanged. After this pass the catalogue contained 3,526 USDA, 2,016 CIQUAL and 7,669 Open Food Facts records.

One consolidated rusk record had missing sugar. After this pass the queue contained 1,507 foods: 1,496 tentative estimates and 11 without a useful estimate. Retained guesses are unchanged; comparison IDs follow the retained profiles. All comparison IDs still exist.

No application code changed in this staple pass. The later variant-note work does update the reference loader. Personal foods, recipes and history were not edited. No commit, push, native build, deployment or manual app interaction was performed for these follow-up changes.
