from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic
from patients.models import Patient


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PatientApiTests(APITestCase):
    def setUp(self):
        clinic_response = self.client.post(
            "/api/clinics/",
            {
                "name": "North Clinic",
                "email": "clinic@example.com",
                "phone": "+33 1 00 00 00 00",
                "password": "clinic-password-123",
                "password_confirm": "clinic-password-123",
            },
            format="json",
        )
        self.clinic_token = clinic_response.data["clinic_access_token"]
        self.doctor_token = self.register_staff("doctor", "doctor.one", "doctor@example.com")
        self.assistant_token = self.register_staff(
            "assistant", "assistant.one", "assistant@example.com"
        )

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
            HTTP_X_CLINIC_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
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

    def test_doctor_and_assistant_can_create_view_edit_search_and_delete(self):
        created = self.request_as(
            self.assistant_token, "post", "/api/patients/", self.patient_payload()
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["phone_number"], "9121234567")
        self.assertEqual(created.data["phone_e164"], "+989121234567")
        patient_id = created.data["id"]

        detail = self.request_as(
            self.doctor_token, "get", f"/api/patients/{patient_id}/"
        )
        self.assertEqual(detail.status_code, status.HTTP_200_OK)
        self.assertEqual(detail.data["patient_note"], "Prefers morning calls.")

        edited = self.request_as(
            self.doctor_token,
            "patch",
            f"/api/patients/{patient_id}/",
            {"patient_note": "Shared note updated by Doctor."},
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertEqual(edited.data["patient_note"], "Shared note updated by Doctor.")

        by_name = self.request_as(
            self.assistant_token, "get", "/api/patients/?search=sara"
        )
        by_phone = self.request_as(
            self.assistant_token, "get", "/api/patients/?search=912123"
        )
        by_birth = self.request_as(
            self.assistant_token, "get", "/api/patients/?search=1992-04-15"
        )
        self.assertEqual(len(by_name.data["patients"]), 1)
        self.assertEqual(len(by_phone.data["patients"]), 1)
        self.assertEqual(len(by_birth.data["patients"]), 1)

        deleted = self.request_as(
            self.assistant_token, "delete", f"/api/patients/{patient_id}/"
        )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Patient.objects.count(), 0)
        self.assertEqual(Patient.all_objects.count(), 1)
        self.assertIsNotNone(Patient.all_objects.get(pk=patient_id).deleted_at)
        missing = self.request_as(
            self.doctor_token, "get", f"/api/patients/{patient_id}/"
        )
        self.assertEqual(missing.status_code, status.HTTP_404_NOT_FOUND)

    def test_exact_duplicate_warns_but_explicit_confirmation_can_create(self):
        first = self.request_as(
            self.doctor_token, "post", "/api/patients/", self.patient_payload()
        )
        warning = self.request_as(
            self.assistant_token,
            "post",
            "/api/patients/",
            self.patient_payload(),
        )
        self.assertEqual(warning.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(warning.data["detail"], "Possible duplicate patient")
        self.assertEqual(warning.data["matches"][0]["id"], first.data["id"])

        confirmed = self.request_as(
            self.assistant_token,
            "post",
            "/api/patients/",
            self.patient_payload(confirm_duplicate=True),
        )
        self.assertEqual(confirmed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Patient.objects.count(), 2)
        self.assertEqual(confirmed.data["full_name"], "Sara Ahmadi")

    def test_similar_name_with_same_phone_uses_the_same_generic_warning(self):
        self.request_as(
            self.doctor_token, "post", "/api/patients/", self.patient_payload()
        )
        warning = self.request_as(
            self.assistant_token,
            "post",
            "/api/patients/",
            self.patient_payload(full_name="Sarah Ahmadi", date_of_birth=None),
        )
        self.assertEqual(warning.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(warning.data["code"], "possible_duplicate")
        self.assertEqual(warning.data["detail"], "Possible duplicate patient")

    def test_invalid_gender_and_country_specific_phone_length_are_rejected(self):
        invalid_gender = self.request_as(
            self.doctor_token,
            "post",
            "/api/patients/",
            self.patient_payload(gender="Other"),
        )
        invalid_phone = self.request_as(
            self.doctor_token,
            "post",
            "/api/patients/",
            self.patient_payload(phone_number="0912"),
        )
        self.assertEqual(invalid_gender.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_phone.status_code, status.HTTP_400_BAD_REQUEST)

    def test_patients_are_isolated_between_clinics(self):
        created = self.request_as(
            self.doctor_token, "post", "/api/patients/", self.patient_payload()
        )

        other_clinic = Clinic(
            name="Other Clinic", email="other@example.com", phone="+33111111111"
        )
        other_clinic.set_password("other-clinic-password")
        other_clinic.save()
        entered = self.client.post(
            "/api/clinics/enter/",
            {"email": "other@example.com", "password": "other-clinic-password"},
            format="json",
        )
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
            HTTP_X_CLINIC_TOKEN=entered.data["clinic_access_token"],
        )
        other_token = other_staff.data["session_token"]

        listing = self.request_as(other_token, "get", "/api/patients/")
        detail = self.request_as(
            other_token, "get", f"/api/patients/{created.data['id']}/"
        )
        self.assertEqual(listing.data["patients"], [])
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)
