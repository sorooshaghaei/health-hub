from django.utils import timezone
from rest_framework import serializers

from .models import Visit


class VisitSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(write_only=True, required=False)
    new_patient = serializers.DictField(write_only=True, required=False)
    patient = serializers.SerializerMethodField()
    can_delete = serializers.BooleanField(read_only=True)
    is_future = serializers.BooleanField(read_only=True)

    class Meta:
        model = Visit
        fields = [
            "id",
            "visit_type",
            "date",
            "scheduled_time",
            "reason",
            "patient_id",
            "new_patient",
            "patient",
            "can_delete",
            "is_future",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_reason(self, value):
        return value.strip()

    def validate(self, attrs):
        instance = self.instance
        supplied_patient_id = "patient_id" in attrs
        supplied_new_patient = "new_patient" in attrs

        if instance is None and supplied_patient_id == supplied_new_patient:
            raise serializers.ValidationError(
                "Choose one existing patient or create one new patient."
            )
        if instance is not None and supplied_patient_id and supplied_new_patient:
            raise serializers.ValidationError(
                "Choose one existing patient or create one new patient."
            )

        visit_type = attrs.get(
            "visit_type",
            instance.visit_type if instance else None,
        )
        if instance is not None and "visit_type" in attrs and visit_type != instance.visit_type:
            raise serializers.ValidationError(
                {"visit_type": "Visit type cannot be changed after creation."}
            )

        if visit_type == Visit.Type.APPOINTMENT:
            date = attrs.get("date", instance.date if instance else None)
            scheduled_time = attrs.get(
                "scheduled_time",
                instance.scheduled_time if instance else None,
            )
            if date is None:
                raise serializers.ValidationError({"date": "Appointment date is required."})
            if scheduled_time is None:
                raise serializers.ValidationError(
                    {"scheduled_time": "Scheduled time is required."}
                )
        elif visit_type == Visit.Type.WALK_IN:
            attrs["date"] = instance.date if instance else timezone.localdate()
            attrs["scheduled_time"] = None
            attrs["reason"] = ""
        else:
            raise serializers.ValidationError(
                {"visit_type": "Choose Appointment or Walk-in."}
            )

        return attrs

    def create(self, validated_data):
        validated_data.pop("patient_id", None)
        validated_data.pop("new_patient", None)
        visit = Visit(**validated_data)
        visit.save()
        return visit

    def update(self, instance, validated_data):
        validated_data.pop("patient_id", None)
        validated_data.pop("new_patient", None)
        previous_patient_id = instance.patient_id
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if instance.patient_id != previous_patient_id:
            instance.capture_patient_snapshot()
        instance.save()
        return instance

    def get_patient(self, obj):
        patient = obj.patient
        if patient.deleted_at is None:
            return {
                "id": str(patient.id),
                "full_name": patient.full_name,
                "gender": patient.gender,
                "phone_e164": patient.phone_e164,
                "date_of_birth": patient.date_of_birth,
                "active": True,
            }
        return {
            "id": str(patient.id),
            "full_name": obj.patient_full_name_snapshot,
            "gender": obj.patient_gender_snapshot,
            "phone_e164": obj.patient_phone_snapshot,
            "date_of_birth": obj.patient_date_of_birth_snapshot,
            "active": False,
        }
