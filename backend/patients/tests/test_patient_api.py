from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Patient
from visits.models import Visit


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PatientApiTests(APITestCase):
    def setUp(self):
        clinic_response = self.client.post(
            "/api/clinics/",
            {
                "name": "North Clinic",
                "email": "clinic@example.com",
                "phone": "+33 1 00 00 00 00",
            },
            format="json",
        )
        self.clinic_token = clinic_response.data["device_token"]
        self.doctor_token = self.register_staff("doctor", "doctor.one", "doctor@example.com")
        self.assistant_token = self.register_staff(
            "assistant", "assistant.one", "assistant@example.com"
        )
        self.doctor_assistant_token = self.login_staff("assistant", "doctor.one")

    def register_staff(self, role, username, email):
        response = self.client.post(
            "/api/staff/register/",
            {
                "role": role,
                "username": username,
                "email": email,
                "first_name": "Test",
                "last_name": role.title(),
                "password": "Strong-staff-password-123",
                "password_confirm": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["session_token"]

    def login_staff(self, role, username):
        response = self.client.post(
            "/api/staff/login/",
            {
                "role": role,
                "username": username,
                "password": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["session_token"]

    def patient_payload(self, **overrides):
        payload = {
            "full_name": "Sara Ahmadi",
            "gender": "Woman",
            "country_calling_code": "+98",
            "phone_number": "0912 123 4567",
            "date_of_birth": "1992-04-15",
            "patient_note": "Prefers morning calls.",
        }
        payload.update(overrides)
        return payload

    def request_as(self, token, method, path, data=None):
        return getattr(self.client, method)(
            path,
            data,
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def create_patient(self, token=None, **overrides):
        response = self.request_as(
            token or self.assistant_token,
            "post",
            "/api/patients/",
            self.patient_payload(**overrides),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_doctor_workspace_reads_and_edits_but_cannot_create_or_delete_patients(self):
        patient = self.create_patient()

        detail = self.request_as(
            self.doctor_token,
            "get",
            f"/api/patients/{patient['id']}/",
        )
        create = self.request_as(
            self.doctor_token,
            "post",
            "/api/patients/",
            self.patient_payload(full_name="Mina Karimi", phone_number="09125556677"),
        )
        edit = self.request_as(
            self.doctor_token,
            "patch",
            f"/api/patients/{patient['id']}/",
            {"patient_note": "Changed"},
        )
        delete = self.request_as(
            self.doctor_token,
            "delete",
            f"/api/patients/{patient['id']}/",
        )

        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(create.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(edit.status_code, status.HTTP_200_OK)
        self.assertEqual(edit.data["patient_note"], "Changed")
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_assistant_and_doctor_admin_assistant_workspace_manage_patients(self):
        created = self.create_patient()
        edited = self.request_as(
            self.doctor_assistant_token,
            "patch",
            f"/api/patients/{created['id']}/",
            {"patient_note": "Updated through Assistant workspace."},
        )

        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertEqual(
            edited.data["patient_note"],
            "Updated through Assistant workspace.",
        )

    def test_duplicate_warning_remains_one_simple_contract(self):
        first = self.create_patient()
        warning = self.request_as(
            self.assistant_token,
            "post",
            "/api/patients/",
            self.patient_payload(),
        )
        confirmed = self.request_as(
            self.assistant_token,
            "post",
            "/api/patients/",
            self.patient_payload(confirm_duplicate=True),
        )

        self.assertEqual(warning.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(warning.data["code"], "possible_duplicate")
        self.assertEqual(warning.data["matches"][0]["id"], first["id"])
        self.assertEqual(confirmed.status_code, status.HTTP_201_CREATED)

    def test_combined_search_by_name_phone_and_birth_date(self):
        patient = self.create_patient()
        by_name = self.request_as(self.doctor_token, "get", "/api/patients/?search=sara")
        by_phone = self.request_as(self.doctor_token, "get", "/api/patients/?search=912123")
        by_birth = self.request_as(self.doctor_token, "get", "/api/patients/?search=1992-04-15")

        self.assertEqual(by_name.data["patients"][0]["id"], patient["id"])
        self.assertEqual(by_phone.data["patients"][0]["id"], patient["id"])
        self.assertEqual(by_birth.data["patients"][0]["id"], patient["id"])

    def test_current_or_future_appointments_block_patient_deletion(self):
        patient = self.create_patient()
        Visit.objects.create(
            clinic=Patient.objects.get(pk=patient["id"]).clinic,
            patient_id=patient["id"],
            date=timezone.localdate(),
            scheduled_time="08:00",
            reason="",
        )
        response = self.request_as(self.assistant_token, "delete", f"/api/patients/{patient['id']}/")
        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["code"], "future_visits_exist")

    def test_recently_deleted_appointment_blocks_patient_delete_until_undo_expires(self):
        patient = self.create_patient()
        visit = Visit.objects.create(
            clinic=Patient.objects.get(pk=patient["id"]).clinic,
            patient_id=patient["id"],
            date=timezone.localdate(),
            scheduled_time="08:00",
            reason="",
        )
        self.request_as(self.assistant_token, "delete", f"/api/visits/{visit.id}/")
        blocked = self.request_as(self.assistant_token, "delete", f"/api/patients/{patient['id']}/")
        Visit.all_objects.filter(pk=visit.id).update(deleted_at=timezone.now() - timedelta(seconds=6))
        allowed = self.request_as(self.assistant_token, "delete", f"/api/patients/{patient['id']}/")

        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data["code"], "patient_deleted")

    def test_patient_delete_has_five_second_undo(self):
        patient = self.create_patient()
        deleted = self.request_as(self.assistant_token, "delete", f"/api/patients/{patient['id']}/")
        hidden = self.request_as(self.doctor_token, "get", f"/api/patients/{patient['id']}/")
        restored = self.request_as(self.assistant_token, "post", f"/api/patients/{patient['id']}/undo-delete/")

        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertEqual(deleted.data["code"], "patient_deleted")
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertTrue(Patient.objects.filter(pk=patient["id"]).exists())

    def test_patient_delete_undo_expires(self):
        patient = self.create_patient()
        self.request_as(self.assistant_token, "delete", f"/api/patients/{patient['id']}/")
        Patient.all_objects.filter(pk=patient["id"]).update(deleted_at=timezone.now() - timedelta(seconds=6))
        response = self.request_as(self.assistant_token, "post", f"/api/patients/{patient['id']}/undo-delete/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "undo_expired")

    def test_patients_are_isolated_between_clinics(self):
        created = self.create_patient()
        other_clinic = self.client.post(
            "/api/clinics/",
            {"name": "Other Clinic", "email": "other@example.com", "phone": "+33111111111"},
            format="json",
        ).data
        other_staff = self.client.post(
            "/api/staff/register/",
            {
                "role": "doctor",
                "username": "other.doctor",
                "email": "other.doctor@example.com",
                "first_name": "Other",
                "last_name": "Doctor",
                "password": "Strong-other-password-123",
                "password_confirm": "Strong-other-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=other_clinic["device_token"],
        ).data["session_token"]

        listing = self.request_as(other_staff, "get", "/api/patients/")
        detail = self.request_as(other_staff, "get", f"/api/patients/{created['id']}/")

        self.assertEqual(listing.data["patients"], [])
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)
