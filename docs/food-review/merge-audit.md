# Catalogue merge commit audit

Audited on 2026-11-19 after the user challenged whether different yogurt fat percentages and cheese types had been merged together. The follow-up fortification removals and pasta/rice notes are covered in the [fortification review](fortification-review.md).

The latest staple pass has four independent yogurt profiles and two independent cheese profiles. The earlier table grouped them by family only. There is no shared "Yogurt" row covering all four, and sliced Edam is separate from light cream cheese. Each profile merges only its reviewed source pair under the strict 5% check.

| Independent profile | Retained ID |
| --- | --- |
| Cow-milk yogurt, 3.9% fat | off-5208086450893 |
| Delta strained yogurt, 10% fat | off-5201037711807 |
| Plain strained yogurt, 0% fat | off-5202336111480 |
| Cow-milk yogurt, 2% fat | off-5202336035700 |
| Sliced Edam | off-5201415201197 |
| Light cream cheese | off-5206546002248 |

## Older merge policy does not satisfy the current limit

Commit `81c51ab` introduced 135 generic staple rules under a macro-only policy allowing 10% relative differences and absolute tolerances. Commit `3af8181` added 299 meat generic rules using that policy. The later translation/sugar commit `1060559` did not change it. Commit `1deeb6f` added a separate strict profile-merge mechanism; its checks did not retroactively validate older rules. The following uncommitted staple pass used that strict mechanism for another 16 pairs.

The older `same_type` function compares only seven macro fields reported by both rows. It permits the larger of 10% of the larger value or a nutrient-specific absolute allowance. It ignores micronutrients and known/unknown differences. Absolute allowances can permit differences much larger than 10%, particularly for salt, sugar and small fat values. This is incompatible with the user's current 5% policy across every reported nutrient.

The current source rebuild was instrumented to record actual member-to-retained comparisons. Results below describe the 13,119-food catalogue after the fortification cleanup. They count source-record relationships, not unique displayed foods or proven semantic errors.

| Applied rule family | Compared source relationships | Fail strict 5% across 45 catalogue fields |
| --- | ---: | ---: |
| Older generic rules | 1,461 | 1,443 |
| Older duplicate rules | 159 | 11 |
| Older compatible-duplicate rules | 7 | 6 |
| Current strict profile rules | 42 | 0 |

Of the 1,443 generic failures, 1,381 contain numeric differences beyond 5%; 62 fail only because reported/unknown coverage differs. The 11 older duplicate failures are numeric, and the six compatible-duplicate failures concern coverage. Configured identity-merge pairs were also inspected, but are excluded from these applied counts because automatic deduplication can remove their members first.

[All 1,460 applied relationships that fail the strict check](legacy-merge-limit-failures.csv) include source IDs, original names, introducing commit and failing nutrient fields. The 40 current strict profile groups (24 committed and 16 follow-up groups) pass the catalogue-field comparison for all 42 removed members. Their importer rules also preserve the previously reviewed source identity and raw nutrition guards.

## Confirmed semantic problems still present

| Older shared profile | Conflicting member | Finding |
| --- | --- | --- |
| Whole milk, 3.5%, off-5202336155699 | off-5208120000008 and off-5202382700003 | Explicit 3.7% milk was grouped under 3.5%. The underlying OFF fat values also report 3.7% and 3.72%. |
| Semi-skimmed milk, 1.5%, off-5201037508902 | Source records explicitly labelled 1.7% | Declared fat percentages differ. |
| Strained yogurt, 2%, off-5202178002793 | off-5202736900035 | Explicit cow-and-sheep-milk yogurt was grouped with the cow-milk profile. |
| Butter, off-5206546000176 | off-5202178082603 | Explicit goat butter was grouped with cow butters. |
| Feta, off-4056489150589 | off-5202178086182 | A Freelact lactose-free product was grouped with ordinary feta. The producer identifies [Freelact feta as lactose-free](https://www.olympos.gr/new/nantwich-international-cheese-awards/). |

These rules originated in `81c51ab`. They were not undone during the read-only commit audit. The separately authorized fortification cleanup did restore a plain 3.25% milk source and separate a sweetened almond drink from an unsweetened one. It also pruned fortified/unfortified groups where a plain counterpart was identified.

Two milk source titles say 5% while their nutrient fields say 3.5%; they are label conflicts requiring review, rather than proof that actual 5% milk was merged into 3.5%. The all-purpose-flour group also includes Farina and other names needing ingredient/label confirmation before deciding whether they are self-raising or bread-flour variants.

Pasta shapes and rice varieties are accepted shared product types under the latest user instruction. Their aliases and notes now expose the represented variants. Their older numerical differences still require review under the 5% policy. No new merge was authorized merely because a shape or variety differs.

## Outstanding repair

The audit establishes that the old rules need a separate repair: split meaningful fat, species, lactose and formulation differences, then restore or regroup source records that fail the strict nutrient limit. Replacing the older tolerance check alone would stop the catalogue rebuild; the affected rules and retained IDs must be reviewed together. The current follow-up leaves these older rules unchanged except for the authorized fortified-product removals.

No personal foods, recipes or historical entries were changed. The full rebuild reproduced the bundled data exactly. There were no technical blockers; the outstanding issue is the unrepaired older merge policy and its affected records.
