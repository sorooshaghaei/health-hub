from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic
from patients.models import Patient


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class DoctorPatientEditTests(APITestCase):
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
        self.device_token = clinic_response.data["device_token"]
        doctor_response = self.client.post(
            "/api/staff/register/",
            {
                "role": "doctor",
                "username": "doctor.one",
                "email": "doctor@example.com",
                "first_name": "Test",
                "last_name": "Doctor",
                "password": "Strong-staff-password-123",
                "password_confirm": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=self.device_token,
        )
        self.assertEqual(doctor_response.status_code, status.HTTP_201_CREATED)
        self.doctor_token = doctor_response.data["session_token"]
        clinic = Clinic.objects.get(pk=clinic_response.data["clinic"]["id"])
        self.patient = Patient.objects.create(
            clinic=clinic,
            full_name="Sara Ahmadi",
            gender=Patient.Gender.WOMAN,
            country_calling_code="+98",
            phone_number="09121234567",
            date_of_birth=None,
            patient_note="",
        )

    def auth(self):
        return {
            "HTTP_AUTHORIZATION": f"Bearer {self.doctor_token}",
            "HTTP_X_DEVICE_TOKEN": self.device_token,
        }

    def test_doctor_workspace_can_edit_all_patient_fields(self):
        response = self.client.patch(
            f"/api/patients/{self.patient.id}/",
            {
                "full_name": "Sara Mohammadi",
                "gender": "Man",
                "country_calling_code": "+33",
                "phone_number": "0612345678",
                "date_of_birth": "1991-07-10",
                "patient_note": "Call after lab results arrive.",
            },
            format="json",
            **self.auth(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Sara Mohammadi")
        self.assertEqual(response.data["gender"], "Man")
        self.assertEqual(response.data["phone_e164"], "+33612345678")
        self.assertEqual(response.data["date_of_birth"], "1991-07-10")
        self.assertEqual(response.data["patient_note"], "Call after lab results arrive.")
