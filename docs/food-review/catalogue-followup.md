# Additional catalogue review

Reviewed on 2026-11-19. The user approved this review on 2026-11-19. This pass left 13,235 foods and 401 explicit reference exclusions. The later [generic staple review](generic-staples.md), including water and suspect sugar exclusions, left 13,211 foods and 409 exclusions. The subsequent [fortification review](fortification-review.md) leaves 13,119 foods and 551 exclusions. A [commit audit](merge-audit.md) identifies older policy violations that remain unrepaired.

This pass applied 79 additional relevance exclusions and consolidated 50 product records into 24 retained profiles, removing 26 redundant rows. Personal foods, recipes and meal history are outside these removals and merges.

## Additional relevance exclusions

[Exact list of 79 approved exclusions](additional-relevance.csv).

| Type | Entries |
| --- | ---: |
| Regional bison, elk or horse meat | 23 |
| Specific hydrogenated fat formulations | 10 |
| Additional legacy branded composition profiles | 9 |
| Factory baking and frying fats | 9 |
| Industrial flour specifications | 7 |
| Cottonseed and imitation nut ingredients | 6 |
| Specialty fats and oils | 4 |
| Additional named mineral waters | 4 |
| Delta Advance infant/toddler nutrition | 3 |
| North American game birds | 2 |
| Manufacturing beef ingredients | 2 |

These are catalogue relevance judgments for adult food tracking in Greece. They do not establish that a food is unavailable in Greece or unsuitable to eat. Ordinary flour, household shortening, generic cooking oils, generic water, ordinary children's dairy products, sports nutrition, edible offal, rabbit, deer, goat, buffalo, quail, pheasant and ostrich remain.

Four named CIQUAL waters escaped the earlier parenthesis-based screen: Mont-Roucous, Carola, Mont-Blanc and Eden. The Delta Advance products had incomplete category tags. The [manufacturer identifies its lactose-free Advance milk as a product for children after 12 months](https://www.delta.gr/brefiki-paidiki-diatrofi/advance-xoris-laktozi/) and [its report describes Advance yogurt desserts as suitable from six months](https://www.delta.gr/wp-content/uploads/2024/12/DELTA-ESG-2023_GR.pdf).

The source-category check covered all 7,715 remaining packaged entries, including 88 tagged dietary supplements. Most are protein bars, protein powders or drinks. The i-qube Nootropic entry remains because the [manufacturer identifies it as a beverage](https://iqube-nootropic.com/i-qube/). Coffee capsules also remain. No remaining packaged entry was tagged pet food or cosmetics. Categories are incomplete: 4,592 packaged entries have an unknown top-level PNNS group. Title screening, source categories and source identity checks support this review; they do not certify every unidentified product.

Eight approved exclusions are retained IDs in existing generic consolidation rules. Their exclusions run after existing merges, preserving those dependencies and preventing previously merged source records from reappearing.

## Products within 5%

[Exact list of 26 consolidated records, retained IDs and differences](proposed-profile-merges.csv).

The user selected the limit for every reported nutrient, including vitamins and minerals. The approved groups satisfy that rule across all 45 catalogue nutrient fields. Unknown and reported values must have the same coverage; zero is distinct from unknown. Source total fat and carbohydrate amounts are also checked, and all additional unrounded source nutrition values reported by both products agree within 5%.

The difference is `abs(a - b) / min(a, b)`. A zero can match only zero. There is no absolute rounding allowance. Every pair within a group must qualify, which prevents a chain of individually close products from exceeding 5%. Reviewed source-profile differences range up to 5%.

The groups include plain milk with matching fat percentages, lactose-free milk, kefir, traditional cow-milk yogurt, goat-milk yogurt, sliced Gouda, light Gouda, grated Parmigiano Reggiano, halloumi, corn oil, oat flakes, wheat tortillas, protein tortillas, wheat rusks, country-style filo, smoked salmon, smoked turkey, salami, vanilla pudding and chocolate dairy desserts.

The review screened 173 candidate pairs using names, Greek search terms and nutrition. Matching nutrition alone is insufficient: different flavours, cuts, cooking methods, lactose status, fortification and declared ingredient formulations remain separate. For example, the two Hellmann's light mayonnaises have matching displayed nutrients but different oil and egg formulations, so they are excluded from the merge groups. This pass kept pasta shapes and grated versus sliced cheese distinct. The user later accepted shared pasta shapes and rice varieties; their searchable notes are documented in the fortification review. Products without enough identifying detail remain unresolved.

Each group keeps one complete source profile, with no averaging or nutrient filling. The shared display titles describe the shared food; original product names and Greek terms remain searchable. Exact source-row, product-identity and raw source-nutrition guards stop a rebuild when reviewed source data changes. This pass enforced the 5% limit on its new groups only. The later commit audit confirms that inherited rules do not satisfy that limit; their earlier approval does not establish compliance with the current policy.

## Verification and release

After this pass the catalogue contained 3,527 USDA, 2,022 CIQUAL and 7,686 Open Food Facts entries. All retained nutrient values were unchanged. Only the 24 shared display names and their search aliases changed; other retained names and keywords were unchanged. The later water review is documented separately.

After this pass the missing-sugar list contained 1,508 foods, including 1,497 tentative guesses and 11 entries without enough identity information for a useful estimate. Nineteen removed records disappeared from this list in this pass. The later [generic staple review](generic-staples.md) reduced the list to 1,507. Retained guesses are unchanged; comparison IDs follow merged profiles where applicable.

The 52 importer tests and 177 application tests passed. Importer checks cover the exact 5% boundary, micronutrients, small amounts, zero versus unknown, transitive chains, source changes, exclusions of retained IDs and aliases alongside reviewed Greek terms. Two complete rebuilds from cached source archives produced identical catalogue bytes. Search checks cover the merged names and brands.

The approved release covers the accumulated relevance exclusions and these product consolidations. Linux and connected Android installation results are reported separately at release time. Personal event logs are preserved; normal appends from the running app remain intact. Existing translation and sugar review queues remain unresolved where already documented.
