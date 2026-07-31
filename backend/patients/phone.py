import re
import unicodedata

from rest_framework import serializers

CALLING_CODE_PATTERN = re.compile(r"^\+[1-9]\d{0,3}$")
PHONE_FORMATTING_PATTERN = re.compile(r"[\s().-]+")

# Phase 1 requires country-code-aware validation without adding an external
# phone-number dependency. The approved +98 default receives an exact national
# length rule; a few common codes receive equally stable length rules, and all
# other valid calling codes fall back to E.164 length validation.
TRUNK_ZERO_CODES = {"+33", "+44", "+49", "+90", "+98", "+971"}

NATIONAL_LENGTHS = {
    "+1": (10, 10),
    "+33": (9, 9),
    "+44": (9, 10),
    "+49": (7, 11),
    "+90": (10, 10),
    "+98": (10, 10),
    "+971": (8, 9),
}


def normalize_digits(value):
    normalized = unicodedata.normalize("NFKC", str(value or ""))
    return "".join(str(unicodedata.digit(char)) if char.isdigit() else char for char in normalized)


def normalize_calling_code(value):
    calling_code = PHONE_FORMATTING_PATTERN.sub("", normalize_digits(value).strip())
    if calling_code.startswith("00"):
        calling_code = f"+{calling_code[2:]}"
    if not CALLING_CODE_PATTERN.fullmatch(calling_code):
        raise serializers.ValidationError("Choose a valid country calling code, such as +98.")
    return calling_code


def normalize_phone(country_calling_code, phone_number):
    calling_code = normalize_calling_code(country_calling_code)
    raw = PHONE_FORMATTING_PATTERN.sub("", normalize_digits(phone_number).strip())

    if raw.startswith("00"):
        raw = f"+{raw[2:]}"
    if raw.startswith("+"):
        if not raw.startswith(calling_code):
            raise serializers.ValidationError(
                "The phone number country code must match the selected calling code."
            )
        raw = raw[len(calling_code) :]

    if calling_code in TRUNK_ZERO_CODES and raw.startswith("0"):
        raw = raw[1:]
    if not raw.isdigit() or not raw:
        raise serializers.ValidationError("Enter a valid national phone number.")

    minimum, maximum = NATIONAL_LENGTHS.get(calling_code, (6, 14))
    if not minimum <= len(raw) <= maximum:
        if minimum == maximum:
            message = f"Phone numbers for {calling_code} must contain {minimum} national digits."
        else:
            message = (
                f"Phone numbers for {calling_code} must contain between "
                f"{minimum} and {maximum} national digits."
            )
        raise serializers.ValidationError(message)

    e164 = f"{calling_code}{raw}"
    if len(e164) > 16:
        raise serializers.ValidationError("The international phone number is too long.")
    return calling_code, raw, e164
