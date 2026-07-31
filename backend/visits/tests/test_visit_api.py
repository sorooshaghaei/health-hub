from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Patient
from visits.models import Visit


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
)
class VisitApiTests(APITestCase):
    clinic_data = {
        "name": "North Clinic",
        "email": "clinic@example.com",
        "phone": "+33 1 00 00 00 00",
        "password": "clinic-password-123",
        "password_confirm": "clinic-password-123",
    }

    def setUp(self):
        clinic_response = self.client.post(
            "/api/clinics/",
            self.clinic_data,
            format="json",
        )
        self.assertEqual(clinic_response.status_code, status.HTTP_201_CREATED)
        self.clinic_token = clinic_response.data["clinic_access_token"]
        self.assistant_token = self.register_staff(
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )
        self.doctor_token = self.register_staff(
            "doctor",
            "doctor.one",
            "doctor@example.com",
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

    def authorization(self, token=None):
        return {"HTTP_AUTHORIZATION": f"Bearer {token or self.assistant_token}"}

    def create_patient(self, *, name="Sara Ahmadi", phone="09121234567"):
        response = self.client.post(
            "/api/patients/",
            {
                "full_name": name,
                "gender": "Woman",
                "country_calling_code": "+98",
                "phone_number": phone,
                "date_of_birth": "1994-05-11",
                "patient_note": "",
            },
            format="json",
            **self.authorization(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def create_appointment(self, patient_id, date, time="10:30", reason="Review"):
        response = self.client.post(
            "/api/visits/",
            {
                "visit_type": "appointment",
                "patient_id": patient_id,
                "date": date.isoformat(),
                "scheduled_time": time,
                "reason": reason,
            },
            format="json",
            **self.authorization(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_assistant_creates_appointment_and_doctor_can_edit_it(self):
        patient = self.create_patient()
        visit = self.create_appointment(
            patient["id"],
            timezone.localdate() + timedelta(days=2),
        )

        response = self.client.patch(
            f"/api/visits/{visit['id']}/",
            {
                "date": (timezone.localdate() + timedelta(days=3)).isoformat(),
                "scheduled_time": "11:45",
                "reason": "Updated reason",
            },
            format="json",
            **self.authorization(self.doctor_token),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["reason"], "Updated reason")
        self.assertEqual(response.data["scheduled_time"], "11:45:00")
        self.assertEqual(response.data["patient"]["full_name"], "Sara Ahmadi")

    def test_walk_in_uses_current_date_and_only_patient_data(self):
        patient = self.create_patient()
        response = self.client.post(
            "/api/visits/",
            {
                "visit_type": "walk_in",
                "patient_id": patient["id"],
                "date": "2040-01-01",
                "scheduled_time": "18:00",
                "reason": "Ignored",
            },
            format="json",
            **self.authorization(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["date"], timezone.localdate().isoformat())
        self.assertIsNone(response.data["scheduled_time"])
        self.assertEqual(response.data["reason"], "")
        self.assertFalse(response.data["can_delete"])

    def test_repeated_same_day_visits_are_allowed(self):
        patient = self.create_patient()
        date = timezone.localdate() + timedelta(days=4)

        first = self.create_appointment(patient["id"], date, "09:00")
        second = self.create_appointment(patient["id"], date, "15:00")

        self.assertNotEqual(first["id"], second["id"])
        self.assertEqual(
            Visit.objects.filter(patient_id=patient["id"], date=date).count(),
            2,
        )

    def test_inline_patient_creation_is_atomic_with_appointment(self):
        date = timezone.localdate() + timedelta(days=5)
        response = self.client.post(
            "/api/visits/",
            {
                "visit_type": "appointment",
                "date": date.isoformat(),
                "scheduled_time": "12:15",
                "reason": "First visit",
                "new_patient": {
                    "full_name": "Ali Moradi",
                    "gender": "Man",
                    "country_calling_code": "+98",
                    "phone_number": "09123334455",
                    "date_of_birth": None,
                    "patient_note": "",
                },
            },
            format="json",
            **self.authorization(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["patient"]["full_name"], "Ali Moradi")
        self.assertTrue(
            Patient.objects.filter(
                clinic__email="clinic@example.com",
                full_name="Ali Moradi",
            ).exists()
        )

    def test_inline_duplicate_warning_keeps_the_visit_draft_reusable(self):
        patient = self.create_patient()
        date = timezone.localdate() + timedelta(days=6)
        payload = {
            "visit_type": "appointment",
            "date": date.isoformat(),
            "scheduled_time": "08:30",
            "reason": "",
            "new_patient": {
                "full_name": "Sara Ahmadi",
                "gender": "Woman",
                "country_calling_code": "+98",
                "phone_number": "09121234567",
                "date_of_birth": "1994-05-11",
                "patient_note": "",
            },
        }

        warning = self.client.post(
            "/api/visits/",
            payload,
            format="json",
            **self.authorization(),
        )
        self.assertEqual(warning.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(warning.data["code"], "possible_duplicate")
        self.assertEqual(warning.data["matches"][0]["id"], patient["id"])

        use_existing = self.client.post(
            "/api/visits/",
            {
                "visit_type": payload["visit_type"],
                "date": payload["date"],
                "scheduled_time": payload["scheduled_time"],
                "reason": payload["reason"],
                "patient_id": patient["id"],
            },
            format="json",
            **self.authorization(),
        )
        self.assertEqual(use_existing.status_code, status.HTTP_201_CREATED)

        separate_payload = {
            **payload,
            "new_patient": {
                **payload["new_patient"],
                "confirm_duplicate": True,
            },
        }
        create_separate = self.client.post(
            "/api/visits/",
            separate_payload,
            format="json",
            **self.authorization(),
        )
        self.assertEqual(create_separate.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Patient.objects.filter(full_name="Sara Ahmadi").count(), 2)

    def test_patient_history_lists_past_and_future_visits_and_both_are_editable(self):
        patient = self.create_patient()
        past_date = timezone.localdate() - timedelta(days=2)
        future_date = timezone.localdate() + timedelta(days=2)
        past = self.create_appointment(patient["id"], past_date, "09:00", "Past")
        future = self.create_appointment(patient["id"], future_date, "10:00", "Future")

        history = self.client.get(
            f"/api/visits/?patient={patient['id']}",
            **self.authorization(),
        )
        self.assertEqual(history.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in history.data["visits"]],
            [future["id"], past["id"]],
        )

        edited_past = self.client.patch(
            f"/api/visits/{past['id']}/",
            {"reason": "Corrected historical reason"},
            format="json",
            **self.authorization(),
        )
        self.assertEqual(edited_past.status_code, status.HTTP_200_OK)
        self.assertEqual(
            edited_past.data["reason"],
            "Corrected historical reason",
        )

    def test_only_future_visits_can_be_removed(self):
        patient = self.create_patient()
        future = self.create_appointment(
            patient["id"],
            timezone.localdate() + timedelta(days=1),
        )
        past = self.create_appointment(
            patient["id"],
            timezone.localdate() - timedelta(days=1),
        )

        future_delete = self.client.delete(
            f"/api/visits/{future['id']}/",
            **self.authorization(),
        )
        past_delete = self.client.delete(
            f"/api/visits/{past['id']}/",
            **self.authorization(),
        )

        self.assertEqual(future_delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(past_delete.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Visit.objects.filter(pk=past["id"]).exists())

    def test_patient_deletion_requires_future_visit_removal_and_preserves_history(self):
        patient = self.create_patient()
        past = self.create_appointment(
            patient["id"],
            timezone.localdate() - timedelta(days=3),
        )
        future = self.create_appointment(
            patient["id"],
            timezone.localdate() + timedelta(days=3),
        )

        blocked = self.client.delete(
            f"/api/patients/{patient['id']}/",
            **self.authorization(),
        )
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(blocked.data["code"], "future_visits_exist")

        self.client.delete(
            f"/api/visits/{future['id']}/",
            **self.authorization(),
        )
        deleted = self.client.delete(
            f"/api/patients/{patient['id']}/",
            **self.authorization(),
        )

        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Patient.objects.filter(pk=patient["id"]).exists())
        self.assertTrue(Patient.all_objects.filter(pk=patient["id"]).exists())
        historical_visit = Visit.objects.get(pk=past["id"])
        self.assertEqual(
            historical_visit.patient_full_name_snapshot,
            "Sara Ahmadi",
        )

    def test_visit_access_is_scoped_to_the_authenticated_clinic(self):
        patient = self.create_patient()
        visit = self.create_appointment(
            patient["id"],
            timezone.localdate() + timedelta(days=7),
        )

        second_clinic = self.client.post(
            "/api/clinics/",
            {
                **self.clinic_data,
                "name": "South Clinic",
                "email": "south@example.com",
            },
            format="json",
        )
        second_token = second_clinic.data["clinic_access_token"]
        second_assistant = self.client.post(
            "/api/staff/register/",
            {
                "role": "assistant",
                "username": "south.assistant",
                "email": "south.assistant@example.com",
                "first_name": "South",
                "last_name": "Assistant",
                "password": "Strong-staff-password-123",
                "password_confirm": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_CLINIC_TOKEN=second_token,
        ).data["session_token"]

        response = self.client.get(
            f"/api/visits/{visit['id']}/",
            **self.authorization(second_assistant),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
