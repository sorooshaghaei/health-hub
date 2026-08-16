from datetime import timedelta
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from patients.models import Patient
from visits.models import Visit


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class VisitApiTests(APITestCase):
    clinic_data = {
        "name": "North Clinic",
        "email": "clinic@example.com",
        "phone": "+33 1 00 00 00 00",
    }

    def setUp(self):
        clinic_response = self.client.post(
            "/api/clinics/",
            self.clinic_data,
            format="json",
        )
        self.assertEqual(clinic_response.status_code, status.HTTP_201_CREATED)
        self.device_token = clinic_response.data["device_token"]
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
        self.doctor_assistant_token = self.login_staff(
            "assistant",
            "doctor.one",
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
            HTTP_X_DEVICE_TOKEN=self.device_token,
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
            HTTP_X_DEVICE_TOKEN=self.device_token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["session_token"]

    def authorization(self, token=None):
        return {
            "HTTP_AUTHORIZATION": f"Bearer {token or self.assistant_token}",
            "HTTP_X_DEVICE_TOKEN": self.device_token,
        }

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

    def create_appointment(
        self,
        patient_id,
        date=None,
        time="10:30",
        reason="Review",
        token=None,
    ):
        response = self.client.post(
            "/api/visits/",
            {
                "patient_id": patient_id,
                "date": (date or timezone.localdate()).isoformat(),
                "scheduled_time": time,
                "reason": reason,
            },
            format="json",
            **self.authorization(token),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_obsolete_visit_type_is_rejected_and_appointment_fields_are_required(self):
        patient = self.create_patient()
        response = self.client.post(
            "/api/visits/",
            {
                "visit_type": "legacy",
                "patient_id": patient["id"],
            },
            format="json",
            **self.authorization(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("visit_type", response.data)
        self.assertFalse(Visit.objects.exists())

    def test_inline_patient_and_appointment_creation_remains_atomic(self):
        response = self.client.post(
            "/api/visits/",
            {
                "date": timezone.localdate().isoformat(),
                "scheduled_time": "12:15",
                "reason": "First appointment",
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
        self.assertEqual(response.data["status"], "planned")
        self.assertTrue(Patient.objects.filter(full_name="Ali Moradi").exists())

    def test_only_todays_appointment_can_check_in(self):
        patient = self.create_patient()
        today = self.create_appointment(patient["id"])
        future = self.create_appointment(
            patient["id"],
            timezone.localdate() + timedelta(days=1),
            "11:00",
        )

        checked_in = self.client.post(
            f"/api/visits/{today['id']}/check-in/",
            **self.authorization(),
        )
        future_attempt = self.client.post(
            f"/api/visits/{future['id']}/check-in/",
            **self.authorization(),
        )

        self.assertEqual(checked_in.status_code, status.HTTP_200_OK)
        self.assertEqual(checked_in.data["status"], "checked_in")
        self.assertIsNotNone(checked_in.data["checked_in_at"])
        self.assertIsNotNone(checked_in.data["check_in_undo_until"])
        self.assertEqual(future_attempt.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(future_attempt.data["code"], "check_in_today_only")

    def test_queue_order_uses_check_in_sequence_when_timestamps_are_equal(self):
        first_patient = self.create_patient(name="Sara Ahmadi", phone="09121234567")
        second_patient = self.create_patient(name="Mina Karimi", phone="09125556677")
        first = self.create_appointment(first_patient["id"], time="09:00")
        second = self.create_appointment(second_patient["id"], time="08:00")

        first_response = self.client.post(
            f"/api/visits/{first['id']}/check-in/",
            **self.authorization(),
        )
        second_response = self.client.post(
            f"/api/visits/{second['id']}/check-in/",
            **self.authorization(),
        )
        same_timestamp = timezone.now()
        Visit.all_objects.filter(pk__in=[first["id"], second["id"]]).update(
            checked_in_at=same_timestamp
        )

        queue = self.client.get("/api/visits/queue/", **self.authorization())

        self.assertEqual(first_response.status_code, status.HTTP_200_OK)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in queue.data["queue"]],
            [first["id"], second["id"]],
        )
        self.assertEqual(
            [item["queue_position"] for item in queue.data["queue"]],
            [1, 2],
        )

    def test_undo_check_in_within_five_seconds_erases_the_action(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])
        self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(),
        )

        undone = self.client.post(
            f"/api/visits/{appointment['id']}/undo-check-in/",
            **self.authorization(),
        )
        visit = Visit.objects.get(pk=appointment["id"])

        self.assertEqual(undone.status_code, status.HTTP_200_OK)
        self.assertEqual(visit.status, Visit.Status.PLANNED)
        self.assertIsNone(visit.checked_in_at)
        self.assertIsNone(visit.queue_sequence)
        self.assertEqual(
            self.client.get("/api/visits/queue/", **self.authorization()).data["queue"],
            [],
        )

    def test_undo_check_in_expires_after_five_seconds(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])
        self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(),
        )
        Visit.objects.filter(pk=appointment["id"]).update(
            checked_in_at=timezone.now() - timedelta(seconds=6)
        )

        response = self.client.post(
            f"/api/visits/{appointment['id']}/undo-check-in/",
            **self.authorization(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["code"], "undo_expired")

    def test_checked_in_appointment_locks_patient_and_date_but_allows_time_and_reason(self):
        patient = self.create_patient()
        other_patient = self.create_patient(name="Mina Karimi", phone="09125556677")
        appointment = self.create_appointment(patient["id"])
        self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(),
        )

        allowed = self.client.patch(
            f"/api/visits/{appointment['id']}/",
            {"scheduled_time": "11:45", "reason": "Corrected reason"},
            format="json",
            **self.authorization(),
        )
        date_change = self.client.patch(
            f"/api/visits/{appointment['id']}/",
            {"date": (timezone.localdate() + timedelta(days=1)).isoformat()},
            format="json",
            **self.authorization(),
        )
        patient_change = self.client.patch(
            f"/api/visits/{appointment['id']}/",
            {"patient_id": other_patient["id"]},
            format="json",
            **self.authorization(),
        )

        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed.data["scheduled_time"], "11:45:00")
        self.assertEqual(allowed.data["reason"], "Corrected reason")
        self.assertEqual(date_change.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(patient_change.status_code, status.HTTP_400_BAD_REQUEST)

    def test_deleting_checked_in_appointment_hides_it_and_undo_restores_exact_state(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])
        checked_in = self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(),
        ).data

        deleted = self.client.delete(
            f"/api/visits/{appointment['id']}/",
            **self.authorization(),
        )
        hidden_detail = self.client.get(
            f"/api/visits/{appointment['id']}/",
            **self.authorization(),
        )
        restored = self.client.post(
            f"/api/visits/{appointment['id']}/undo-delete/",
            **self.authorization(),
        )

        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertEqual(deleted.data["code"], "appointment_deleted")
        self.assertEqual(hidden_detail.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.data["status"], "checked_in")
        self.assertEqual(restored.data["checked_in_at"], checked_in["checked_in_at"])
        self.assertEqual(
            Visit.objects.get(pk=appointment["id"]).queue_sequence,
            Visit.all_objects.get(pk=appointment["id"]).queue_sequence,
        )

    def test_check_in_and_delete_undos_are_order_independent(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])
        self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(),
        )
        self.client.delete(
            f"/api/visits/{appointment['id']}/",
            **self.authorization(),
        )

        undo_check_in = self.client.post(
            f"/api/visits/{appointment['id']}/undo-check-in/",
            **self.authorization(),
        )
        still_deleted = Visit.all_objects.get(pk=appointment["id"])
        undo_delete = self.client.post(
            f"/api/visits/{appointment['id']}/undo-delete/",
            **self.authorization(),
        )

        self.assertEqual(undo_check_in.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(still_deleted.deleted_at)
        self.assertEqual(still_deleted.status, Visit.Status.PLANNED)
        self.assertEqual(undo_delete.status_code, status.HTTP_200_OK)
        self.assertEqual(undo_delete.data["status"], "planned")
        self.assertEqual(
            self.client.get("/api/visits/queue/", **self.authorization()).data["queue"],
            [],
        )

    def test_delete_undo_expires_and_deleted_appointment_stays_absent(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])
        self.client.delete(
            f"/api/visits/{appointment['id']}/",
            **self.authorization(),
        )
        Visit.all_objects.filter(pk=appointment["id"]).update(
            deleted_at=timezone.now() - timedelta(seconds=6)
        )

        undo = self.client.post(
            f"/api/visits/{appointment['id']}/undo-delete/",
            **self.authorization(),
        )
        listing = self.client.get(
            f"/api/visits/?date={timezone.localdate().isoformat()}",
            **self.authorization(),
        )

        self.assertEqual(undo.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(undo.data["code"], "undo_expired")
        self.assertEqual(listing.data["visits"], [])

    def test_doctor_queue_is_read_only_and_omits_phone(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])
        self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(),
        )

        doctor_queue = self.client.get(
            "/api/visits/queue/",
            **self.authorization(self.doctor_token),
        )
        doctor_check_in = self.client.post(
            f"/api/visits/{appointment['id']}/undo-check-in/",
            **self.authorization(self.doctor_token),
        )
        assistant_queue = self.client.get(
            "/api/visits/queue/",
            **self.authorization(),
        )

        self.assertEqual(doctor_queue.status_code, status.HTTP_200_OK)
        self.assertNotIn("phone_e164", doctor_queue.data["queue"][0]["patient"])
        self.assertEqual(doctor_check_in.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("phone_e164", assistant_queue.data["queue"][0]["patient"])

    def test_doctor_credentials_in_assistant_workspace_can_manage_queue(self):
        patient = self.create_patient()
        appointment = self.create_appointment(patient["id"])

        response = self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.authorization(self.doctor_assistant_token),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "checked_in")
