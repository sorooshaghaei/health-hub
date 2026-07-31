from rest_framework import serializers

from .normalization import normalize_name
from .models import Patient
from .phone import normalize_phone


class PatientSerializer(serializers.ModelSerializer):
    confirm_duplicate = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Patient
        fields = [
            "id",
            "full_name",
            "gender",
            "country_calling_code",
            "phone_number",
            "phone_e164",
            "date_of_birth",
            "patient_note",
            "confirm_duplicate",
        ]
        read_only_fields = ["id", "phone_e164"]

    def validate_full_name(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Full name is required.")
        if not normalize_name(value):
            raise serializers.ValidationError("Enter a valid full name.")
        return value

    def validate_patient_note(self, value):
        return value.strip()

    def validate(self, attrs):
        instance = self.instance
        country_calling_code = attrs.get(
            "country_calling_code",
            instance.country_calling_code if instance else "+98",
        )
        phone_number = attrs.get(
            "phone_number",
            instance.phone_number if instance else "",
        )
        calling_code, national_number, e164 = normalize_phone(
            country_calling_code,
            phone_number,
        )
        attrs["country_calling_code"] = calling_code
        attrs["phone_number"] = national_number
        attrs["phone_e164"] = e164
        return attrs


class PatientMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            "id",
            "full_name",
            "gender",
            "phone_e164",
            "date_of_birth",
        ]
