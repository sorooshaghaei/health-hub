from datetime import timedelta

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Clinic, StaffUser
from accounts.permissions import (
    active_workspace_role,
    require_assistant_workspace,
    require_doctor_workspace,
)
from patients.matching import possible_duplicate_patients
from patients.models import Patient
from patients.serializers import PatientSerializer
from patients.views import (
    clinic_for_staff,
    duplicate_candidate,
    possible_duplicate_response,
)

from .models import RoomCall, UNDO_WINDOW_SECONDS, Visit
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


def ordered_queue(clinic):
    return Visit.objects.select_related("patient").filter(
        clinic=clinic,
        date=timezone.localdate(),
        status=Visit.Status.CHECKED_IN,
    ).order_by("queue_sequence", "checked_in_at", "created_at")


def pending_room_call(clinic, *, lock=False):
    queryset = RoomCall.objects.filter(
        clinic=clinic,
        date=timezone.localdate(),
        consumed_at__isnull=True,
    )
    if lock:
        queryset = queryset.select_for_update()
    return queryset.first()


def room_call_payload(room_call, suggested_visit_id=None):
    now = timezone.now()
    return {
        "requested_at": room_call.requested_at,
        "available_at": room_call.available_at,
        "undo_until": room_call.undo_until,
        "available": now >= room_call.available_at,
        "suggested_visit_id": (
            str(suggested_visit_id) if suggested_visit_id is not None else None
        ),
    }


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
        queryset = list(ordered_queue(clinic))
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


class VisitRoomStateView(APIView):
    def get(self, request):
        clinic = clinic_for_staff(request)
        role = active_workspace_role(request)
        now = timezone.now()
        current_visit = (
            Visit.objects.select_related("patient")
            .filter(
                clinic=clinic,
                date=timezone.localdate(),
                status=Visit.Status.WITH_DOCTOR,
            )
            .order_by("with_doctor_at", "created_at")
            .first()
        )
        room_call = pending_room_call(clinic)
        first_waiting_id = ordered_queue(clinic).values_list("id", flat=True).first()

        visible_call = room_call
        if (
            role == StaffUser.Role.ASSISTANT
            and room_call is not None
            and now < room_call.available_at
        ):
            visible_call = None

        can_room_ready = role == StaffUser.Role.DOCTOR and room_call is None
        if (
            can_room_ready
            and current_visit is not None
            and current_visit.with_doctor_undo_until is not None
            and now <= current_visit.with_doctor_undo_until
        ):
            can_room_ready = False

        return Response(
            {
                "date": timezone.localdate(),
                "current_visit": (
                    VisitSerializer(current_visit, context={"request": request}).data
                    if role == StaffUser.Role.DOCTOR and current_visit is not None
                    else None
                ),
                "room_call": (
                    room_call_payload(
                        visible_call,
                        first_waiting_id,
                    )
                    if visible_call is not None
                    else None
                ),
                "can_room_ready": can_room_ready,
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
            if visit.status in {
                Visit.Status.WITH_DOCTOR,
                Visit.Status.DOCTOR_FINISHED,
            }:
                return Response(
                    {
                        "code": "consultation_started",
                        "detail": "An appointment cannot be deleted after consultation starts.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
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
            if visit.status != Visit.Status.PLANNED:
                return Response(
                    {
                        "code": "already_checked_in",
                        "detail": "This Patient has already entered today's clinic workflow.",
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


class RoomReadyView(APIView):
    def post(self, request):
        require_doctor_workspace(request)
        clinic = clinic_for_staff(request)
        now = timezone.now()
        today = timezone.localdate()

        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            room_call = (
                RoomCall.objects.select_for_update()
                .filter(clinic=clinic)
                .first()
            )
            if room_call is not None and room_call.date == today and room_call.is_pending:
                return Response(
                    {
                        "code": "room_call_pending",
                        "detail": "The previous room-ready call is still pending.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            current_visit = (
                Visit.objects.select_for_update()
                .select_related("patient")
                .filter(
                    clinic=clinic,
                    date=today,
                    status=Visit.Status.WITH_DOCTOR,
                )
                .order_by("with_doctor_at", "created_at")
                .first()
            )
            if (
                current_visit is not None
                and current_visit.with_doctor_undo_until is not None
                and now <= current_visit.with_doctor_undo_until
            ):
                return Response(
                    {
                        "code": "with_doctor_undo_pending",
                        "detail": "Wait for the five-second With doctor Undo period to finish.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            if current_visit is not None:
                current_visit.status = Visit.Status.DOCTOR_FINISHED
                current_visit.doctor_finished_at = now
                current_visit.save(
                    update_fields=[
                        "status",
                        "doctor_finished_at",
                        "updated_at",
                    ]
                )

            if room_call is None:
                room_call = RoomCall(clinic=clinic)
            room_call.date = today
            room_call.requested_at = now
            room_call.previous_visit = current_visit
            room_call.selected_visit = None
            room_call.consumed_at = None
            room_call.save()

        first_waiting_id = ordered_queue(clinic).values_list("id", flat=True).first()
        return Response(
            {
                "room_call": room_call_payload(
                    room_call,
                    first_waiting_id,
                ),
                "previous_visit": (
                    VisitSerializer(current_visit, context={"request": request}).data
                    if current_visit is not None
                    else None
                ),
            }
        )


class UndoRoomReadyView(APIView):
    def post(self, request):
        require_doctor_workspace(request)
        clinic = clinic_for_staff(request)

        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            room_call = pending_room_call(clinic, lock=True)
            if room_call is None:
                return Response(
                    {
                        "code": "room_call_not_pending",
                        "detail": "There is no pending room-ready call to undo.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if timezone.now() > room_call.undo_until:
                return Response(
                    {
                        "code": "undo_expired",
                        "detail": "The five-second Undo period has expired.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            previous_visit = room_call.previous_visit
            if previous_visit is not None:
                previous_visit = (
                    Visit.objects.select_for_update()
                    .select_related("patient")
                    .filter(pk=previous_visit.pk, clinic=clinic)
                    .first()
                )
                if (
                    previous_visit is not None
                    and previous_visit.status == Visit.Status.DOCTOR_FINISHED
                ):
                    previous_visit.status = Visit.Status.WITH_DOCTOR
                    previous_visit.doctor_finished_at = None
                    previous_visit.save(
                        update_fields=[
                            "status",
                            "doctor_finished_at",
                            "updated_at",
                        ]
                    )
            room_call.delete()

        return Response(
            {
                "current_visit": (
                    VisitSerializer(previous_visit, context={"request": request}).data
                    if previous_visit is not None
                    else None
                )
            }
        )


class VisitWithDoctorView(APIView):
    def post(self, request, visit_id):
        require_assistant_workspace(request)
        clinic = clinic_for_staff(request)
        now = timezone.now()
        today = timezone.localdate()

        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            room_call = pending_room_call(clinic, lock=True)
            if room_call is None or now < room_call.available_at:
                return Response(
                    {
                        "code": "room_not_ready",
                        "detail": "The Doctor has not made the room available yet.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            visit = active_visit_for_request(request, visit_id, lock=True)
            if visit.date != today or visit.status != Visit.Status.CHECKED_IN:
                return Response(
                    {
                        "code": "patient_not_waiting",
                        "detail": "Only a checked-in Patient in today's queue can go to the Doctor.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            if Visit.objects.select_for_update().filter(
                clinic=clinic,
                date=today,
                status=Visit.Status.WITH_DOCTOR,
            ).exists():
                return Response(
                    {
                        "code": "doctor_busy",
                        "detail": "Another Patient is already with the Doctor.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            visit.status = Visit.Status.WITH_DOCTOR
            visit.with_doctor_at = now
            visit.doctor_finished_at = None
            visit.save(
                update_fields=[
                    "status",
                    "with_doctor_at",
                    "doctor_finished_at",
                    "updated_at",
                ]
            )
            room_call.selected_visit = visit
            room_call.consumed_at = now
            room_call.save(update_fields=["selected_visit", "consumed_at", "updated_at"])

        return Response(VisitSerializer(visit, context={"request": request}).data)


class VisitUndoWithDoctorView(APIView):
    def post(self, request, visit_id):
        require_assistant_workspace(request)
        clinic = clinic_for_staff(request)
        today = timezone.localdate()

        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            room_call = (
                RoomCall.objects.select_for_update()
                .filter(
                    clinic=clinic,
                    date=today,
                    selected_visit_id=visit_id,
                    consumed_at__isnull=False,
                )
                .first()
            )
            if room_call is None:
                return Response(
                    {
                        "code": "with_doctor_not_undoable",
                        "detail": "This With doctor action cannot be undone.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            undo_until = room_call.consumed_at + timedelta(
                seconds=UNDO_WINDOW_SECONDS
            )
            if timezone.now() > undo_until:
                return Response(
                    {
                        "code": "undo_expired",
                        "detail": "The five-second Undo period has expired.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            visit = active_visit_for_request(request, visit_id, lock=True)
            if visit.status != Visit.Status.WITH_DOCTOR:
                return Response(
                    {
                        "code": "not_with_doctor",
                        "detail": "This Patient is not currently with the Doctor.",
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            visit.status = Visit.Status.CHECKED_IN
            visit.with_doctor_at = None
            visit.doctor_finished_at = None
            visit.save(
                update_fields=[
                    "status",
                    "with_doctor_at",
                    "doctor_finished_at",
                    "updated_at",
                ]
            )
            room_call.selected_visit = None
            room_call.consumed_at = None
            room_call.save(update_fields=["selected_visit", "consumed_at", "updated_at"])

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
