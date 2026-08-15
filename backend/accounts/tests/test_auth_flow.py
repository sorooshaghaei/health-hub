from datetime import timedelta

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic, DevicePairingRequest, StaffSession, StaffUser, TrustedDevice


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
    DEVICE_PAIRING_MAX_AGE=600,
)
class AuthenticationFlowTests(APITestCase):
    clinic_data = {
        "name": "North Clinic",
        "email": "clinic@example.com",
        "phone": "+33 1 00 00 00 00",
    }

    user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36"

    def create_clinic(self):
        response = self.client.post(
            "/api/clinics/",
            self.clinic_data,
            format="json",
            HTTP_USER_AGENT=self.user_agent,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def register_staff(self, device_token, role, username, email):
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
            HTTP_X_DEVICE_TOKEN=device_token,
        )

    def login_staff(self, device_token, role, username):
        return self.client.post(
            "/api/staff/login/",
            {
                "role": role,
                "username": username,
                "password": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=device_token,
        )

    def authorization(self, response):
        return f"Bearer {response.data['session_token']}"

    def create_doctor(self, device_token):
        response = self.register_staff(
            device_token,
            "doctor",
            "doctor.one",
            "doctor@example.com",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def test_new_clinic_automatically_trusts_the_first_browser(self):
        payload = self.create_clinic()
        clinic = Clinic.objects.get(email=self.clinic_data["email"])

        self.assertNotIn("password_hash", {field.name for field in Clinic._meta.fields})
        self.assertFalse(payload["roles"]["doctor"]["exists"])
        self.assertFalse(payload["roles"]["assistant"]["exists"])
        self.assertTrue(payload["device_token"])
        self.assertEqual(clinic.trusted_devices.count(), 1)
        device = clinic.trusted_devices.get()
        self.assertEqual(device.browser, "Chrome")
        self.assertEqual(device.operating_system, "macOS")
        self.assertTrue(payload["trusted_device"]["current"])

        context = self.client.get(
            "/api/clinic/context/",
            HTTP_X_DEVICE_TOKEN=payload["device_token"],
        )
        self.assertEqual(context.status_code, status.HTTP_200_OK)
        self.assertEqual(context.data["clinic"]["id"], str(clinic.id))

    def test_clinic_context_rejects_an_untrusted_browser(self):
        self.create_clinic()
        missing = self.client.get("/api/clinic/context/")
        invalid = self.client.get(
            "/api/clinic/context/",
            HTTP_X_DEVICE_TOKEN="not-a-device-token",
        )
        self.assertEqual(missing.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(invalid.status_code, status.HTTP_403_FORBIDDEN)

    def test_registration_uses_each_accounts_own_workspace(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["device_token"]
        assistant = self.register_staff(
            token,
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )
        doctor = self.create_doctor(token)

        self.assertEqual(assistant.status_code, status.HTTP_201_CREATED)
        self.assertEqual(assistant.data["user"]["workspace_role"], "assistant")
        self.assertEqual(doctor.data["user"]["workspace_role"], "doctor")

    def test_doctor_credentials_can_open_doctor_or_assistant_workspace(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["device_token"]
        self.create_doctor(token)
        self.register_staff(
            token,
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        doctor_workspace = self.login_staff(token, "doctor", "doctor.one")
        assistant_workspace = self.login_staff(token, "assistant", "doctor.one")

        self.assertEqual(doctor_workspace.status_code, status.HTTP_200_OK)
        self.assertEqual(doctor_workspace.data["user"]["workspace_role"], "doctor")
        self.assertEqual(assistant_workspace.status_code, status.HTTP_200_OK)
        self.assertEqual(assistant_workspace.data["user"]["role"], "doctor")
        self.assertEqual(assistant_workspace.data["user"]["workspace_role"], "assistant")

        me_response = self.client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=self.authorization(assistant_workspace),
        )
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["user"]["role"], "doctor")
        self.assertEqual(me_response.data["user"]["workspace_role"], "assistant")

    def test_assistant_credentials_cannot_open_doctor_workspace(self):
        clinic_payload = self.create_clinic()
        token = clinic_payload["device_token"]
        self.create_doctor(token)
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
        token = clinic_payload["device_token"]
        first = self.create_doctor(token)
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

    def test_untrusted_browser_pairs_only_after_approval_from_trusted_session(self):
        clinic_payload = self.create_clinic()
        device_token = clinic_payload["device_token"]
        doctor = self.create_doctor(device_token)

        start = self.client.post(
            "/api/devices/pairing/",
            {"clinic_email": "clinic@example.com"},
            format="json",
            HTTP_USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36",
        )
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(start.data["pairing_code"]), 6)
        self.assertNotIn("clinic", start.data)
        self.assertNotIn("device_token", start.data)

        pending = self.client.post(
            "/api/devices/pairing/status/",
            {"request_token": start.data["request_token"]},
            format="json",
        )
        self.assertEqual(pending.status_code, status.HTTP_200_OK)
        self.assertEqual(pending.data["status"], "pending")

        untrusted_login = self.login_staff("invalid-device-token", "doctor", "doctor.one")
        self.assertEqual(untrusted_login.status_code, status.HTTP_403_FORBIDDEN)

        approve = self.client.post(
            "/api/devices/pairing/approve/",
            {"code": start.data["pairing_code"]},
            format="json",
            HTTP_AUTHORIZATION=self.authorization(doctor),
        )
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        self.assertEqual(approve.data["browser"], "Chrome")
        self.assertEqual(approve.data["operating_system"], "Windows")

        second_approval = self.client.post(
            "/api/devices/pairing/approve/",
            {"code": start.data["pairing_code"]},
            format="json",
            HTTP_AUTHORIZATION=self.authorization(doctor),
        )
        self.assertEqual(second_approval.status_code, status.HTTP_400_BAD_REQUEST)

        claimed = self.client.post(
            "/api/devices/pairing/status/",
            {"request_token": start.data["request_token"]},
            format="json",
        )
        self.assertEqual(claimed.status_code, status.HTTP_200_OK)
        self.assertEqual(claimed.data["status"], "approved")
        self.assertTrue(claimed.data["device_token"])
        self.assertEqual(TrustedDevice.objects.count(), 2)

        paired_login = self.login_staff(
            claimed.data["device_token"],
            "doctor",
            "doctor.one",
        )
        self.assertEqual(paired_login.status_code, status.HTTP_200_OK)

    def test_expired_pairing_request_cannot_be_approved(self):
        clinic_payload = self.create_clinic()
        doctor = self.create_doctor(clinic_payload["device_token"])
        start = self.client.post(
            "/api/devices/pairing/",
            {"clinic_email": "clinic@example.com"},
            format="json",
        )
        pairing = DevicePairingRequest.objects.get()
        pairing.expires_at = timezone.now() - timedelta(seconds=1)
        pairing.save(update_fields=["expires_at"])

        approve = self.client.post(
            "/api/devices/pairing/approve/",
            {"code": start.data["pairing_code"]},
            format="json",
            HTTP_AUTHORIZATION=self.authorization(doctor),
        )
        self.assertEqual(approve.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(DevicePairingRequest.objects.exists())

    def test_device_list_and_revocation_are_available_to_both_roles(self):
        clinic_payload = self.create_clinic()
        first_token = clinic_payload["device_token"]
        doctor = self.create_doctor(first_token)
        assistant = self.register_staff(
            first_token,
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )

        second_start = self.client.post(
            "/api/devices/pairing/",
            {"clinic_email": "clinic@example.com"},
            format="json",
            HTTP_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) Firefox/141.0",
        )
        self.client.post(
            "/api/devices/pairing/approve/",
            {"code": second_start.data["pairing_code"]},
            format="json",
            HTTP_AUTHORIZATION=self.authorization(assistant),
        )
        second_claim = self.client.post(
            "/api/devices/pairing/status/",
            {"request_token": second_start.data["request_token"]},
            format="json",
        )
        second_login = self.login_staff(
            second_claim.data["device_token"],
            "doctor",
            "doctor.one",
        )

        devices = self.client.get(
            "/api/devices/",
            HTTP_AUTHORIZATION=self.authorization(assistant),
        )
        self.assertEqual(devices.status_code, status.HTTP_200_OK)
        self.assertEqual(len(devices.data["devices"]), 2)
        self.assertEqual(sum(1 for item in devices.data["devices"] if item["current"]), 1)

        second_device = next(item for item in devices.data["devices"] if not item["current"])
        removed = self.client.delete(
            f"/api/devices/{second_device['id']}/",
            HTTP_AUTHORIZATION=self.authorization(assistant),
        )
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)

        revoked_session = self.client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=self.authorization(second_login),
        )
        self.assertEqual(revoked_session.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(TrustedDevice.objects.count(), 1)
        self.assertEqual(StaffSession.objects.filter(user__username="doctor.one").count(), 1)

        only_device = TrustedDevice.objects.get()
        last_remove = self.client.delete(
            f"/api/devices/{only_device.id}/",
            HTTP_AUTHORIZATION=self.authorization(doctor),
        )
        self.assertEqual(last_remove.status_code, status.HTTP_409_CONFLICT)

    def test_shared_clinic_password_entry_endpoint_is_removed(self):
        self.create_clinic()
        response = self.client.post(
            "/api/clinics/enter/",
            {"email": "clinic@example.com", "password": "old-shared-password"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_logout_invalidates_staff_session_but_keeps_device_trusted(self):
        clinic_payload = self.create_clinic()
        doctor = self.create_doctor(clinic_payload["device_token"])
        authorization = self.authorization(doctor)

        logout_response = self.client.post(
            "/api/staff/logout/",
            HTTP_AUTHORIZATION=authorization,
        )
        me_response = self.client.get(
            "/api/staff/me/",
            HTTP_AUTHORIZATION=authorization,
        )
        context = self.client.get(
            "/api/clinic/context/",
            HTTP_X_DEVICE_TOKEN=clinic_payload["device_token"],
        )

        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(me_response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(context.status_code, status.HTTP_200_OK)
        self.assertEqual(TrustedDevice.objects.count(), 1)
