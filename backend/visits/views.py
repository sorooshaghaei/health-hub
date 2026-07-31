from django.db import transaction
from rest_framework import status, serializers
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from patients.matching import possible_duplicate_patients
from patients.models import Patient
from patients.serializers import PatientSerializer
from patients.views import (
    clinic_for_staff,
    duplicate_candidate,
    possible_duplicate_response,
)

from .models import Visit
from .serializers import VisitSerializer


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

        return Response({"visits": VisitSerializer(queryset, many=True).data})

    def post(self, request):
        clinic = clinic_for_staff(request)
        visit_serializer = VisitSerializer(data=request.data)
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

        return Response(VisitSerializer(visit).data, status=status.HTTP_201_CREATED)


class VisitDetailView(APIView):
    def get_visit(self, request, visit_id):
        clinic = clinic_for_staff(request)
        try:
            return Visit.objects.select_related("patient").get(
                pk=visit_id,
                clinic=clinic,
            )
        except Visit.DoesNotExist:
            raise NotFound("Visit not found.")

    def get(self, request, visit_id):
        return Response(VisitSerializer(self.get_visit(request, visit_id)).data)

    def patch(self, request, visit_id):
        visit = self.get_visit(request, visit_id)
        serializer = VisitSerializer(visit, data=request.data, partial=True)
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

        return Response(VisitSerializer(visit).data)

    def delete(self, request, visit_id):
        visit = self.get_visit(request, visit_id)
        if not visit.can_delete:
            return Response(
                {
                    "code": "visit_not_future",
                    "detail": "Only future visits can be removed.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        visit.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
