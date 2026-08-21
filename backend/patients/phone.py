from rest_framework import serializers

from health_hub.phone_numbers import normalize_patient_phone


def normalize_phone(country_calling_code, phone_number):
    try:
        return normalize_patient_phone(country_calling_code, phone_number)
    except ValueError as exc:
        raise serializers.ValidationError(str(exc)) from exc
