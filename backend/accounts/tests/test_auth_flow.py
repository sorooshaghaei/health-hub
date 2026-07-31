from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic, StaffUser


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"]
)
class AuthenticationFlowTests(APITestCase):
    clinic_data = {
        "name": "North Clinic",
        "email": "clinic@example.com",
        "phone": "+33 1 00 00 00 00",
        "password": "clinic-password-123",
        "password_confirm": "clinic-password-123",
    }

    def create_clinic(self):
        response = self.client.post("/api/clinics/", self.clinic_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def register_staff(self, clinic_token, role, username, email):
        return self.client.post(
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
            HTTP_X_CLINIC_TOKEN=clinic_token,
        )

    def login_staff(self, clinic_token, role, username):
        return self.client.post(
            "/api/staff/login/",
            {
                "role": role,
                "username": username,
                "password": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_CLINIC_TOKEN=clinic_token,
        )

    def test_clinic_password_is_hashed_and_roles_start_empty(self):
        payload = self.create_clinic()
        clinic = Clinic.objects.get(email=self.clinic_data["email"])

        self.assertNotEqual(clinic.password_hash, self.clinic_data["password"])
        self.assertTrue(clinic.check_password(self.clinic_data["password"]))
        self.assertFalse(payload["roles"]["doctor"]["exists"])
        self.assertFalse(payload["roles"]["assistant"]["exists"])

    def test_registration_uses_the_accounts_own_workspace(self):
        clinic_payload = self.create_clinic()
        doctor = self.register_staff(
            clinic_payload["clinic_access_token"],
            "doctor",
            "doctor.one",
            "doctor@example.com",
        )
        assistant = self.register_staff(
            clinic_payload["clinic_access_token"],
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        self.assertEqual(doctor.status_code, status.HTTP_201_CREATED)
        self.assertEqual(doctor.data["user"]["role"], "doctor")
        self.assertEqual(doctor.data["user"]["workspace_role"], "doctor")
        self.assertTrue(doctor.data["user"]["is_clinic_admin"])
        self.assertEqual(assistant.data["user"]["workspace_role"], "assistant")
        self.assertFalse(assistant.data["user"]["is_clinic_admin"])

    def test_doctor_credentials_can_open_doctor_or_assistant_workspace(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["clinic_access_token"]
        self.register_staff(token, "doctor", "doctor.one", "doctor@example.com")
        self.register_staff(
            token,
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        doctor_workspace = self.login_staff(token, "doctor", "doctor.one")
        assistant_workspace = self.login_staff(token, "assistant", "doctor.one")

        self.assertEqual(doctor_workspace.status_code, status.HTTP_200_OK)
        self.assertEqual(doctor_workspace.data["user"]["role"], "doctor")
        self.assertEqual(
            doctor_workspace.data["user"]["workspace_role"],
            "doctor",
        )
        self.assertEqual(assistant_workspace.status_code, status.HTTP_200_OK)
        self.assertEqual(assistant_workspace.data["user"]["role"], "doctor")
        self.assertEqual(
            assistant_workspace.data["user"]["workspace_role"],
            "assistant",
        )

        me_response = self.client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=(
                f"Bearer {assistant_workspace.data['session_token']}"
            ),
        )
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["user"]["role"], "doctor")
        self.assertEqual(me_response.data["user"]["workspace_role"], "assistant")

    def test_assistant_credentials_cannot_open_doctor_workspace(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["clinic_access_token"]
        self.register_staff(
            token,
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        response = self.login_staff(token, "doctor", "assistant.one")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_only_one_account_per_role_is_allowed(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["clinic_access_token"]
        first = self.register_staff(token, "doctor", "doctor.one", "one@example.com")
        second = self.register_staff(token, "doctor", "doctor.two", "two@example.com")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            StaffUser.objects.filter(
                clinic__email="clinic@example.com",
                role="doctor",
            ).count(),
            1,
        )

    def test_wrong_clinic_password_is_rejected(self):
        self.create_clinic()
        response = self.client.post(
            "/api/clinics/enter/",
            {"email": "clinic@example.com", "password": "wrong-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_clinic_context_requires_clinic_access(self):
        response = self.client.get("/api/clinic/context/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_logout_invalidates_staff_session(self):
        clinic_payload = self.create_clinic()
        response = self.register_staff(
            clinic_payload["clinic_access_token"],
            "doctor",
            "doctor.one",
            "doctor@example.com",
        )
        authorization = f"Bearer {response.data['session_token']}"

        logout_response = self.client.post(
            "/api/staff/logout/",
            HTTP_AUTHORIZATION=authorization,
        )
        me_response = self.client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=authorization,
        )

        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(me_response.status_code, status.HTTP_401_UNAUTHORIZED)
