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

    def test_clinic_password_is_hashed_and_roles_start_empty(self):
        payload = self.create_clinic()
        clinic = Clinic.objects.get(email=self.clinic_data["email"])

        self.assertNotEqual(clinic.password_hash, self.clinic_data["password"])
        self.assertTrue(clinic.check_password(self.clinic_data["password"]))
        self.assertFalse(payload["roles"]["doctor"]["exists"])
        self.assertFalse(payload["roles"]["assistant"]["exists"])

    def test_doctor_registration_creates_administrator_session(self):
        clinic_payload = self.create_clinic()
        response = self.register_staff(
            clinic_payload["clinic_access_token"],
            "doctor",
            "doctor.one",
            "doctor@example.com",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["user"]["is_clinic_admin"])
        self.assertEqual(response.data["user"]["role"], "doctor")

        me_response = self.client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=f"Bearer {response.data['session_token']}",
        )
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["user"]["username"], "doctor.one")

    def test_assistant_is_not_administrator(self):
        clinic_payload = self.create_clinic()
        response = self.register_staff(
            clinic_payload["clinic_access_token"],
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(response.data["user"]["is_clinic_admin"])

    def test_only_one_account_per_role_is_allowed(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["clinic_access_token"]
        first = self.register_staff(token, "doctor", "doctor.one", "one@example.com")
        second = self.register_staff(token, "doctor", "doctor.two", "two@example.com")

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(
            StaffUser.objects.filter(clinic__email="clinic@example.com", role="doctor").count(),
            1,
        )

    def test_existing_staff_can_sign_in_only_through_their_clinic_and_role(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["clinic_access_token"]
        self.register_staff(token, "doctor", "doctor.one", "doctor@example.com")

        success = self.client.post(
            "/api/staff/login/",
            {
                "role": "doctor",
                "username": "doctor.one",
                "password": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_CLINIC_TOKEN=token,
        )
        wrong_role = self.client.post(
            "/api/staff/login/",
            {
                "role": "assistant",
                "username": "doctor.one",
                "password": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_CLINIC_TOKEN=token,
        )

        self.assertEqual(success.status_code, status.HTTP_200_OK)
        self.assertEqual(wrong_role.status_code, status.HTTP_400_BAD_REQUEST)

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

    def test_clinic_context_reports_both_created_roles(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["clinic_access_token"]
        self.register_staff(token, "doctor", "doctor.one", "doctor@example.com")
        self.register_staff(
            token,
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        response = self.client.get(
            "/api/clinic/context/",
            HTTP_X_CLINIC_TOKEN=token,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["roles"]["doctor"]["exists"])
        self.assertTrue(response.data["roles"]["doctor"]["is_administrator"])
        self.assertTrue(response.data["roles"]["assistant"]["exists"])
        self.assertFalse(response.data["roles"]["assistant"]["is_administrator"])

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
