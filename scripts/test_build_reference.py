"""Regression checks for the reference-food import, using small source archives."""

import csv
import gzip
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import build_reference as build


class ReferenceImportTests(unittest.TestCase):
    def test_keywords_remove_repeated_english_and_brand_translations(self):
        self.assertEqual(build.clean_keywords('Mini pick crackers (Papadopoulou)',
                                             ['Mini pick crackers (Παπαδοπούλου)', 'κράκερ',
                                              'Mini pick κράκερ', 'ΚΡΑΚΕΡ'], True), ['κράκερ'])
        self.assertEqual(build.clean_keywords('Coffee with milk', ['καφές with γάλα']),
                         ['καφές γάλα'])
        self.assertEqual(build.clean_keywords('Χυμός πορτοκάλι', ['Χυμός πορτοκάλι']), [])
        self.assertEqual(build.clean_keywords('Γάλα 2% lactose free', ['γάλα χωρίς λακτόζη']),
                         ['γάλα χωρίς λακτόζη'])

    def test_close_duplicates_preserve_every_nutrient_and_unknown(self):
        row = self.normalize(calcium=100)
        close = row[:]
        close[4] += 1
        close[5] += .1
        close[11] += .5
        self.assertTrue(build.close_nutrients(row, close))
        self.assertEqual(build.deduplicate([row, close]), [row])
        unknown = row[:]
        unknown[6] = None
        self.assertFalse(build.close_nutrients(row, unknown))
        self.assertFalse(build.close_nutrients(row, self.normalize(calcium=110)))

    def test_close_nutrition_alone_does_not_merge_different_foods(self):
        row = self.normalize()
        other = [row[0], '2', 'Unrelated food', *row[3:]]
        self.assertEqual(build.deduplicate([row, other]), [row, other])
        salty = [row[0], '3', 'Food with salt without fat', *row[3:]]
        fatty = [row[0], '4', 'Food without salt with fat', *row[3:]]
        self.assertEqual(build.deduplicate([salty, fatty]), [salty, fatty])

    def test_curate_filters_slavic_products_and_applies_reviewed_merges(self):
        row = ['off', '1', 'Yogurt', *self.normalize()[3:]]
        same = ['off', '2', 'Greek yogurt', *row[3:]]
        slavic = ['off', '3', 'Кефир (Brand)', *row[3:]]
        polish = ['off', '4', 'Chleb magnat', *row[3:]]
        corrected = ['off', '5', 'Stawberry yogurt', *row[3:]]
        rules = {'excludeNames': ['Chleb magnat'], 'duplicates': {'off-2': 'off-1'},
                 'names': {'off-5': 'Strawberry yogurt'}}
        self.assertEqual(build.curate([row, same, slavic, polish, corrected], rules),
                         [row, ['off', '5', 'Strawberry yogurt', *row[3:]]])
        self.assertEqual(corrected[2], 'Stawberry yogurt')

    def test_reviewed_merge_fails_if_source_nutrients_drift(self):
        row = self.normalize()
        different = ['usda', '2', 'Other name', *self.normalize(calcium=200)[3:]]
        with self.assertRaisesRegex(ValueError, 'no longer matches'):
            build.curate([row, different], {'duplicates': {'usda-2': 'usda-1'}})

    def test_reviewed_nutrient_corrections_are_guarded_and_repeatable(self):
        row = self.normalize()
        rules = {'nutrients': {'usda-1': {'fiber': {'from': 1, 'to': 2.8}}}}
        corrected = build.curate([row], rules)
        self.assertEqual(corrected[0][6], 2.8)
        self.assertEqual(row[6], 1)
        self.assertEqual(build.curate(corrected, rules), corrected)
        with self.assertRaisesRegex(ValueError, 'nutrient no longer matches'):
            build.curate([self.normalize(fiber=3)], rules)
        rules['nutrients']['usda-1']['fiber']['to'] = None
        self.assertIsNone(build.curate([row], rules)[0][6])

    def test_reviewed_merges_keep_known_micronutrients_and_reject_lost_values(self):
        sparse = self.normalize()
        richer = ['usda', '2', 'Other package', *self.normalize(calcium=120)[3:]]
        rules = {'compatibleDuplicates': {'usda-1': 'usda-2'}}
        self.assertEqual(build.curate([sparse, richer], rules), [richer])
        # Automatic deduplication still keeps unknown and reported micronutrients distinct.
        self.assertEqual(build.deduplicate([sparse, richer]), [sparse, richer])
        with self.assertRaisesRegex(ValueError, 'duplicate no longer matches'):
            build.curate([richer, sparse], {'compatibleDuplicates': {'usda-2': 'usda-1'}})
        with self.assertRaisesRegex(ValueError, 'duplicate no longer matches'):
            build.curate([self.normalize(calcium=0), richer], rules)
        with self.assertRaisesRegex(ValueError, 'duplicate no longer matches'):
            build.curate([self.normalize(prot=20), richer], rules)

    def test_reviewed_merges_allow_one_mg_sodium_rounding_only(self):
        row = self.normalize(sodium=47)
        rounded = ['usda', '2', 'Other package', *self.normalize(sodium=48)[3:]]
        rules = {'compatibleDuplicates': {'usda-1': 'usda-2'}}
        self.assertFalse(build.close_nutrients(row, rounded))
        self.assertEqual(build.curate([row, rounded], rules), [rounded])
        with self.assertRaisesRegex(ValueError, 'duplicate no longer matches'):
            build.curate([self.normalize(sodium=45), rounded], rules)

    def test_reviewed_identities_keep_one_whole_profile_despite_source_differences(self):
        canonical = self.normalize(calcium=120)
        duplicate = ['ciqual', '2', 'Different source name',
                     *self.normalize(kcal=110, prot=4, calcium=100, iodine=5)[3:]]
        rules = {'identityDuplicates': [{
            'canonical': 'usda-1',
            'expectedRows': {f'{row[0]}-{row[1]}': build.row_fingerprint(row)
                             for row in [canonical, duplicate]},
        }]}
        result = build.curate([canonical, duplicate], rules)
        self.assertEqual(result, [canonical])
        self.assertIsNone(self.micro(result[0], 'iodine'))
        self.assertEqual(build.curate(result, rules), result)
        self.assertEqual(build.curate([], rules), [])
        # Neither a renamed preparation nor changed/missing nutrients pass the review.
        for row_index, column, value in [(0, 4, 101), (1, 2, 'Cooked version'),
                                         (1, 6, None), (1, 11, 101)]:
            changed = [canonical[:], duplicate[:]]
            changed[row_index][column] = value
            with self.subTest(row=row_index, column=column), \
                 self.assertRaisesRegex(ValueError, 'food identity no longer matches'):
                build.curate(changed, rules)
        with self.assertRaisesRegex(ValueError, 'food identity no longer matches'):
            build.curate([duplicate], rules)

    def test_generics_merge_one_type_within_ten_percent_and_stop_when_a_member_drifts(self):
        canonical = self.normalize(kcal=360, prot=12, fiber=3, sugar=3.5)
        brand = ['off', '2', 'Penne (Brand)', *self.normalize(kcal=352, prot=13, fiber=3.4, sugar=2.6)[3:]]
        rules = {'generics': [{'canonical': 'usda-1', 'name': 'Pasta, dry', 'members': ['off-2']}]}
        result = build.curate([canonical, brand], rules)
        self.assertEqual([row[1] for row in result], ['1'])
        self.assertEqual(result[0][2], 'Pasta, dry')
        self.assertEqual(result[0][4:], canonical[4:])
        self.assertEqual(canonical[2], 'Example food')
        self.assertEqual(build.curate(result, rules), result)
        for changed in [dict(kcal=420), dict(prot=20), dict(fiber=7)]:
            drifted = ['off', '2', 'Penne (Brand)',
                       *self.normalize(**{'kcal': 352, 'prot': 13, 'fiber': 3.4, 'sugar': 2.6, **changed})[3:]]
            with self.subTest(changed=changed), self.assertRaisesRegex(ValueError, 'generic no longer matches'):
                build.curate([canonical, drifted], rules)
        with self.assertRaisesRegex(ValueError, 'generic no longer matches'):
            build.curate([brand], rules)

    def test_cut_groups_keep_listed_foods_and_rows_a_merge_retained(self):
        row = lambda food_id, group: ['usda', food_id, f'Food {food_id}', group, *self.normalize()[4:]]
        rules = {'dropGroups': {'usda': ['Baby Foods']}, 'keepFoods': ['usda-2'],
                 'generics': [{'canonical': 'usda-3', 'members': ['usda-5']}]}
        foods = [row('1', 'Baby Foods'), row('2', 'Baby Foods'), row('3', 'Baby Foods'), row('4', 'Dairy'), row('5', 'Dairy')]
        self.assertEqual([food[1] for food in build.curate(foods, rules)], ['2', '3', '4'])
        self.assertEqual(len(build.curate([['ciqual', *row('1', 'Baby Foods')[1:]]], rules)), 1)

    def test_salted_rows_go_only_when_an_unsalted_twin_exists_and_they_are_not_kept(self):
        row = lambda food_id, name: ['usda', food_id, name, 'Vegetables', *self.normalize()[4:]]
        foods = [row('1', 'Beets, boiled, with salt'), row('2', 'Beets, boiled, without salt'),
                 row('3', 'Corn, with salt'), row('4', 'Nuts, with salt added'), row('5', 'Nuts, without salt added')]
        result = build.curate(foods, {'keepFoods': ['usda-4']})
        self.assertEqual([food[1] for food in result], ['2', '3', '4', '5'])

    def test_generic_aliases_join_identity_aliases_on_the_retained_id(self):
        rules = {'identityDuplicates': [{'canonical': 'usda-1', 'aliases': ['Pasta, dry, enriched']}],
                 'generics': [{'canonical': 'usda-1', 'members': [], 'aliases': ['Misko', 'πένες']}]}
        self.assertEqual(build.merged_names(rules), {'usda-1': ['Pasta, dry, enriched', 'Misko', 'πένες']})

    def test_placeholder_fatty_acids_fall_back_to_total_fat(self):
        estimates = set()
        values = {**self.values(), 'fat': 30.7, 'sat': 10.7, 'mufa': 0, 'pufa': 0}
        row = build.normalize('off', '1', 'Spread', 'Group', values, estimates)
        self.assertEqual(row[7:9], [10.7, 20.0])
        self.assertEqual(estimates, {'off-1'})
        label = lambda **changes: build.normalize('off', '1', 'Spread', 'Group', {**self.values(), **changes})
        self.assertEqual(label(fat=35, sat=22, mufa=.04, pufa=.005)[8], 13)
        self.assertEqual(label(fat=63, sat=0, mufa=0, pufa=0)[7:9], [None, None])
        # Fatty acids that nearly account for the fat are real, and a stated value is kept.
        self.assertEqual(label(fat=20, sat=5, mufa=7, pufa=4)[8], 11)
        self.assertEqual(label(fat=30, sat=5, unsat=10, mufa=0, pufa=0)[8], 10)
        # Composition tables report these columns as measured.
        self.assertEqual(self.normalize(fat=20, sat=5, mufa=3, pufa=1)[8], 4)

    def test_off_drops_impossible_micronutrients_but_tables_keep_real_extremes(self):
        row = self.off_rows([{'vitamin-b12_100g': '4.6875', 'selenium_100g': '2.2', 'calcium_100g': '.12'}])[0]
        self.assertIsNone(self.micro(row, 'vitaminB12'))
        self.assertIsNone(self.micro(row, 'selenium'))
        self.assertEqual(self.micro(row, 'calcium'), 120)
        self.assertEqual(self.micro(self.normalize(iodine=494000), 'iodine'), 494000)

    def test_identity_removal_does_not_uncover_an_automatic_equivalent(self):
        canonical = self.normalize()
        removed = ['ciqual', '2', 'Other name', *self.normalize(kcal=110)[3:]]
        equivalent = ['ciqual', '3', 'Other-name', *removed[3:]]
        rules = {'identityDuplicates': [{
            'canonical': 'usda-1',
            'expectedRows': {f'{row[0]}-{row[1]}': build.row_fingerprint(row)
                             for row in [canonical, removed]},
        }]}
        self.assertEqual(build.curate([canonical, removed, equivalent], rules), [canonical])

    def test_identity_aliases_are_searchable_only_on_the_retained_id(self):
        rows = [['usda', '1', 'Kiwifruit, green, raw', 'fruit', 61],
                ['off', '2', 'Kiwifruit, green, raw', 'fruit', 58]]
        keywords = build.reference_keywords(rows, {}, {'usda-1': ['Kiwi fruit', 'Ακτινίδιο']})
        self.assertEqual(keywords, {'usda-1': ['Kiwi fruit', 'Ακτινίδιο']})
        yogurt = [['off', '3', 'ΦΑΓΕ Total 5%', 'dairy', 93]]
        keywords = build.reference_keywords(yogurt, {}, {
            'off-3': ['Total 5% Greek Yogurt (FAGE)'],
        })
        self.assertIn('FAGE', ' '.join(keywords['off-3']).split())

    def test_rebuild_does_not_uncover_an_exact_copy_of_a_removed_product(self):
        row = ['off', '5201125003609', 'Philadelphia Original Cream Cheesw', *self.normalize()[3:]]
        copy = ['off', 'unreviewed-copy', *row[2:]]
        canonical = ['off', '4000339697908', 'Philadelphia Original', *row[3:]]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'reference.json'
            with patch.object(build, 'usda', return_value=[]), \
                 patch.object(build, 'ciqual', return_value=[]), \
                 patch.object(build, 'off', return_value=[row, copy, canonical]):
                build.main(None, None, None, path)
            data = json.loads(path.read_text())
            self.assertEqual(data['foods'], [canonical])
            self.assertNotIn('namesToReview', data)

    def test_keywords_follow_exact_names_without_modifying_rows(self):
        rows = [['usda', '1', 'Milk', 'dairy', 60], ['off', '2', 'Milk', 'packaged', 61],
                ['ciqual', '3', 'Milk chocolate', 'sweets', 530]]
        before = [row[:] for row in rows]
        self.assertEqual(build.reference_keywords(rows, {'Milk': ['γάλα']}),
                         {'usda-1': ['γάλα'], 'off-2': ['γάλα']})
        self.assertEqual(rows, before)

    def values(self):
        return dict(kcal=100, prot=5, fiber=1, sat=1, mufa=.6, pufa=.3,
                    fat=2, carbs=15, salt=.5, sugar=4)

    def normalize(self, **changes):
        values = self.values()
        values.update(changes)
        return build.normalize('usda', '1', 'Example food', 'Example group', values)

    def micro(self, row, key):
        return row[11 + list(build.MICRO_UNITS).index(key)]

    def test_micronutrients_preserve_units_precision_zero_and_unknowns(self):
        row = self.normalize(calcium=120, vitaminB12=.0034, vitaminC=0, copper=.00002)
        self.assertEqual(row[:11], self.normalize()[:11])
        self.assertEqual(self.micro(row, 'calcium'), 120)
        self.assertEqual(self.micro(row, 'vitaminB12'), .0034)
        self.assertEqual(self.micro(row, 'vitaminC'), 0)
        self.assertEqual(self.micro(row, 'copper'), .00002)
        self.assertIsNone(self.micro(row, 'iron'))

    def test_invalid_micronutrients_stay_unknown_without_dropping_the_food(self):
        for key, value in [('calcium', -1), ('iron', float('nan')), ('vitaminD', float('inf')),
                           ('magnesium', 100001), ('vitaminB12', 100000001)]:
            with self.subTest(key=key, value=value):
                row = self.normalize(**{key: value})
                self.assertIsNotNone(row)
                self.assertIsNone(self.micro(row, key))

    def test_usda_reads_minerals_and_distinct_vitamin_forms(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'usda.zip'
            prefix = 'FoodData_Central_sr_legacy_food_csv_2018-04/'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr(prefix + 'food_category.csv', 'id,description\n1,Group\n')
                z.writestr(prefix + 'food.csv', 'fdc_id,description,food_category_id\n1,Food,1\n')
                z.writestr(prefix + 'food_nutrient.csv', 'fdc_id,nutrient_id,amount\n' + ''.join(
                    f'1,{code},{amount}\n' for code, amount in [
                        ('1008', 100), ('1093', 200), ('1087', 123), ('1099', 45),
                        ('1106', 50), ('1105', 20), ('1107', 360), ('1114', 2), ('1109', .03),
                        ('1177', 40), ('1186', 10), ('1187', 30), ('1190', 47), ('1178', .015)]))
            row = next(build.usda(path))
            self.assertEqual(row[9], .5)
            for key, amount in [('sodium', 200), ('calcium', 123), ('fluoride', .045),
                                ('vitaminARAE', 50), ('retinol', 20), ('betaCarotene', 360),
                                ('vitaminD', 2), ('vitaminEAlphaTocopherol', .03),
                                ('folate', 40), ('folicAcid', 10), ('folateFood', 30),
                                ('folateDFE', 47), ('vitaminB12', .015)]:
                with self.subTest(key=key):
                    self.assertEqual(self.micro(row, key), amount)
            self.assertIsNone(self.micro(row, 'vitaminA'))
            self.assertIsNone(self.micro(row, 'vitaminE'))

    def test_database_describes_every_numeric_column_in_order(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'reference.json'
            with patch.object(build, 'usda', return_value=[self.normalize(calcium=123)]), \
                 patch.object(build, 'ciqual', return_value=[]), \
                 patch.object(build, 'off', return_value=[]):
                build.main(None, None, None, path)
            data = json.loads(path.read_text())
            columns = data['nutrients']
            self.assertEqual([c['key'] for c in columns[:7]],
                             ['kcal', 'prot', 'fiber', 'satFat', 'unsatFat', 'salt', 'sugar'])
            self.assertEqual(len(data['foods'][0]), 4 + len(columns))
            values = {c['key']: (c['unit'], value) for c, value in zip(columns, data['foods'][0][4:])}
            self.assertEqual(values['calcium'], ('mg', 123))
            self.assertEqual(values['vitaminB12'], ('ug', None))

    def test_rejects_invalid_source_nutrients(self):
        for key, value in [('sugar', 1350), ('fiber', 50000), ('salt', 6500),
                           ('prot', -1), ('kcal', float('nan')), ('kcal', float('inf'))]:
            with self.subTest(key=key, value=value):
                self.assertIsNone(self.normalize(**{key: value}))

    def test_rejects_inconsistent_fat_components(self):
        self.assertIsNone(self.normalize(fat=2.53, sat=.6, mufa=3.71, pufa=2.903))
        self.assertIsNone(self.normalize(fat=2, sat=4))
        self.assertIsNone(self.normalize(unsat=4))
        self.assertIsNone(self.normalize(fat=None, mufa=60, pufa=60))

    def test_rejects_impossible_sugar_and_component_totals(self):
        self.assertIsNone(self.normalize(sugar=20, carbs=15))
        self.assertIsNone(self.normalize(prot=60, fat=40, sugar=10))

    def test_estimates_missing_unsaturated_fat_and_records_its_origin(self):
        estimates = set()
        values = {**self.values(), 'mufa': None, 'pufa': None}
        row = build.normalize('usda', '1', 'Example food', 'Group', values, estimates)
        self.assertEqual(row[8], 1)
        self.assertEqual(estimates, {'usda-1'})
        self.assertEqual(self.normalize(mufa=.6, pufa=None)[8], 1)

    def test_database_lists_only_estimates_kept_after_deduplication(self):
        def source(path, estimates):
            values = {**self.values(), 'mufa': None, 'pufa': None}
            return [build.normalize('usda', key, 'Example food', 'Group', values, estimates)
                    for key in ['1', '2']]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'reference.json'
            with patch.object(build, 'usda', side_effect=source), \
                 patch.object(build, 'ciqual', return_value=[]), \
                 patch.object(build, 'off', return_value=[]):
                build.main(None, None, None, path)
            data = json.loads(path.read_text())
            self.assertEqual(len(data['foods']), 1)
            self.assertEqual(data['estimatedUnsatFat'], ['usda-1'])

    def test_preserves_reported_unsaturated_fat_and_complete_components(self):
        estimates = set()
        values = self.values()
        row = build.normalize('usda', '1', 'Example food', 'Group', values, estimates)
        self.assertEqual(row[8], .9)
        self.assertEqual(estimates, set())
        self.assertEqual(self.normalize(unsat=.8)[8], .8)

    def test_preserves_unknowns_without_enough_data_to_estimate(self):
        row = self.normalize(mufa=None, pufa=None, fiber=None, sugar=None, carbs=.2)
        self.assertIsNone(row[6])
        self.assertIsNone(row[10])
        self.assertIsNone(self.normalize(fat=None, mufa=None, pufa=None)[8])
        self.assertIsNone(self.normalize(sat=None, mufa=None, pufa=None)[8])
        self.assertIsNone(self.normalize(fat=.9, sat=1, mufa=None, pufa=None)[8])
        self.assertIsNone(self.normalize(fat=.2, sat=None, mufa=None, pufa=None)[7])

    def test_only_exact_zero_proves_missing_components_are_zero(self):
        row = self.normalize(fat=0, sat=None, mufa=None, pufa=None,
                             carbs=0, sugar=None, fiber=None)
        self.assertEqual([row[i] for i in [7, 8, 10]], [0, 0, 0])
        self.assertIsNone(row[6])

    def test_keeps_source_energy_factors_for_pure_fats(self):
        self.assertIsNotNone(self.normalize(kcal=902, prot=0, fat=100, sat=40,
                                           mufa=50, pufa=5, carbs=0, sugar=0))

    def off_rows(self, products, identities=None):
        columns = ['code', 'product_name', 'brands', 'generic_name', 'countries_tags',
                   'quantity', 'ingredients_text',
                   'data_quality_errors_tags', 'energy-kj_100g', 'energy-kcal_100g',
                   'proteins_100g', 'fiber_100g', 'saturated-fat_100g',
                   'monounsaturated-fat_100g', 'polyunsaturated-fat_100g',
                   'unsaturated-fat_100g', 'fat_100g', 'carbohydrates_100g',
                   'salt_100g', 'sugars_100g']
        columns += [key + '_100g' for key in build.OFF_MICROS]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'products.csv.gz'
            with gzip.open(path, 'wt') as f:
                writer = csv.DictWriter(f, fieldnames=columns, delimiter='\t')
                writer.writeheader()
                for i, product in enumerate(products):
                    row = dict.fromkeys(columns, '')
                    row.update(code=str(i), product_name='Example', brands='Brand',
                               countries_tags='en:greece', **{'energy-kcal_100g': '100',
                               'proteins_100g': '5', 'fat_100g': '2', 'carbohydrates_100g': '15',
                               'saturated-fat_100g': '1', 'sugars_100g': '4'})
                    row.update(product)
                    writer.writerow(row)
            return [r for r in build.off(path, identities=identities) if r]

    def test_product_identity_guards_ingredients_even_when_nutrients_are_unchanged(self):
        products = [{'code': '1', 'product_name': 'Plain yogurt',
                     'ingredients_text': 'milk, cream', 'quantity': '200g'},
                    {'code': '2', 'product_name': 'Plain yoghurt',
                     'ingredients_text': 'milk, cream', 'quantity': '1kg'}]
        identities = {}
        rows = self.off_rows(products, identities)
        rules = {'identityDuplicates': [{
            'canonical': 'off-1',
            'expectedRows': {f'{row[0]}-{row[1]}': build.row_fingerprint(row) for row in rows},
            'expectedProducts': identities.copy(),
        }]}
        self.assertEqual(build.curate(rows, rules, identities), [rows[0]])
        products[1]['ingredients_text'] = 'milk, cream, lactase'
        changed = self.off_rows(products, identities)
        self.assertEqual(changed, rows)
        with self.assertRaisesRegex(ValueError, 'product identity no longer matches'):
            build.curate(changed, rules, identities)
        with self.assertRaisesRegex(ValueError, 'product identity no longer matches'):
            build.curate(rows, rules)

    def test_off_converts_grams_to_mg_and_ug_and_keeps_vitamin_forms_separate(self):
        row = self.off_rows([{'calcium_100g': '.12', 'sodium_100g': '.2',
                              'vitamin-b12_100g': '.000000034', 'vitamin-c_100g': '0',
                              'vitamin-b9_100g': '.00001', 'folates_100g': '.00004',
                              'vitamin-a_100g': '.00005', 'vitamin-e_100g': '.00003',
                              'iron_100g': '-1', 'vitamin-d_100g': 'nan'}])[0]
        for key, amount in [('calcium', 120), ('sodium', 200), ('vitaminB12', .034),
                            ('vitaminC', 0), ('folicAcid', 10), ('folate', 40),
                            ('vitaminA', 50), ('vitaminE', .03)]:
            with self.subTest(key=key):
                self.assertEqual(self.micro(row, key), amount)
        for key in ['iron', 'vitaminD', 'vitaminARAE', 'vitaminEAlphaTocopherol', 'folateDFE']:
            self.assertIsNone(self.micro(row, key))

    def test_checks_product_name_before_appending_the_brand(self):
        rows = self.off_rows([
            {'code': '5208120000015', 'product_name': '5208120000015'},
            {'product_name': '', 'brands': 'Lidl'},
            {'product_name': '??????', 'brands': 'Royal'},
            {'product_name': '', 'generic_name': 'Green beans', 'brands': 'Bonduelle'},
            {'product_name': '85%', 'brands': 'Lindt'},
            {'product_name': '03', 'brands': 'Yam Tales'},
        ])
        self.assertEqual([r[2] for r in rows], ['Green beans (Bonduelle)', '85% (Lindt)', '03 (Yam Tales)'])

    def test_decodes_html_and_cleans_whitespace(self):
        rows = self.off_rows([{'product_name': '  Oats&amp;honey  &quot;bar&quot;  '}])
        self.assertEqual(rows[0][2], 'Oats&honey "bar" (Brand)')

    def test_rejects_source_nutrition_errors_but_keeps_unrelated_label_errors(self):
        rows = self.off_rows([
            {'data_quality_errors_tags': 'en:nutrition-value-total-over-105'},
            {'data_quality_errors_tags': 'en:energy-value-in-kcal-does-not-match-value-in-kj'},
            {'data_quality_errors_tags': 'en:vegan-label-but-non-vegan-ingredient'},
        ])
        self.assertEqual([r[1] for r in rows], ['2'])

    def test_rejects_unflagged_inconsistent_energy(self):
        rows = self.off_rows([{'energy-kj_100g': '418.4', 'energy-kcal_100g': '3'},
                              {'energy-kcal_100g': '3', 'sugars_100g': '87.3',
                               'carbohydrates_100g': '90'}])
        self.assertEqual(rows, [])

    def test_ciqual_preserves_bounds_and_recovers_complete_source_names(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'ciqual.zip'
            with zipfile.ZipFile(path, 'w') as z:
                z.writestr('alim_grp_test.xml', '<alim_grp_code>01</alim_grp_code><alim_grp_nom_eng>Group</alim_grp_nom_eng>')
                z.writestr('alim_2020.xml', '<alim_code>1</alim_code><alim_nom_eng>Food (truncated</alim_nom_eng><alim_nom_fr>Aliment (complet)</alim_nom_fr><alim_grp_code>01</alim_grp_code>')
                z.writestr('compo_test.xml', ''.join(f'<alim_code>1</alim_code><const_code>{code}</const_code><teneur>{value}</teneur>'
                                                    for code,value in [('328','100'), ('25000','5'), ('34100','< 3'), ('32000','traces'),
                                                                       ('10200','123,45'), ('10340','0,012'), ('10530','< 3'),
                                                                       ('52100','traces'), ('56600','-'), ('54101','2'),
                                                                       ('54104','0'), ('53100','0,01')]))
            row = next(build.ciqual(path))
            self.assertEqual(row[2], 'Aliment (complet)')
            self.assertIsNone(row[6])
            self.assertIsNone(row[10])
            for key, amount in [('calcium', 123.45), ('selenium', .012), ('vitaminK1', 2),
                                ('vitaminK2', 0), ('vitaminE', .01)]:
                with self.subTest(key=key):
                    self.assertEqual(self.micro(row, key), amount)
            for key in ['iodine', 'vitaminD', 'vitaminB12', 'vitaminEAlphaTocopherol', 'vitaminK']:
                self.assertIsNone(self.micro(row, key))

    def test_preserves_foods_with_identical_macros_but_different_micronutrients(self):
        row = self.normalize(calcium=100)
        different_micros = self.normalize(calcium=200)
        self.assertEqual(build.deduplicate([row, different_micros]), [row, different_micros])

    def test_only_collapses_equivalent_rows_within_the_same_source(self):
        row = self.normalize()
        equivalent = [row[0], '2', '  EXAMPLE   FOOD ', *row[3:]]
        different_values = [row[0], '3', row[2], row[3], 200, *row[5:]]
        different_source = ['ciqual', '1', *row[2:]]
        self.assertEqual(build.deduplicate([row, equivalent, different_values, different_source]),
                         [row, different_values, different_source])


if __name__ == '__main__':
    unittest.main()
