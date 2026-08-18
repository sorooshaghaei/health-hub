from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import StaffUser
from accounts.services import issue_staff_session, issue_trusted_device


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class DeviceSessionBindingTests(APITestCase):
    def setUp(self):
        self.user = StaffUser.objects.create_user(
            role=StaffUser.Role.DOCTOR,
            email="doctor@example.com",
            phone="+33611111111",
            password="Strong-staff-password-123",
            email_verified_at=timezone.now(),
            phone_verified_at=timezone.now(),
        )
        self.device_token, device = issue_trusted_device(
            self.user,
            "Mozilla/5.0 Chrome/151.0.0.0",
        )
        self.session_token, _ = issue_staff_session(
            self.user,
            trusted_device=device,
        )

    def test_bearer_session_cannot_be_replayed_without_its_global_trusted_device(self):
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
