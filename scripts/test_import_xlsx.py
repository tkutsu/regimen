"""Checks the researched sugar matches used to import personal foods."""

import unittest

import import_xlsx as importer


class SugarMatchesTest(unittest.TestCase):
    def test_product_matches_and_generic_estimates_use_the_bundled_source_values(self):
        reference = importer.load_reference()
        expected = {"finncrisps": 1.6, "cocopops": 22, "couscous-dry": 3, "dill": 1.2, "semolina-simigdali-dry": 1}
        for food_id, sugar in expected.items():
            with self.subTest(food=food_id):
                self.assertEqual(importer.sugar_for({"id": food_id}, None, reference), sugar)
                self.assertIn("sugar ", importer.SUGAR_NOTES[food_id])


if __name__ == "__main__":
    unittest.main()
