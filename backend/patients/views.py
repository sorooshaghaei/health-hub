from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from .matching import patient_search_queryset, possible_duplicate_patients
from .models import Patient
from .serializers import PatientMatchSerializer, PatientSerializer


def clinic_for_staff(request):
    if request.user.clinic_id is None or request.user.role not in {"doctor", "assistant"}:
        raise PermissionDenied("A clinic staff account is required.")
    return request.user.clinic


def possible_duplicate_response(matches):
    return Response(
        {
            "code": "possible_duplicate",
            "detail": "Possible duplicate patient",
            "matches": PatientMatchSerializer(matches, many=True).data,
        },
        status=status.HTTP_409_CONFLICT,
    )


def duplicate_candidate(serializer, instance=None):
    validated = serializer.validated_data
    return {
        "full_name": validated.get("full_name", instance.full_name if instance else ""),
        "phone_e164": validated.get("phone_e164", instance.phone_e164 if instance else ""),
        "date_of_birth": validated.get(
            "date_of_birth",
            instance.date_of_birth if instance else None,
        ),
    }


class PatientListCreateView(APIView):
    def get(self, request):
        clinic = clinic_for_staff(request)
        queryset = patient_search_queryset(
            Patient.objects.filter(clinic=clinic),
            request.query_params.get("search"),
        )
        return Response({"patients": PatientSerializer(queryset, many=True).data})

    def post(self, request):
        clinic = clinic_for_staff(request)
        serializer = PatientSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        confirmed = serializer.validated_data.pop("confirm_duplicate", False)
        matches = possible_duplicate_patients(
            clinic=clinic,
            candidate=duplicate_candidate(serializer),
        )
        if matches and not confirmed:
            return possible_duplicate_response(matches)
        patient = serializer.save(clinic=clinic)
        return Response(PatientSerializer(patient).data, status=status.HTTP_201_CREATED)


class PatientDetailView(APIView):
    def get_patient(self, request, patient_id):
        clinic = clinic_for_staff(request)
        try:
            return Patient.objects.get(pk=patient_id, clinic=clinic)
        except Patient.DoesNotExist:
            from rest_framework.exceptions import NotFound

            raise NotFound("Patient not found.")

    def get(self, request, patient_id):
        return Response(PatientSerializer(self.get_patient(request, patient_id)).data)

    def patch(self, request, patient_id):
        patient = self.get_patient(request, patient_id)
        serializer = PatientSerializer(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        confirmed = serializer.validated_data.pop("confirm_duplicate", False)
        candidate = duplicate_candidate(serializer, instance=patient)
        identity_changed = (
            candidate["full_name"] != patient.full_name
            or candidate["phone_e164"] != patient.phone_e164
            or candidate["date_of_birth"] != patient.date_of_birth
        )
        matches = []
        if identity_changed:
            matches = possible_duplicate_patients(
                clinic=patient.clinic,
                candidate=candidate,
                exclude_patient=patient,
            )
        if matches and not confirmed:
            return possible_duplicate_response(matches)
        patient = serializer.save()
        return Response(PatientSerializer(patient).data)

    def delete(self, request, patient_id):
        patient = self.get_patient(request, patient_id)
        # Phase 1 does not create Visits, so no future Visit can currently exist.
        # Patient deletion is still soft to preserve the historical-link contract
        # that Phase 2 will use when Visit records are introduced.
        patient.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
