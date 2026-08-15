from django.test import override_settings
from rest_framework import status
from rest_framework.test import APIClient, APITestCase


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class DeviceSessionBindingTests(APITestCase):
    def setUp(self):
        clinic = self.client.post(
            "/api/clinics/",
            {
                "name": "North Clinic",
                "email": "clinic@example.com",
                "phone": "+33 1 00 00 00 00",
            },
            format="json",
        ).data
        self.device_token = clinic["device_token"]
        doctor = self.client.post(
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
        ).data
        self.session_token = doctor["session_token"]

    def test_bearer_session_cannot_be_replayed_without_its_trusted_device(self):
        copied_session_client = APIClient()
        without_device = copied_session_client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=f"Bearer {self.session_token}",
        )
        wrong_device = copied_session_client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=f"Bearer {self.session_token}",
            HTTP_X_DEVICE_TOKEN="not-the-session-device",
        )
        correct_device = copied_session_client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=f"Bearer {self.session_token}",
            HTTP_X_DEVICE_TOKEN=self.device_token,
        )

        self.assertEqual(without_device.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(wrong_device.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(correct_device.status_code, status.HTTP_200_OK)
