from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Clinic
from accounts.permissions import require_assistant_workspace
from patients.matching import possible_duplicate_patients
from patients.models import Patient
from patients.serializers import PatientSerializer
from patients.views import (
    clinic_for_staff,
    duplicate_candidate,
    possible_duplicate_response,
)

from .models import Visit
from .serializers import QueueVisitSerializer, VisitSerializer


def active_patient_for_clinic(clinic, patient_id):
    try:
        return Patient.objects.get(pk=patient_id, clinic=clinic)
    except Patient.DoesNotExist:
        raise NotFound("Patient not found.")


def prepared_new_patient(clinic, payload):
    serializer = PatientSerializer(data=payload)
    serializer.is_valid(raise_exception=True)
    confirmed = serializer.validated_data.pop("confirm_duplicate", False)
    matches = possible_duplicate_patients(
        clinic=clinic,
        candidate=duplicate_candidate(serializer),
    )
    return serializer, matches, confirmed


def active_visit_for_request(request, visit_id, *, lock=False):
    clinic = clinic_for_staff(request)
    queryset = Visit.objects.select_related("patient").filter(clinic=clinic)
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=visit_id)
    except Visit.DoesNotExist:
        raise NotFound("Appointment not found.")


def deleted_visit_for_request(request, visit_id, *, lock=False):
    clinic = clinic_for_staff(request)
    queryset = Visit.all_objects.select_related("patient").filter(
        clinic=clinic,
        deleted_at__isnull=False,
    )
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=visit_id)
    except Visit.DoesNotExist:
        raise NotFound("Deleted appointment not found.")


class VisitListCreateView(APIView):
    def get(self, request):
        clinic = clinic_for_staff(request)
        queryset = Visit.objects.select_related("patient").filter(clinic=clinic)

        date_value = request.query_params.get("date")
        patient_id = request.query_params.get("patient")
        if date_value:
            try:
                parsed_date = serializers.DateField().to_internal_value(date_value)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"date": exc.detail})
            queryset = queryset.filter(date=parsed_date)
        if patient_id:
            try:
                parsed_patient_id = serializers.UUIDField().to_internal_value(patient_id)
            except serializers.ValidationError as exc:
                raise serializers.ValidationError({"patient": exc.detail})
            patient = active_patient_for_clinic(clinic, parsed_patient_id)
            queryset = queryset.filter(patient=patient).order_by(
                "-date",
                "-scheduled_time",
                "-created_at",
            )

        return Response(
            {
                "visits": VisitSerializer(
                    queryset,
                    many=True,
                    context={"request": request},
                ).data
            }
        )

    def post(self, request):
        require_assistant_workspace(request)
        clinic = clinic_for_staff(request)
        visit_serializer = VisitSerializer(
            data=request.data,
            context={"request": request},
        )
        visit_serializer.is_valid(raise_exception=True)

        patient_id = visit_serializer.validated_data.get("patient_id")
        new_patient_payload = visit_serializer.validated_data.get("new_patient")
        patient_serializer = None

        if new_patient_payload is not None:
            patient_serializer, matches, confirmed = prepared_new_patient(
                clinic,
                new_patient_payload,
            )
            if matches and not confirmed:
                return possible_duplicate_response(matches)
            patient = None
        else:
            patient = active_patient_for_clinic(clinic, patient_id)

        with transaction.atomic():
            if patient_serializer is not None:
                patient = patient_serializer.save(clinic=clinic)
            visit = visit_serializer.save(clinic=clinic, patient=patient)

        return Response(
            VisitSerializer(visit, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class VisitQueueView(APIView):
    def get(self, request):
        clinic = clinic_for_staff(request)
        queryset = list(
            Visit.objects.select_related("patient")
            .filter(
                clinic=clinic,
                date=timezone.localdate(),
                status=Visit.Status.CHECKED_IN,
            )
            .order_by("queue_sequence", "checked_in_at", "created_at")
        )
        for position, visit in enumerate(queryset, start=1):
            visit.queue_position = position
        return Response(
            {
                "date": timezone.localdate(),
                "queue": QueueVisitSerializer(
                    queryset,
                    many=True,
                    context={"request": request},
                ).data,
            }
        )


class VisitDetailView(APIView):
    def get(self, request, visit_id):
        visit = active_visit_for_request(request, visit_id)
        return Response(VisitSerializer(visit, context={"request": request}).data)

    def patch(self, request, visit_id):
        require_assistant_workspace(request)
        visit = active_visit_for_request(request, visit_id)
        serializer = VisitSerializer(
            visit,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        patient_id = serializer.validated_data.get("patient_id")
        new_patient_payload = serializer.validated_data.get("new_patient")
        patient_serializer = None
        patient = visit.patient

        if new_patient_payload is not None:
            patient_serializer, matches, confirmed = prepared_new_patient(
                visit.clinic,
                new_patient_payload,
            )
            if matches and not confirmed:
                return possible_duplicate_response(matches)
            patient = None
        elif patient_id is not None:
            patient = active_patient_for_clinic(visit.clinic, patient_id)

        with transaction.atomic():
            if patient_serializer is not None:
                patient = patient_serializer.save(clinic=visit.clinic)
            visit = serializer.save(patient=patient)

        return Response(VisitSerializer(visit, context={"request": request}).data)

    def delete(self, request, visit_id):
        require_assistant_workspace(request)
        with transaction.atomic():
            visit = active_visit_for_request(request, visit_id, lock=True)
            if not visit.can_delete:
                return Response(
                    {
                        "code": "appointment_in_past",
                        "detail": "Past appointments cannot be deleted.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            visit.soft_delete()
        return Response(
            {
                "code": "appointment_deleted",
                "detail": "Appointment deleted.",
                "visit_id": str(visit.id),
                "undo_until": visit.delete_undo_until,
            }
        )


class VisitCheckInView(APIView):
    def post(self, request, visit_id):
        require_assistant_workspace(request)
        with transaction.atomic():
            visit = active_visit_for_request(request, visit_id, lock=True)
            if visit.date != timezone.localdate():
                return Response(
                    {
                        "code": "check_in_today_only",
                        "detail": "Only today's appointments can be checked in.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if visit.status == Visit.Status.CHECKED_IN:
                return Response(
                    {
                        "code": "already_checked_in",
                        "detail": "This Patient is already checked in for this appointment.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            Clinic.objects.select_for_update().get(pk=visit.clinic_id)
            last_sequence = (
                Visit.all_objects.filter(
                    clinic=visit.clinic,
                    date=visit.date,
                    queue_sequence__isnull=False,
                ).aggregate(maximum=Max("queue_sequence"))["maximum"]
                or 0
            )
            visit.status = Visit.Status.CHECKED_IN
            visit.checked_in_at = timezone.now()
            visit.queue_sequence = last_sequence + 1
            visit.save(
                update_fields=[
                    "status",
                    "checked_in_at",
                    "queue_sequence",
                    "updated_at",
                ]
            )

        return Response(VisitSerializer(visit, context={"request": request}).data)


class VisitUndoCheckInView(APIView):
    def post(self, request, visit_id):
        require_assistant_workspace(request)
        clinic = clinic_for_staff(request)
        with transaction.atomic():
            try:
                visit = Visit.all_objects.select_for_update().get(
                    pk=visit_id,
                    clinic=clinic,
                )
            except Visit.DoesNotExist:
                raise NotFound("Appointment not found.")
            if visit.status != Visit.Status.CHECKED_IN:
                return Response(
                    {
                        "code": "not_checked_in",
                        "detail": "This appointment is not checked in.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.now() > visit.check_in_undo_until:
                return Response(
                    {
                        "code": "undo_expired",
                        "detail": "The five-second Undo period has expired.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            visit.status = Visit.Status.PLANNED
            visit.checked_in_at = None
            visit.queue_sequence = None
            visit.save(
                update_fields=[
                    "status",
                    "checked_in_at",
                    "queue_sequence",
                    "updated_at",
                ]
            )

        return Response(VisitSerializer(visit, context={"request": request}).data)


class VisitUndoDeleteView(APIView):
    def post(self, request, visit_id):
        require_assistant_workspace(request)
        with transaction.atomic():
            visit = deleted_visit_for_request(request, visit_id, lock=True)
            if timezone.now() > visit.delete_undo_until:
                return Response(
                    {
                        "code": "undo_expired",
                        "detail": "The five-second Undo period has expired.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            visit.restore()

        return Response(VisitSerializer(visit, context={"request": request}).data)
