from datetime import time, timedelta

from django.db import IntegrityError, transaction
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic
from patients.models import Patient
from visits.models import Visit


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SameDayAppointmentApiTests(APITestCase):
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
        self.assistant_token = self.register_assistant()
        self.patient = self.create_patient()

    def register_assistant(self):
        response = self.client.post(
            "/api/staff/register/",
            {
                "role": "assistant",
                "username": "assistant.one",
                "email": "assistant@example.com",
                "first_name": "Test",
                "last_name": "Assistant",
                "password": "Strong-staff-password-123",
                "password_confirm": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=self.device_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["session_token"]

    def auth(self):
        return {
            "HTTP_AUTHORIZATION": f"Bearer {self.assistant_token}",
            "HTTP_X_DEVICE_TOKEN": self.device_token,
        }

    def create_patient(self):
        response = self.client.post(
            "/api/patients/",
            {
                "full_name": "Sara Ahmadi",
                "gender": "Woman",
                "country_calling_code": "+98",
                "phone_number": "09121234567",
                "date_of_birth": "1994-05-11",
                "patient_note": "",
            },
            format="json",
            **self.auth(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def create_appointment(self, date, scheduled_time="10:00"):
        return self.client.post(
            "/api/visits/",
            {
                "patient_id": self.patient["id"],
                "date": date.isoformat(),
                "scheduled_time": scheduled_time,
                "reason": "Review",
            },
            format="json",
            **self.auth(),
        )

    def test_second_appointment_for_same_patient_and_date_is_blocked(self):
        appointment_date = timezone.localdate() + timedelta(days=1)
        first = self.create_appointment(appointment_date, "10:00")
        second = self.create_appointment(appointment_date, "14:00")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(second.data["code"], "same_day_appointment_exists")
        self.assertEqual(
            second.data["detail"],
            "This Patient already has an appointment on this date.",
        )
        self.assertEqual(second.data["appointment"]["id"], first.data["id"])
        self.assertFalse(second.data["recently_deleted"])

    def test_edit_cannot_move_appointment_onto_existing_patient_date(self):
        first_date = timezone.localdate() + timedelta(days=1)
        second_date = timezone.localdate() + timedelta(days=2)
        first = self.create_appointment(first_date, "10:00")
        second = self.create_appointment(second_date, "11:00")

        conflict = self.client.patch(
            f"/api/visits/{second.data['id']}/",
            {"date": first_date.isoformat()},
            format="json",
            **self.auth(),
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(conflict.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(conflict.data["appointment"]["id"], first.data["id"])

    def test_recently_deleted_appointment_reserves_date_until_undo_expires(self):
        appointment_date = timezone.localdate() + timedelta(days=1)
        first = self.create_appointment(appointment_date)
        deleted = self.client.delete(
            f"/api/visits/{first.data['id']}/",
            **self.auth(),
        )
        blocked = self.create_appointment(appointment_date, "12:00")

        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertTrue(blocked.data["recently_deleted"])
        self.assertEqual(blocked.data["appointment"]["id"], first.data["id"])

        Visit.all_objects.filter(pk=first.data["id"]).update(
            deleted_at=timezone.now() - timedelta(seconds=6)
        )
        replacement = self.create_appointment(appointment_date, "12:00")
        self.assertEqual(replacement.status_code, status.HTTP_201_CREATED)

    def test_database_constraint_rejects_active_duplicate(self):
        appointment_date = timezone.localdate() + timedelta(days=1)
        first = self.create_appointment(appointment_date)
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        clinic = Clinic.objects.get(pk=self.patient_clinic_id)
        patient = Patient.objects.get(pk=self.patient["id"])
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Visit.objects.create(
                    clinic=clinic,
                    patient=patient,
                    date=appointment_date,
                    scheduled_time=time(13, 0),
                    reason="Direct duplicate",
                )

    @property
    def patient_clinic_id(self):
        return Patient.objects.only("clinic_id").get(pk=self.patient["id"]).clinic_id
