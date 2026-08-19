from datetime import timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from accounts.models import StaffUser
from accounts.permissions import active_workspace_role
from patients.serializers import PatientSerializer

from .models import UNDO_WINDOW_SECONDS, Visit


class SameDayAppointmentConflict(APIException):
    status_code = 409
    default_code = "same_day_appointment_exists"

    def __init__(self, detail):
        # Keep booleans and nested appointment data as native JSON values.
        # APIException normally converts every leaf into ErrorDetail strings.
        self.detail = detail


def conflicting_same_day_appointment(
    *,
    clinic_id,
    patient_id,
    date,
    exclude_visit_id=None,
):
    queryset = Visit.all_objects.select_related("patient").filter(
        clinic_id=clinic_id,
        patient_id=patient_id,
        date=date,
    )
    if exclude_visit_id is not None:
        queryset = queryset.exclude(pk=exclude_visit_id)

    active = queryset.filter(deleted_at__isnull=True).order_by("created_at").first()
    if active is not None:
        return active

    cutoff = timezone.now() - timedelta(seconds=UNDO_WINDOW_SECONDS)
    return (
        queryset.filter(deleted_at__gte=cutoff)
        .order_by("-deleted_at", "created_at")
        .first()
    )


class VisitSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(write_only=True, required=False)
    new_patient = serializers.DictField(write_only=True, required=False)
    patient = serializers.SerializerMethodField()
    can_delete = serializers.BooleanField(read_only=True)
    can_check_in = serializers.BooleanField(read_only=True)
    is_future = serializers.BooleanField(read_only=True)
    check_in_undo_until = serializers.DateTimeField(read_only=True)
    with_doctor_undo_until = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Visit
        fields = [
            "id",
            "date",
            "scheduled_time",
            "reason",
            "patient_id",
            "new_patient",
            "patient",
            "status",
            "checked_in_at",
            "with_doctor_at",
            "doctor_finished_at",
            "check_in_undo_until",
            "with_doctor_undo_until",
            "can_check_in",
            "can_delete",
            "is_future",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "checked_in_at",
            "with_doctor_at",
            "doctor_finished_at",
            "created_at",
            "updated_at",
        ]

    def to_internal_value(self, data):
        if "visit_type" in data:
            raise serializers.ValidationError(
                {"visit_type": "Appointment payloads do not accept visit_type."}
            )
        return super().to_internal_value(data)

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

        if instance is not None and instance.status != Visit.Status.PLANNED:
            if "date" in attrs and attrs["date"] != instance.date:
                raise serializers.ValidationError(
                    {"date": "The appointment date cannot change after check-in."}
                )
            if supplied_new_patient:
                raise serializers.ValidationError(
                    {"new_patient": "The Patient cannot change after check-in."}
                )
            if supplied_patient_id and attrs["patient_id"] != instance.patient_id:
                raise serializers.ValidationError(
                    {"patient_id": "The Patient cannot change after check-in."}
                )

        return attrs

    def _raise_same_day_conflict(self, conflict):
        raise SameDayAppointmentConflict(
            {
                "code": "same_day_appointment_exists",
                "detail": "This Patient already has an appointment on this date.",
                "appointment": self.__class__(
                    conflict,
                    context=self.context,
                ).data,
                "recently_deleted": conflict.deleted_at is not None,
                "undo_until": conflict.delete_undo_until,
            }
        )

    def _ensure_one_appointment_per_date(
        self,
        *,
        clinic_id,
        patient_id,
        date,
        exclude_visit_id=None,
    ):
        conflict = conflicting_same_day_appointment(
            clinic_id=clinic_id,
            patient_id=patient_id,
            date=date,
            exclude_visit_id=exclude_visit_id,
        )
        if conflict is not None:
            self._raise_same_day_conflict(conflict)

    def create(self, validated_data):
        validated_data.pop("patient_id", None)
        validated_data.pop("new_patient", None)
        clinic = validated_data["clinic"]
        patient = validated_data["patient"]
        date = validated_data["date"]

        self._ensure_one_appointment_per_date(
            clinic_id=clinic.pk,
            patient_id=patient.pk,
            date=date,
        )

        visit = Visit(**validated_data)
        try:
            with transaction.atomic():
                visit.save()
        except IntegrityError:
            conflict = conflicting_same_day_appointment(
                clinic_id=clinic.pk,
                patient_id=patient.pk,
                date=date,
            )
            if conflict is not None:
                self._raise_same_day_conflict(conflict)
            raise
        return visit

    def update(self, instance, validated_data):
        validated_data.pop("patient_id", None)
        validated_data.pop("new_patient", None)
        patient = validated_data.get("patient", instance.patient)
        date = validated_data.get("date", instance.date)

        self._ensure_one_appointment_per_date(
            clinic_id=instance.clinic_id,
            patient_id=patient.pk,
            date=date,
            exclude_visit_id=instance.pk,
        )

        previous_patient_id = instance.patient_id
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if instance.patient_id != previous_patient_id:
            instance.capture_patient_snapshot()

        try:
            with transaction.atomic():
                instance.save()
        except IntegrityError:
            conflict = conflicting_same_day_appointment(
                clinic_id=instance.clinic_id,
                patient_id=instance.patient_id,
                date=instance.date,
                exclude_visit_id=instance.pk,
            )
            if conflict is not None:
                self._raise_same_day_conflict(conflict)
            raise
        return instance

    def get_patient(self, obj):
        patient = obj.patient
        if patient.deleted_at is None:
            return {**PatientSerializer(patient).data, "active": True}
        return {
            "id": str(patient.id),
            "full_name": obj.patient_full_name_snapshot,
            "gender": obj.patient_gender_snapshot,
            "country_calling_code": None,
            "phone_number": None,
            "phone_e164": obj.patient_phone_snapshot,
            "date_of_birth": obj.patient_date_of_birth_snapshot,
            "patient_note": "",
            "active": False,
        }


class QueueVisitSerializer(VisitSerializer):
    queue_position = serializers.IntegerField(read_only=True)

    class Meta(VisitSerializer.Meta):
        fields = [
            "id",
            "queue_position",
            "scheduled_time",
            "reason",
            "patient",
            "status",
            "checked_in_at",
        ]

    def get_patient(self, obj):
        patient = super().get_patient(obj)
        patient.pop("patient_note", None)
        request = self.context.get("request")
        if request is not None and active_workspace_role(request) == StaffUser.Role.DOCTOR:
            patient.pop("country_calling_code", None)
            patient.pop("phone_number", None)
            patient.pop("phone_e164", None)
        return patient
