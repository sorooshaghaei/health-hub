from django.test import SimpleTestCase
from rest_framework import serializers

from accounts.services import normalize_staff_phone
from patients.phone import normalize_phone


class PhoneNormalizationTests(SimpleTestCase):
    def test_french_domestic_and_international_inputs_share_one_e164_value(self):
        expected = ("+33", "612345678", "+33612345678")
        self.assertEqual(normalize_phone("+33", "06 12 34 56 78"), expected)
        self.assertEqual(normalize_phone("+33", "6 12 34 56 78"), expected)
        self.assertEqual(normalize_phone("+33", "+33 6 12 34 56 78"), expected)

    def test_country_metadata_normalizes_other_supported_numbers(self):
        cases = [
            ("+98", "0912 123 4567", "+989121234567"),
            ("+1", "415 555 2671", "+14155552671"),
            ("+44", "020 7946 0958", "+442079460958"),
        ]
        for calling_code, national, expected_e164 in cases:
            with self.subTest(calling_code=calling_code):
                normalized = normalize_phone(calling_code, national)
                self.assertEqual(normalized[2], expected_e164)

    def test_selected_country_must_match_an_international_input(self):
        with self.assertRaisesMessage(
            serializers.ValidationError,
            "The phone number country code must match the selected country or region.",
        ):
            normalize_phone("+33", "+98 912 123 4567")

    def test_staff_phone_requires_valid_international_input_and_returns_e164(self):
        self.assertEqual(
            normalize_staff_phone("+33 6 12 34 56 78"),
            "+33612345678",
        )
        with self.assertRaisesMessage(ValueError, "international format beginning with +"):
            normalize_staff_phone("06 12 34 56 78")

    def test_possible_but_invalid_number_is_rejected(self):
        with self.assertRaises(serializers.ValidationError):
            normalize_phone("+33", "01 23")
