import re
import unicodedata

import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat


CALLING_CODE_PATTERN = re.compile(r"^\+[1-9]\d{0,3}$")


def normalize_digits(value):
    normalized = unicodedata.normalize("NFKC", str(value or ""))
    return "".join(
        str(unicodedata.digit(character)) if character.isdigit() else character
        for character in normalized
    )


def _international_input(value):
    normalized = normalize_digits(value).strip()
    if normalized.startswith("00"):
        normalized = f"+{normalized[2:]}"
    return normalized


def _parse_valid_number(value, region=None):
    try:
        number = phonenumbers.parse(value, region)
    except NumberParseException as exc:
        raise ValueError("Enter a valid phone number.") from exc
    if not phonenumbers.is_valid_number(number):
        raise ValueError("Enter a valid phone number.")
    return number


def normalize_international_phone(value):
    raw = _international_input(value)
    if not raw.startswith("+"):
        raise ValueError("Enter the phone number in international format beginning with +.")
    number = _parse_valid_number(raw)
    return phonenumbers.format_number(number, PhoneNumberFormat.E164)


def normalize_patient_phone(country_calling_code, phone_number):
    calling_code = re.sub(r"[\s().-]+", "", normalize_digits(country_calling_code).strip())
    if calling_code.startswith("00"):
        calling_code = f"+{calling_code[2:]}"
    if not CALLING_CODE_PATTERN.fullmatch(calling_code):
        raise ValueError("Choose a valid phone country or region.")

    numeric_calling_code = int(calling_code[1:])
    region = phonenumbers.region_code_for_country_code(numeric_calling_code)
    if region in {"001", "ZZ"}:
        raise ValueError("Choose a valid phone country or region.")

    raw_number = _international_input(phone_number)
    international = raw_number.startswith("+")
    number = _parse_valid_number(raw_number, None if international else region)
    if number.country_code != numeric_calling_code:
        raise ValueError("The phone number country code must match the selected country or region.")

    e164 = phonenumbers.format_number(number, PhoneNumberFormat.E164)
    national_number = e164[len(calling_code):]
    return calling_code, national_number, e164
