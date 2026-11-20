# Fortified foods and searchable pasta and rice variants

Reviewed on 2026-11-19. The user requested removal of fortified products when an unfortified variant exists, and accepted shared products for pasta shapes and rice varieties with the variants listed in notes and searchable.

The pass adds 142 explicit fortified/enriched exclusions. One hundred were visible in the preceding 13,211-food catalogue; the others were already hidden by older consolidation rules. Seven plain source profiles and one separately sweetened almond drink return after those rules are pruned. The catalogue now contains 13,119 foods: 3,483 USDA, 1,990 CIQUAL and 7,646 Open Food Facts records. There are 551 explicit exclusions across all review passes.

[Every fortified exclusion and its retained plain counterpart](fortified-exclusions.csv) is recorded, including whether the excluded record was previously visible. These are exclusions of fortified variants; they do not assert nutrient equivalence within 5%.

## Counterparts and source guards

The source review covered explicit fortification/enrichment descriptors and packaged ingredient lists. Matched types include flour, pasta, bread, rice, cereals, milk, plant drinks and desserts, cocoa drink powder, juices, chunky peanut butter, salt and Omega-3-enriched eggs. Preparation, flavour, sweetening, fat percentage and formulation were used to distinguish counterparts. Source descriptor matches and individual cross-language or packaged matches are explained in the CSV.

Each new exclusion identifies its plain counterpart by source ID and original source title. Packaged counterparts also have product-identity hashes covering their source label and ingredients. A rebuild stops if the counterpart disappears, changes identity or is removed by another curation rule. Required plain counterparts are protected from the final relevance filter.

Seven plain records previously swallowed by older rules are restored with their own complete source nutrients:

| ID | Plain source profile |
| --- | --- |
| usda-168927 | Dry unenriched pasta |
| usda-168933 | Unenriched semolina |
| usda-169756 | Raw unenriched long-grain white rice |
| usda-169761 | Unenriched all-purpose white wheat flour |
| usda-172217 | Whole milk, 3.25% fat, without added vitamins A/D |
| usda-172816 | Unenriched white pita |
| usda-173238 | Unenriched English muffins without calcium propionate |

The sweetened Carpos almond drink `off-5202178005640` also returns. An older rule had grouped it under an unsweetened almond drink. The unsweetened fortified product has an identified plain unsweetened counterpart and is excluded; no plain sweetened counterpart was established for the restored product, so it remains separately available.

Fortified products without an identified matching plain variant remain. Examples include some flavoured or light plant drinks, high-protein formulations and narrowly specified cereal preparations. An unspecified ingredient list cannot establish that a product is unfortified. Calcium used as a tofu coagulant and antioxidants in ordinary ingredient lists were not treated automatically as nutrient fortification. This review does not resolve every incomplete packaged-food label.

The producer confirms that its [Omega-3 eggs are nutritionally enriched through the hens' diet](https://afs.edu.gr/enischysi-tis-paragogis-o3-avgon-achyrona-stin-ags/). The enriched source record is excluded from the older ordinary-egg merge; ordinary eggs remain.

## Pasta and rice notes

Three existing shared products now carry visible notes and searchable variant aliases:

| Product | ID | Notes include |
| --- | --- | --- |
| Pasta, dry | off-5201010144776 | Spaghetti, fusilli, penne, linguine, orzo/kritharaki, pastitsio, lasagne, cannelloni and other represented shapes |
| Pasta, whole wheat, dry | off-5208046088289 | Whole-wheat spaghetti, fusilli, penne, orzo and other represented shapes |
| Rice, white, dry | off-5202576250024 | Glase, Carolina, nihaki, basmati, jasmine, arborio, sushi rice, parboiled/Bonnet and grain lengths |

The notes are copied into the reference food's note alongside its source identity. Original member titles and Greek terms are search aliases. Whole-wheat pasta remains a separate shared product from ordinary pasta. Brown rice and prepared foods keep their separate profiles. No further shape or variety records were merged in this pass.

The acceptance of shared shapes and varieties changes the semantic review decision. It does not waive the 5% nutrient limit. These inherited groups still contain source profiles outside that limit; the [commit audit](merge-audit.md) records the remaining policy gap.

## Sugar queue and verification

All retained catalogue rows and nutrient values are unchanged. Restored foods use complete source rows, with no averaging or nutrient filling. Seven removed fortified records leave the sugar queue and three restored plain records enter it. The [missing-sugar list](missing-sugar.csv) contains 1,503 unresolved foods: 1,492 tentative estimates and 11 without a useful estimate. The three new low-confidence guesses are semolina at 1 g/100 g, white pita at 1.3 g/100 g and English muffins at 4 g/100 g. Guesses remain outside the app's nutrient data. Existing retained guesses are unchanged, and comparison IDs point to retained foods.

All 53 importer tests and 17 reference/search tests passed. Sixty-five full-catalogue searches cover the previous 32 source-name aliases, retained variants, and 25 English/Greek pasta and rice searches. A complete source rebuild is byte-identical to `public/reference.json`; the production build passed and its reference data matches. Catalogue SHA-256: `ddb263aba129a5b02d8b70adc90f0862f2943edd4c237424c6ce16b106c58c50`.

Personal foods, recipes and history were not edited. There were no technical blockers. These follow-up changes remain uncommitted and undeployed; native UI behavior was not checked. Older cross-fat, species and formulation merges remain documented in the commit audit.
