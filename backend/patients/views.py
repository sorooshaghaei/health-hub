from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import active_clinic, require_assistant_workspace

from .matching import patient_search_queryset, possible_duplicate_patients
from .models import PATIENT_DELETE_UNDO_SECONDS, Patient
from .serializers import PatientMatchSerializer, PatientSerializer


def clinic_for_staff(request):
    return active_clinic(request)


def possible_duplicate_response(matches):
    return Response({"code": "possible_duplicate", "detail": "Possible duplicate patient", "matches": PatientMatchSerializer(matches, many=True).data}, status=status.HTTP_409_CONFLICT)


def duplicate_candidate(serializer, instance=None):
    validated = serializer.validated_data
    return {
        "full_name": validated.get("full_name", instance.full_name if instance else ""),
        "phone_e164": validated.get("phone_e164", instance.phone_e164 if instance else ""),
        "date_of_birth": validated.get("date_of_birth", instance.date_of_birth if instance else None),
    }


class PatientListCreateView(APIView):
    def get(self, request):
        clinic = clinic_for_staff(request)
        queryset = patient_search_queryset(Patient.objects.filter(clinic=clinic), request.query_params.get("search"))
        return Response({"patients": PatientSerializer(queryset, many=True).data})

    def post(self, request):
        require_assistant_workspace(request)
        clinic = clinic_for_staff(request)
        serializer = PatientSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        confirmed = serializer.validated_data.pop("confirm_duplicate", False)
        matches = possible_duplicate_patients(clinic=clinic, candidate=duplicate_candidate(serializer))
        if matches and not confirmed: return possible_duplicate_response(matches)
        patient = serializer.save(clinic=clinic)
        return Response(PatientSerializer(patient).data, status=status.HTTP_201_CREATED)


class PatientDetailView(APIView):
    def get_patient(self, request, patient_id, *, lock=False):
        queryset = Patient.objects.filter(clinic=clinic_for_staff(request))
        if lock: queryset = queryset.select_for_update()
        try: return queryset.get(pk=patient_id)
        except Patient.DoesNotExist: raise NotFound("Patient not found.")

    def get(self, request, patient_id): return Response(PatientSerializer(self.get_patient(request, patient_id)).data)

    def patch(self, request, patient_id):
        patient = self.get_patient(request, patient_id)
        serializer = PatientSerializer(patient, data=request.data, partial=True); serializer.is_valid(raise_exception=True)
        confirmed = serializer.validated_data.pop("confirm_duplicate", False)
        candidate = duplicate_candidate(serializer, instance=patient)
        identity_changed = candidate["full_name"] != patient.full_name or candidate["phone_e164"] != patient.phone_e164 or candidate["date_of_birth"] != patient.date_of_birth
        matches = possible_duplicate_patients(clinic=patient.clinic, candidate=candidate, exclude_patient=patient) if identity_changed else []
        if matches and not confirmed: return possible_duplicate_response(matches)
        return Response(PatientSerializer(serializer.save()).data)

    def delete(self, request, patient_id):
        require_assistant_workspace(request)
        from visits.models import UNDO_WINDOW_SECONDS, Visit
        with transaction.atomic():
            patient = self.get_patient(request, patient_id, lock=True)
            now = timezone.now(); undo_cutoff = now - timedelta(seconds=UNDO_WINDOW_SECONDS)
            current_or_future_visits = Visit.all_objects.filter(clinic=patient.clinic, patient=patient, date__gte=timezone.localdate()).filter(Q(deleted_at__isnull=True) | Q(deleted_at__gte=undo_cutoff))
            if current_or_future_visits.exists():
                return Response({"code": "future_visits_exist", "detail": "Delete current and future appointments before deleting this Patient.", "future_visit_count": current_or_future_visits.count()}, status=status.HTTP_409_CONFLICT)
            patient.soft_delete()
        return Response({"code": "patient_deleted", "detail": "Patient deleted.", "patient_id": str(patient.id), "undo_until": patient.delete_undo_until})


class PatientUndoDeleteView(APIView):
    def post(self, request, patient_id):
        require_assistant_workspace(request); clinic = clinic_for_staff(request)
        with transaction.atomic():
            try: patient = Patient.all_objects.select_for_update().get(pk=patient_id, clinic=clinic, deleted_at__isnull=False)
            except Patient.DoesNotExist: raise NotFound("Deleted Patient not found.")
            if timezone.now() > patient.delete_undo_until:
                return Response({"code": "undo_expired", "detail": f"The {PATIENT_DELETE_UNDO_SECONDS}-second Undo period has expired."}, status=status.HTTP_400_BAD_REQUEST)
            patient.restore()
        return Response(PatientSerializer(patient).data)
