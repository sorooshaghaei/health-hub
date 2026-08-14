from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
)
class PrivateNoteApiTests(APITestCase):
    clinic_data = {
        "name": "North Clinic",
        "email": "clinic@example.com",
        "phone": "+33 1 00 00 00 00",
        "password": "clinic-password-123",
        "password_confirm": "clinic-password-123",
    }
    staff_password = "Strong-staff-password-123"

    def setUp(self):
        clinic = self.client.post(
            "/api/clinics/", self.clinic_data, format="json"
        ).data
        self.clinic_token = clinic["clinic_access_token"]
        self.doctor = self.register("doctor", "doctor.one", "doctor@example.com")
        self.assistant = self.register(
            "assistant", "assistant.one", "assistant@example.com"
        )
        self.doctor_as_assistant = self.login("assistant", "doctor.one")

    def register(self, role, username, email):
        response = self.client.post(
            "/api/staff/register/",
            {
                "role": role,
                "username": username,
                "email": email,
                "first_name": "Test",
                "last_name": role.title(),
                "password": self.staff_password,
                "password_confirm": self.staff_password,
            },
            format="json",
            HTTP_X_CLINIC_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def login(self, role, username):
        response = self.client.post(
            "/api/staff/login/",
            {
                "role": role,
                "username": username,
                "password": self.staff_password,
            },
            format="json",
            HTTP_X_CLINIC_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data

    def authorization(self, payload):
        return {"HTTP_AUTHORIZATION": f"Bearer {payload['session_token']}"}

    def test_each_staff_account_keeps_one_independent_plain_text_note(self):
        doctor_text = "Call Suzi\nVisit the coffee shop\nMy husband called"
        assistant_text = "Prepare tomorrow's desk"

        doctor_update = self.client.patch(
            "/api/staff/private-note/",
            {"content": doctor_text},
            format="json",
            **self.authorization(self.doctor),
        )
        assistant_update = self.client.patch(
            "/api/staff/private-note/",
            {"content": assistant_text},
            format="json",
            **self.authorization(self.assistant),
        )

        self.assertEqual(doctor_update.status_code, status.HTTP_200_OK)
        self.assertEqual(assistant_update.status_code, status.HTTP_200_OK)
        self.assertEqual(doctor_update.data["content"], doctor_text)
        self.assertEqual(assistant_update.data["content"], assistant_text)
        self.assertEqual(
            self.client.get(
                "/api/staff/private-note/",
                **self.authorization(self.doctor),
            ).data["content"],
            doctor_text,
        )
        self.assertEqual(
            self.client.get(
                "/api/staff/private-note/",
                **self.authorization(self.assistant),
            ).data["content"],
            assistant_text,
        )

    def test_erasing_all_text_saves_a_blank_page(self):
        response = self.client.patch(
            "/api/staff/private-note/",
            {"content": ""},
            format="json",
            **self.authorization(self.assistant),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"content": ""})

    def test_doctor_in_assistant_workspace_cannot_access_any_private_note(self):
        get_response = self.client.get(
            "/api/staff/private-note/",
            **self.authorization(self.doctor_as_assistant),
        )
        patch_response = self.client.patch(
            "/api/staff/private-note/",
            {"content": "Must stay hidden"},
            format="json",
            **self.authorization(self.doctor_as_assistant),
        )

        self.assertEqual(get_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(patch_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_private_note_requires_authentication(self):
        response = self.client.get("/api/staff/private-note/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
