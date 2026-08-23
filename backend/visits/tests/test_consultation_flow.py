from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from visits.models import RoomCall, Visit


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ConsultationFlowApiTests(APITestCase):
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
        self.assistant_token = self.register_staff(
            "assistant", "assistant.one", "assistant@example.com"
        )
        self.doctor_token = self.register_staff(
            "doctor", "doctor.one", "doctor@example.com"
        )
        self.doctor_assistant_token = self.login_staff(
            "assistant", "doctor.one"
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

    def auth(self, token):
        return {
            "HTTP_AUTHORIZATION": f"Bearer {token}",
            "HTTP_X_DEVICE_TOKEN": self.device_token,
        }

    def create_waiting_appointment(self, name, phone, scheduled_time):
        patient = self.client.post(
            "/api/patients/",
            {
                "full_name": name,
                "gender": "Woman",
                "country_calling_code": "+98",
                "phone_number": phone,
                "date_of_birth": "1994-05-11",
                "patient_note": f"Shared note for {name}",
            },
            format="json",
            **self.auth(self.assistant_token),
        ).data
        appointment = self.client.post(
            "/api/visits/",
            {
                "patient_id": patient["id"],
                "date": timezone.localdate().isoformat(),
                "scheduled_time": scheduled_time,
                "reason": "Review",
            },
            format="json",
            **self.auth(self.assistant_token),
        ).data
        checked_in = self.client.post(
            f"/api/visits/{appointment['id']}/check-in/",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(checked_in.status_code, status.HTTP_200_OK)
        return checked_in.data

    def make_room_call_available(self):
        RoomCall.objects.update(
            requested_at=timezone.now() - timedelta(seconds=6)
        )

    def test_room_ready_waits_five_seconds_and_persists_with_empty_queue(self):
        created = self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )
        assistant_before = self.client.get(
            "/api/visits/room-state/",
            **self.auth(self.assistant_token),
        )
        doctor_state = self.client.get(
            "/api/visits/room-state/",
            **self.auth(self.doctor_token),
        )
        repeated = self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )

        self.assertEqual(created.status_code, status.HTTP_200_OK)
        self.assertIsNone(assistant_before.data["room_call"])
        self.assertFalse(doctor_state.data["room_call"]["available"])
        self.assertFalse(doctor_state.data["can_room_ready"])
        self.assertEqual(repeated.status_code, status.HTTP_409_CONFLICT)

        self.make_room_call_available()
        assistant_after = self.client.get(
            "/api/visits/room-state/",
            **self.auth(self.assistant_token),
        )
        self.assertTrue(assistant_after.data["room_call"]["available"])
        self.assertIsNone(assistant_after.data["room_call"]["suggested_visit_id"])

    def test_assistant_can_choose_another_patient_without_changing_queue_order(self):
        first = self.create_waiting_appointment(
            "First Patient", "09121234567", "09:00"
        )
        second = self.create_waiting_appointment(
            "Chosen Patient", "09125556677", "08:00"
        )
        self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )
        self.make_room_call_available()

        assistant_state = self.client.get(
            "/api/visits/room-state/",
            **self.auth(self.assistant_token),
        )
        sent = self.client.post(
            f"/api/visits/{second['id']}/with-doctor/",
            **self.auth(self.assistant_token),
        )
        queue = self.client.get(
            "/api/visits/queue/",
            **self.auth(self.assistant_token),
        )
        doctor_state = self.client.get(
            "/api/visits/room-state/",
            **self.auth(self.doctor_token),
        )

        self.assertEqual(
            assistant_state.data["room_call"]["suggested_visit_id"], first["id"]
        )
        self.assertEqual(sent.status_code, status.HTTP_200_OK)
        self.assertEqual(sent.data["status"], "with_doctor")
        self.assertIsNotNone(sent.data["with_doctor_undo_until"])
        self.assertEqual([item["id"] for item in queue.data["queue"]], [first["id"]])
        self.assertEqual(queue.data["queue"][0]["queue_position"], 1)
        self.assertEqual(doctor_state.data["current_visit"]["id"], second["id"])
        self.assertEqual(
            doctor_state.data["current_visit"]["patient"]["patient_note"],
            "Shared note for Chosen Patient",
        )

    def test_assistant_undo_restores_original_queue_and_pending_room_call(self):
        first = self.create_waiting_appointment(
            "First Patient", "09121234567", "09:00"
        )
        second = self.create_waiting_appointment(
            "Chosen Patient", "09125556677", "08:00"
        )
        self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )
        self.make_room_call_available()
        self.client.post(
            f"/api/visits/{second['id']}/with-doctor/",
            **self.auth(self.assistant_token),
        )

        undone = self.client.post(
            f"/api/visits/{second['id']}/undo-with-doctor/",
            **self.auth(self.assistant_token),
        )
        queue = self.client.get(
            "/api/visits/queue/",
            **self.auth(self.assistant_token),
        )
        assistant_state = self.client.get(
            "/api/visits/room-state/",
            **self.auth(self.assistant_token),
        )

        self.assertEqual(undone.status_code, status.HTTP_200_OK)
        self.assertEqual(undone.data["status"], "checked_in")
        self.assertEqual(
            [item["id"] for item in queue.data["queue"]],
            [first["id"], second["id"]],
        )
        self.assertIsNotNone(assistant_state.data["room_call"])
        self.assertTrue(assistant_state.data["room_call"]["available"])

    def test_next_room_ready_finishes_current_patient_and_undo_restores_them(self):
        patient = self.create_waiting_appointment(
            "Current Patient", "09121234567", "09:00"
        )
        self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )
        self.make_room_call_available()
        self.client.post(
            f"/api/visits/{patient['id']}/with-doctor/",
            **self.auth(self.assistant_token),
        )
        past = timezone.now() - timedelta(seconds=6)
        Visit.objects.filter(pk=patient["id"]).update(with_doctor_at=past)
        RoomCall.objects.update(consumed_at=past)

        ready_again = self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )
        finished = Visit.objects.get(pk=patient["id"])
        undone = self.client.post(
            "/api/visits/room-ready/undo/",
            **self.auth(self.doctor_token),
        )
        restored = Visit.objects.get(pk=patient["id"])

        self.assertEqual(ready_again.status_code, status.HTTP_200_OK)
        self.assertEqual(
            ready_again.data["previous_visit"]["patient"]["full_name"],
            "Current Patient",
        )
        self.assertEqual(finished.status, Visit.Status.DOCTOR_FINISHED)
        self.assertIsNotNone(finished.doctor_finished_at)
        self.assertEqual(undone.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.status, Visit.Status.WITH_DOCTOR)
        self.assertIsNone(restored.doctor_finished_at)
        self.assertFalse(RoomCall.objects.exists())

    def test_workspace_permissions_and_consultation_deletion_block(self):
        patient = self.create_waiting_appointment(
            "Current Patient", "09121234567", "09:00"
        )
        assistant_ready = self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.assistant_token),
        )
        doctor_admin_ready = self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_assistant_token),
        )
        self.client.post(
            "/api/visits/room-ready/",
            **self.auth(self.doctor_token),
        )
        self.make_room_call_available()
        doctor_send = self.client.post(
            f"/api/visits/{patient['id']}/with-doctor/",
            **self.auth(self.doctor_token),
        )
        doctor_admin_send = self.client.post(
            f"/api/visits/{patient['id']}/with-doctor/",
            **self.auth(self.doctor_assistant_token),
        )
        deleted = self.client.delete(
            f"/api/visits/{patient['id']}/",
            **self.auth(self.assistant_token),
        )

        self.assertEqual(assistant_ready.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(doctor_admin_ready.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(doctor_send.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(doctor_admin_send.status_code, status.HTTP_200_OK)
        self.assertEqual(doctor_admin_send.data["status"], Visit.Status.WITH_DOCTOR)
        self.assertEqual(deleted.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(deleted.data["code"], "consultation_started")
