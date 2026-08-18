from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from tasks.models import SharedTask


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SharedTaskApiTests(APITestCase):
    clinic_data = {
        "name": "North Clinic",
        "email": "clinic@example.com",
        "phone": "+33 1 00 00 00 00",
    }

    def setUp(self):
        clinic_response = self.client.post("/api/clinics/", self.clinic_data, format="json")
        self.assertEqual(clinic_response.status_code, status.HTTP_201_CREATED)
        self.device_token = clinic_response.data["device_token"]
        self.assistant_token, self.assistant = self.register_staff(
            "assistant", "assistant.one", "assistant@example.com"
        )
        self.doctor_token, self.doctor = self.register_staff(
            "doctor", "doctor.one", "doctor@example.com"
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
            HTTP_X_DEVICE_TOKEN=self.device_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["session_token"], response.data["user"]

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
            **self.auth(self.assistant_token),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def create_task(self, token=None, **overrides):
        payload = {
            "title": "Call the Patient",
            "description": "Confirm tomorrow's arrival time.",
            **overrides,
        }
        response = self.client.post(
            "/api/tasks/",
            payload,
            format="json",
            **self.auth(token or self.doctor_token),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def test_only_doctor_membership_creates_tasks_in_either_workspace(self):
        forbidden = self.client.post(
            "/api/tasks/",
            {"title": "Assistant cannot create"},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        doctor_task = self.create_task()
        admin_task = self.create_task(
            token=self.doctor_assistant_token,
            title="Created from Assistant workspace",
        )

        shared = self.client.get("/api/tasks/", **self.auth(self.assistant_token))
        self.assertEqual(shared.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [task["id"] for task in shared.data["open_tasks"]],
            [doctor_task["id"], admin_task["id"]],
        )
        self.assertEqual(shared.data["completed_tasks"], [])

    def test_task_attention_dot_is_membership_specific_and_clears_when_tasks_are_seen(self):
        assistant_initial = self.client.get(
            "/api/tasks/attention/", **self.auth(self.assistant_token)
        )
        doctor_initial = self.client.get(
            "/api/tasks/attention/", **self.auth(self.doctor_token)
        )
        self.assertFalse(assistant_initial.data["attention_required"])
        self.assertFalse(doctor_initial.data["attention_required"])

        task = self.create_task()
        assistant_new = self.client.get(
            "/api/tasks/attention/", **self.auth(self.assistant_token)
        )
        doctor_after_create = self.client.get(
            "/api/tasks/attention/", **self.auth(self.doctor_token)
        )
        self.assertTrue(assistant_new.data["attention_required"])
        self.assertFalse(doctor_after_create.data["attention_required"])

        assistant_seen = self.client.post(
            "/api/tasks/attention/",
            {},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertFalse(assistant_seen.data["attention_required"])
        self.assertFalse(
            self.client.get(
                "/api/tasks/attention/", **self.auth(self.assistant_token)
            ).data["attention_required"]
        )

        done = self.client.post(
            f"/api/tasks/{task['id']}/done/",
            {},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.assertTrue(
            self.client.get(
                "/api/tasks/attention/", **self.auth(self.doctor_token)
            ).data["attention_required"]
        )
        self.assertFalse(
            self.client.get(
                "/api/tasks/attention/", **self.auth(self.assistant_token)
            ).data["attention_required"]
        )

        doctor_seen = self.client.post(
            "/api/tasks/attention/",
            {},
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertFalse(doctor_seen.data["attention_required"])
        self.assertFalse(
            self.client.get(
                "/api/tasks/attention/", **self.auth(self.doctor_token)
            ).data["attention_required"]
        )

    def test_doctor_edits_task_and_optional_patient_link(self):
        patient = self.create_patient()
        task = self.create_task(patient_id=patient["id"], due_date="2026-08-20")
        self.assertEqual(task["patient"]["full_name"], "Sara Ahmadi")
        self.assertEqual(task["due_date"], "2026-08-20")

        forbidden = self.client.patch(
            f"/api/tasks/{task['id']}/",
            {"title": "Assistant edit"},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        edited = self.client.patch(
            f"/api/tasks/{task['id']}/",
            {
                "title": "Updated task",
                "description": "Updated instructions.",
                "patient_id": None,
                "due_date": None,
            },
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertEqual(edited.data["title"], "Updated task")
        self.assertIsNone(edited.data["patient"])
        self.assertIsNone(edited.data["due_date"])

    def test_done_moves_to_history_and_five_second_undo_restores_open(self):
        task = self.create_task()
        done = self.client.post(
            f"/api/tasks/{task['id']}/done/",
            {},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(done.status_code, status.HTTP_200_OK)
        self.assertEqual(done.data["task"]["status"], "done")
        self.assertIsNotNone(done.data["undo_until"])

        history = self.client.get("/api/tasks/", **self.auth(self.doctor_token))
        self.assertEqual(history.data["open_tasks"], [])
        self.assertEqual(history.data["completed_tasks"][0]["id"], task["id"])

        undone = self.client.post(
            f"/api/tasks/{task['id']}/undo-done/",
            {},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(undone.status_code, status.HTTP_200_OK)
        self.assertEqual(undone.data["status"], "open")

        doctor_done = self.client.post(
            f"/api/tasks/{task['id']}/done/",
            {},
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(doctor_done.status_code, status.HTTP_200_OK)
        self.assertFalse(
            self.client.get(
                "/api/tasks/attention/", **self.auth(self.doctor_token)
            ).data["attention_required"]
        )

        stored = SharedTask.objects.get(pk=task["id"])
        stored.completed_at = timezone.now() - timedelta(seconds=6)
        stored.save(update_fields=["completed_at", "updated_at"])
        expired = self.client.post(
            f"/api/tasks/{task['id']}/undo-done/",
            {},
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(expired.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(expired.data["code"], "undo_expired")

    def test_only_doctor_deletes_task_and_can_undo_delete(self):
        task = self.create_task()
        forbidden = self.client.delete(
            f"/api/tasks/{task['id']}/",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

        deleted = self.client.delete(
            f"/api/tasks/{task['id']}/",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(deleted.data["undo_until"])

        listing = self.client.get("/api/tasks/", **self.auth(self.assistant_token))
        self.assertEqual(listing.data["open_tasks"], [])

        restored = self.client.post(
            f"/api/tasks/{task['id']}/undo-delete/",
            {},
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.data["id"], task["id"])

    def test_comments_are_shared_but_only_author_can_edit_delete_and_undo(self):
        task = self.create_task()
        assistant_comment = self.client.post(
            f"/api/tasks/{task['id']}/comments/",
            {"body": "I called and left a message."},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(assistant_comment.status_code, status.HTTP_201_CREATED)
        comment_id = assistant_comment.data["id"]

        doctor_comment = self.client.post(
            f"/api/tasks/{task['id']}/comments/",
            {"body": "Try once more this afternoon."},
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(doctor_comment.status_code, status.HTTP_201_CREATED)

        forbidden_edit = self.client.patch(
            f"/api/task-comments/{comment_id}/",
            {"body": "Doctor cannot rewrite this."},
            format="json",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(forbidden_edit.status_code, status.HTTP_403_FORBIDDEN)

        edited = self.client.patch(
            f"/api/task-comments/{comment_id}/",
            {"body": "I called and left two messages."},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(edited.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(edited.data["edited_at"])

        forbidden_delete = self.client.delete(
            f"/api/task-comments/{comment_id}/",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(forbidden_delete.status_code, status.HTTP_403_FORBIDDEN)

        deleted = self.client.delete(
            f"/api/task-comments/{comment_id}/",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertIsNotNone(deleted.data["undo_until"])

        task_without_comment = self.client.get(
            f"/api/tasks/{task['id']}/",
            **self.auth(self.doctor_token),
        )
        self.assertEqual(len(task_without_comment.data["comments"]), 1)
        self.assertEqual(task_without_comment.data["comments"][0]["id"], doctor_comment.data["id"])

        restored = self.client.post(
            f"/api/task-comments/{comment_id}/undo-delete/",
            {},
            format="json",
            **self.auth(self.assistant_token),
        )
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.data["body"], "I called and left two messages.")
