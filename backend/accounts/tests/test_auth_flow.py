import re
from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import Clinic, StaffMembership, StaffSession, StaffUser, TrustedDevice
from accounts.services import anonymize_dormant_assistants
from patients.models import Patient


sent_sms = []


def capture_sms(destination, message):
    sent_sms.append((destination, message))


def code_from_message(message):
    match = re.search(r"\b(\d{6})\b", message)
    if not match:
        raise AssertionError(f"No six-digit code in: {message}")
    return match.group(1)


@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    SMS_SENDER="accounts.tests.test_auth_flow.capture_sms",
    VERIFICATION_RESEND_MIN_AGE=0,
    STAFF_SESSION_INACTIVITY_AGE=7200,
    ASSISTANT_SETUP_MAX_AGE=86400,
)
class AuthenticationFlowTests(APITestCase):
    password = "Strong-staff-password-123"
    user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36"

    def setUp(self):
        sent_sms.clear()

    def auth(self, session_token, device_token=None):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {session_token}"}
        if device_token:
            headers["HTTP_X_DEVICE_TOKEN"] = device_token
        return headers

    def register(self, role="doctor", email="doctor@example.com", phone="+33611111111", client=None):
        client = client or self.client
        response = client.post(
            "/api/staff/register/",
            {
                "role": role,
                "email": email,
                "phone": phone,
                "first_name": "Test",
                "last_name": role.title(),
                "password": self.password,
                "password_confirm": self.password,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], role)
        self.assertFalse(response.data["user"]["account_ready"])
        return response

    def verify_contacts(self, session_token, client=None):
        client = client or self.client
        headers = self.auth(session_token)
        email_request = client.post("/api/staff/verify/email/request/", {}, format="json", **headers)
        self.assertEqual(email_request.status_code, status.HTTP_200_OK)
        email_code = code_from_message(mail.outbox[-1].body)
        email_confirm = client.post(
            "/api/staff/verify/email/confirm/",
            {"code": email_code},
            format="json",
            **headers,
        )
        self.assertEqual(email_confirm.status_code, status.HTTP_200_OK)

        phone_request = client.post("/api/staff/verify/phone/request/", {}, format="json", **headers)
        self.assertEqual(phone_request.status_code, status.HTTP_200_OK)
        phone_code = code_from_message(sent_sms[-1][1])
        phone_confirm = client.post(
            "/api/staff/verify/phone/confirm/",
            {"code": phone_code},
            format="json",
            **headers,
        )
        self.assertEqual(phone_confirm.status_code, status.HTTP_200_OK)
        self.assertTrue(phone_confirm.data["user"]["account_ready"])
        return phone_confirm.data["user"]

    def create_doctor_clinic(self, name="North Clinic", email="doctor@example.com", phone="+33611111111"):
        registered = self.register("doctor", email, phone)
        token = registered.data["session_token"]
        self.verify_contacts(token)
        created = self.client.post(
            "/api/clinics/",
            {"name": name, "timezone": "Europe/Paris"},
            format="json",
            HTTP_USER_AGENT=self.user_agent,
            **self.auth(token),
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        return registered, created

    def create_assistant_for_clinic(self, doctor_token, doctor_device, *, email="assistant@example.com", phone="+33622222222"):
        setup = self.client.post(
            "/api/clinic/assistant/setup/",
            {"replace_existing": False},
            format="json",
            **self.auth(doctor_token, doctor_device),
        )
        self.assertEqual(setup.status_code, status.HTTP_201_CREATED)
        assistant = self.register("assistant", email, phone)
        assistant_token = assistant.data["session_token"]
        self.verify_contacts(assistant_token)
        claim = self.client.post(
            "/api/clinic/assistant/setup/claim/",
            {"code": setup.data["setup_code"]},
            format="json",
            HTTP_USER_AGENT=self.user_agent,
            **self.auth(assistant_token),
        )
        self.assertEqual(claim.status_code, status.HTTP_201_CREATED)
        return assistant, claim

    def login(self, role, identity, *, client=None, device_token=None):
        client = client or self.client
        extra = {"HTTP_X_DEVICE_TOKEN": device_token} if device_token else {}
        return client.post(
            "/api/staff/login/",
            {"role": role, "identity": identity, "password": self.password},
            format="json",
            **extra,
        )

    def select_clinic(self, token, clinic_id, role, device_token, *, client=None):
        client = client or self.client
        return client.post(
            "/api/staff/select-clinic/",
            {"clinic_id": clinic_id, "workspace_role": role},
            format="json",
            **self.auth(token, device_token),
        )

    def test_account_role_is_permanent_and_wrong_role_login_is_rejected(self):
        registered, created = self.create_doctor_clinic()
        user = StaffUser.objects.get(email="doctor@example.com")
        membership = user.memberships.get()
        self.assertEqual(user.role, StaffUser.Role.DOCTOR)
        self.assertEqual(membership.role, StaffUser.Role.DOCTOR)
        self.assertNotIn("role", {field.name for field in StaffMembership._meta.fields})
        self.assertEqual(created.data["user"]["role"], "doctor")

        wrong = self.login("assistant", "doctor@example.com", device_token=created.data["device_token"])
        self.assertEqual(wrong.status_code, status.HTTP_400_BAD_REQUEST)
        correct = self.login("doctor", "doctor@example.com", device_token=created.data["device_token"])
        self.assertEqual(correct.status_code, status.HTTP_200_OK)
        self.assertTrue(correct.data["user"]["device_trusted"])

    def test_both_contacts_are_required_before_doctor_can_create_clinic(self):
        registered = self.register()
        token = registered.data["session_token"]
        blocked = self.client.post(
            "/api/clinics/",
            {"name": "Blocked Clinic", "timezone": "Europe/Paris"},
            format="json",
            **self.auth(token),
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.verify_contacts(token)
        allowed = self.client.post(
            "/api/clinics/",
            {"name": "Allowed Clinic", "timezone": "Europe/Paris"},
            format="json",
            HTTP_USER_AGENT=self.user_agent,
            **self.auth(token),
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(allowed.data["user"]["workspace_role"], "doctor")
        self.assertEqual(Clinic.objects.get().owner_doctor.email, "doctor@example.com")
        self.assertEqual(TrustedDevice.objects.get().user.email, "doctor@example.com")

    def test_onboarding_contact_correction_invalidates_only_the_edited_contact(self):
        registered = self.register()
        token = registered.data["session_token"]
        headers = self.auth(token)

        email_request = self.client.post("/api/staff/verify/email/request/", {}, format="json", **headers)
        email_code = code_from_message(mail.outbox[-1].body)
        email_confirm = self.client.post(
            "/api/staff/verify/email/confirm/",
            {"code": email_code},
            format="json",
            **headers,
        )
        self.assertTrue(email_confirm.data["user"]["email_verified"])

        pending_change = self.client.post(
            "/api/staff/email/change/request/",
            {"value": "pending@example.com", "current_password": self.password},
            format="json",
            **headers,
        )
        self.assertEqual(pending_change.status_code, status.HTTP_200_OK)
        stale_change_code = code_from_message(mail.outbox[-1].body)

        wrong_password = self.client.patch(
            "/api/staff/verification-contact/",
            {"kind": "email", "value": "corrected@example.com", "current_password": "wrong"},
            format="json",
            **headers,
        )
        self.assertEqual(wrong_password.status_code, status.HTTP_403_FORBIDDEN)

        corrected_email = self.client.patch(
            "/api/staff/verification-contact/",
            {"kind": "email", "value": "corrected@example.com", "current_password": self.password},
            format="json",
            **headers,
        )
        self.assertEqual(corrected_email.status_code, status.HTTP_200_OK)
        self.assertEqual(corrected_email.data["user"]["email"], "corrected@example.com")
        self.assertFalse(corrected_email.data["user"]["email_verified"])
        self.assertFalse(corrected_email.data["user"]["phone_verified"])

        stale_confirm = self.client.post(
            "/api/staff/email/change/confirm/",
            {"code": stale_change_code},
            format="json",
            **headers,
        )
        self.assertEqual(stale_confirm.status_code, status.HTTP_400_BAD_REQUEST)

        corrected_request = self.client.post("/api/staff/verify/email/request/", {}, format="json", **headers)
        self.assertEqual(corrected_request.status_code, status.HTTP_200_OK)
        self.assertEqual(mail.outbox[-1].to, ["corrected@example.com"])
        corrected_code = code_from_message(mail.outbox[-1].body)
        corrected_confirm = self.client.post(
            "/api/staff/verify/email/confirm/",
            {"code": corrected_code},
            format="json",
            **headers,
        )
        self.assertTrue(corrected_confirm.data["user"]["email_verified"])

        corrected_phone = self.client.patch(
            "/api/staff/verification-contact/",
            {"kind": "phone", "value": "+33655555555", "current_password": self.password},
            format="json",
            **headers,
        )
        self.assertEqual(corrected_phone.status_code, status.HTTP_200_OK)
        self.assertTrue(corrected_phone.data["user"]["email_verified"])
        self.assertFalse(corrected_phone.data["user"]["phone_verified"])

        phone_request = self.client.post("/api/staff/verify/phone/request/", {}, format="json", **headers)
        phone_code = code_from_message(sent_sms[-1][1])
        ready = self.client.post(
            "/api/staff/verify/phone/confirm/",
            {"code": phone_code},
            format="json",
            **headers,
        )
        self.assertTrue(ready.data["user"]["account_ready"])
        self.assertEqual(phone_request.data["resend_after_seconds"], 0)

        blocked_after_onboarding = self.client.patch(
            "/api/staff/verification-contact/",
            {"kind": "phone", "value": "+33666666666", "current_password": self.password},
            format="json",
            **headers,
        )
        self.assertEqual(blocked_after_onboarding.status_code, status.HTTP_403_FORBIDDEN)

    @override_settings(VERIFICATION_RESEND_MIN_AGE=60)
    def test_verification_requests_publish_and_enforce_the_resend_delay(self):
        registered = self.register()
        token = registered.data["session_token"]
        first = self.client.post(
            "/api/staff/verify/email/request/",
            {},
            format="json",
            **self.auth(token),
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["resend_after_seconds"], 60)
        second = self.client.post(
            "/api/staff/verify/email/request/",
            {},
            format="json",
            **self.auth(token),
        )
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    @override_settings(VERIFICATION_RESEND_MIN_AGE=60)
    def test_pending_verification_state_restores_after_reload_and_requires_six_digits(self):
        registered = self.register()
        token = registered.data["session_token"]
        headers = self.auth(token)
        requested = self.client.post(
            "/api/staff/verify/email/request/",
            {},
            format="json",
            **headers,
        )
        self.assertEqual(requested.status_code, status.HTTP_200_OK)
        self.assertIn("resend_available_at", requested.data)

        restored = self.client.get("/api/staff/verification-state/", **headers)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.data["email"]["channel"], "email")
        self.assertGreater(restored.data["email"]["resend_after_seconds"], 0)
        self.assertIsNone(restored.data["phone"])

        incomplete = self.client.post(
            "/api/staff/verify/email/confirm/",
            {"code": "12345"},
            format="json",
            **headers,
        )
        self.assertEqual(incomplete.status_code, status.HTTP_400_BAD_REQUEST)

        confirmed = self.client.post(
            "/api/staff/verify/email/confirm/",
            {"code": code_from_message(mail.outbox[-1].body)},
            format="json",
            **headers,
        )
        self.assertEqual(confirmed.status_code, status.HTTP_200_OK)
        cleared = self.client.get("/api/staff/verification-state/", **headers)
        self.assertIsNone(cleared.data["email"])

    def test_pending_contact_replacement_can_be_cancelled_and_code_is_consumed(self):
        registered, clinic = self.create_doctor_clinic()
        token = registered.data["session_token"]
        headers = self.auth(token, clinic.data["device_token"])
        requested = self.client.post(
            "/api/staff/email/change/request/",
            {"value": "pending-doctor@example.com", "current_password": self.password},
            format="json",
            **headers,
        )
        self.assertEqual(requested.status_code, status.HTTP_200_OK)
        pending_code = code_from_message(mail.outbox[-1].body)

        restored = self.client.get("/api/staff/verification-state/", **headers)
        self.assertEqual(restored.data["email_change"]["pending_value"], "pending-doctor@example.com")
        cancelled = self.client.post(
            "/api/staff/email/change/cancel/",
            {},
            format="json",
            **headers,
        )
        self.assertEqual(cancelled.status_code, status.HTTP_200_OK)
        self.assertEqual(cancelled.data["user"]["email"], "doctor@example.com")
        self.assertIsNone(self.client.get("/api/staff/verification-state/", **headers).data["email_change"])

        stale = self.client.post(
            "/api/staff/email/change/confirm/",
            {"code": pending_code},
            format="json",
            **headers,
        )
        self.assertEqual(stale.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(StaffUser.objects.get(pk=registered.data["user"]["id"]).email, "doctor@example.com")

    def test_registration_rejects_password_containing_displayed_personal_information(self):
        response = self.client.post(
            "/api/staff/register/",
            {
                "role": "doctor",
                "email": "personal-password@example.com",
                "phone": "+33699999999",
                "first_name": "Demo",
                "last_name": "Doctor",
                "password": "Strong-demo-password-123",
                "password_confirm": "Strong-demo-password-123",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_password_change_and_recovery_enforce_exact_codes_and_personal_information_rule(self):
        registered, clinic = self.create_doctor_clinic()
        token = registered.data["session_token"]
        headers = self.auth(token, clinic.data["device_token"])
        requested = self.client.post(
            "/api/staff/password/change/request/",
            {"channel": "email"},
            format="json",
            **headers,
        )
        self.assertEqual(requested.status_code, status.HTTP_200_OK)
        change_code = code_from_message(mail.outbox[-1].body)
        self.assertEqual(
            self.client.get("/api/staff/verification-state/", **headers).data["password_change"]["channel"],
            "email",
        )

        incomplete = self.client.post(
            "/api/staff/password/change/confirm/",
            {
                "code": change_code[:5],
                "password": "Strong-clinic-password-456",
                "password_confirm": "Strong-clinic-password-456",
            },
            format="json",
            **headers,
        )
        self.assertEqual(incomplete.status_code, status.HTTP_400_BAD_REQUEST)
        personal = self.client.post(
            "/api/staff/password/change/confirm/",
            {
                "code": change_code,
                "password": "Strong-doctor-password-456",
                "password_confirm": "Strong-doctor-password-456",
            },
            format="json",
            **headers,
        )
        self.assertEqual(personal.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", personal.data)

        changed = self.client.post(
            "/api/staff/password/change/confirm/",
            {
                "code": change_code,
                "password": "Strong-clinic-password-456",
                "password_confirm": "Strong-clinic-password-456",
            },
            format="json",
            **headers,
        )
        self.assertEqual(changed.status_code, status.HTTP_200_OK)

        recovery_requested = self.client.post(
            "/api/recovery/request/",
            {"identity": "doctor@example.com", "channel": "email"},
            format="json",
        )
        self.assertEqual(recovery_requested.status_code, status.HTTP_200_OK)
        recovery_code = code_from_message(mail.outbox[-1].body)
        recovery_confirmed = self.client.post(
            "/api/recovery/confirm/",
            {"identity": "doctor@example.com", "code": recovery_code},
            format="json",
        )
        self.assertEqual(recovery_confirmed.status_code, status.HTTP_200_OK)
        rejected_reset = self.client.post(
            "/api/recovery/reset/",
            {
                "recovery_token": recovery_confirmed.data["recovery_token"],
                "password": "Strong-doctor-password-789",
                "password_confirm": "Strong-doctor-password-789",
            },
            format="json",
        )
        self.assertEqual(rejected_reset.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", rejected_reset.data)

    def test_assistant_cannot_create_clinic_and_joins_with_doctor_setup_code(self):
        doctor, clinic = self.create_doctor_clinic()
        assistant, claim = self.create_assistant_for_clinic(
            doctor.data["session_token"],
            clinic.data["device_token"],
        )
        self.assertEqual(claim.data["user"]["role"], "assistant")
        self.assertEqual(claim.data["user"]["workspace_role"], "assistant")
        self.assertTrue(claim.data["device_token"])
        assistant_token = assistant.data["session_token"]
        blocked = self.client.post(
            "/api/clinics/",
            {"name": "Assistant Clinic", "timezone": "Europe/Paris"},
            format="json",
            **self.auth(assistant_token, claim.data["device_token"]),
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    def test_assistant_setup_claim_is_idempotent_for_the_same_account(self):
        doctor, clinic = self.create_doctor_clinic()
        setup = self.client.post(
            "/api/clinic/assistant/setup/",
            {"replace_existing": False},
            format="json",
            **self.auth(doctor.data["session_token"], clinic.data["device_token"]),
        )
        assistant = self.register("assistant", "assistant@example.com", "+33622222222")
        assistant_token = assistant.data["session_token"]
        self.verify_contacts(assistant_token)

        first = self.client.post(
            "/api/clinic/assistant/setup/claim/",
            {"code": setup.data["setup_code"]},
            format="json",
            HTTP_USER_AGENT=self.user_agent,
            **self.auth(assistant_token),
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)

        retry = self.client.post(
            "/api/clinic/assistant/setup/claim/",
            {"code": setup.data["setup_code"]},
            format="json",
            HTTP_USER_AGENT=self.user_agent,
            **self.auth(assistant_token, first.data["device_token"]),
        )
        self.assertEqual(retry.status_code, status.HTTP_200_OK)
        self.assertEqual(retry.data["membership"]["id"], first.data["membership"]["id"])
        self.assertEqual(retry.data["user"]["workspace_role"], "assistant")
        self.assertEqual(
            StaffMembership.objects.filter(
                user__email="assistant@example.com",
                clinic_id=clinic.data["clinic"]["id"],
                is_active=True,
            ).count(),
            1,
        )

        other = self.register("assistant", "other-assistant@example.com", "+33644444444")
        self.verify_contacts(other.data["session_token"])
        occupied = self.client.post(
            "/api/clinic/assistant/setup/claim/",
            {"code": setup.data["setup_code"]},
            format="json",
            **self.auth(other.data["session_token"]),
        )
        self.assertEqual(occupied.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(occupied.data["detail"], "The Assistant slot is already filled.")

    def test_global_trusted_device_works_for_multiple_doctor_clinics(self):
        registered, first = self.create_doctor_clinic("First Clinic")
        token = registered.data["session_token"]
        device = first.data["device_token"]
        second = self.client.post(
            "/api/clinics/",
            {"name": "Second Clinic", "timezone": "Europe/Paris"},
            format="json",
            **self.auth(token, device),
        )
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("device_token", second.data)
        self.assertEqual(TrustedDevice.objects.filter(user__email="doctor@example.com").count(), 1)

        leave = self.client.post("/api/staff/leave-clinic/", {}, format="json", **self.auth(token, device))
        self.assertEqual(leave.status_code, status.HTTP_200_OK)
        first_id = first.data["clinic"]["id"]
        selected = self.select_clinic(token, first_id, "doctor", device)
        self.assertEqual(selected.status_code, status.HTTP_200_OK)
        self.assertEqual(selected.data["user"]["clinic"]["id"], first_id)

    def test_reusing_account_device_updates_last_used_without_creating_a_duplicate(self):
        registered, clinic = self.create_doctor_clinic()
        device = TrustedDevice.objects.get(user__email="doctor@example.com")
        previous_use = timezone.now() - timedelta(days=1)
        TrustedDevice.objects.filter(pk=device.id).update(last_used_at=previous_use)

        login = self.login(
            "doctor",
            "doctor@example.com",
            device_token=clinic.data["device_token"],
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertTrue(login.data["user"]["device_trusted"])
        device.refresh_from_db()
        self.assertGreater(device.last_used_at, previous_use)
        self.assertEqual(TrustedDevice.objects.filter(user__email="doctor@example.com").count(), 1)

        listing = self.client.get(
            "/api/devices/",
            **self.auth(login.data["session_token"], clinic.data["device_token"]),
        )
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertIn("last_used_at", listing.data["devices"][0])

    def test_doctor_defaults_to_doctor_role_but_can_open_assistant_workspace_as_admin(self):
        registered, clinic = self.create_doctor_clinic()
        token = registered.data["session_token"]
        device = clinic.data["device_token"]
        clinic_id = clinic.data["clinic"]["id"]
        admin = self.select_clinic(token, clinic_id, "assistant", device)
        self.assertEqual(admin.status_code, status.HTTP_200_OK)
        self.assertEqual(admin.data["user"]["role"], "doctor")
        self.assertEqual(admin.data["user"]["workspace_role"], "assistant")

        assistant, claim = self.create_assistant_for_clinic(token, device)
        forbidden = self.select_clinic(
            assistant.data["session_token"],
            clinic_id,
            "doctor",
            claim.data["device_token"],
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_untrusted_login_requires_one_device_otp_then_device_is_global(self):
        registered, clinic = self.create_doctor_clinic()
        original_device = clinic.data["device_token"]
        fresh = APIClient()
        login = self.login("doctor", "doctor@example.com", client=fresh)
        self.assertEqual(login.status_code, status.HTTP_200_OK)
        self.assertFalse(login.data["user"]["device_trusted"])
        token = login.data["session_token"]

        request = fresh.post(
            "/api/devices/contact/request/",
            {"channel": "email"},
            format="json",
            **self.auth(token),
        )
        self.assertEqual(request.status_code, status.HTTP_200_OK)
        code = code_from_message(mail.outbox[-1].body)
        confirm = fresh.post(
            "/api/devices/contact/confirm/",
            {"code": code},
            format="json",
            HTTP_USER_AGENT="Firefox on another machine",
            **self.auth(token),
        )
        self.assertEqual(confirm.status_code, status.HTTP_201_CREATED)
        new_device = confirm.data["device_token"]
        self.assertNotEqual(new_device, original_device)

        clinic_id = clinic.data["clinic"]["id"]
        selected = self.select_clinic(token, clinic_id, "doctor", new_device, client=fresh)
        self.assertEqual(selected.status_code, status.HTTP_200_OK)
        self.assertEqual(TrustedDevice.objects.filter(user__email="doctor@example.com").count(), 2)

    def test_current_device_cannot_be_removed_and_other_device_removal_revokes_its_sessions(self):
        registered, clinic = self.create_doctor_clinic()
        original_device = clinic.data["device_token"]
        fresh = APIClient()
        login = self.login("doctor", "doctor@example.com", client=fresh)
        token = login.data["session_token"]
        fresh.post("/api/devices/contact/request/", {"channel": "email"}, format="json", **self.auth(token))
        code = code_from_message(mail.outbox[-1].body)
        confirmed = fresh.post("/api/devices/contact/confirm/", {"code": code}, format="json", **self.auth(token))
        new_device = confirmed.data["device_token"]
        clinic_id = clinic.data["clinic"]["id"]
        self.select_clinic(token, clinic_id, "doctor", new_device, client=fresh)

        listing = fresh.get("/api/devices/", **self.auth(token, new_device))
        current = next(item for item in listing.data["devices"] if item["current"])
        other = next(item for item in listing.data["devices"] if not item["current"])
        blocked = fresh.delete(f"/api/devices/{current['id']}/", **self.auth(token, new_device))
        self.assertEqual(blocked.status_code, status.HTTP_400_BAD_REQUEST)
        removed = fresh.delete(f"/api/devices/{other['id']}/", **self.auth(token, new_device))
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(TrustedDevice.objects.filter(token_hash__isnull=False).exclude(pk=current["id"]).exists())
        self.assertFalse(StaffSession.objects.filter(user__email="doctor@example.com", trusted_device_id=other["id"]).exists())
        self.assertTrue(TrustedDevice.objects.filter(pk=current["id"]).exists())
        self.assertNotEqual(original_device, new_device)

    def test_login_does_not_count_as_sensitive_reauthentication_for_contact_change(self):
        registered, clinic = self.create_doctor_clinic()
        device = clinic.data["device_token"]
        login = self.login("doctor", "doctor@example.com", device_token=device)
        token = login.data["session_token"]
        blocked = self.client.post(
            "/api/staff/email/change/request/",
            {"value": "new-doctor@example.com"},
            format="json",
            **self.auth(token, device),
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        reauth = self.client.post(
            "/api/staff/reauthenticate/password/",
            {"password": self.password},
            format="json",
            **self.auth(token, device),
        )
        self.assertEqual(reauth.status_code, status.HTTP_200_OK)
        allowed = self.client.post(
            "/api/staff/email/change/request/",
            {"value": "new-doctor@example.com"},
            format="json",
            **self.auth(token, device),
        )
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_replacing_assistant_only_deactivates_this_clinic_membership(self):
        doctor1, clinic1 = self.create_doctor_clinic("Clinic One")
        assistant, claim1 = self.create_assistant_for_clinic(
            doctor1.data["session_token"], clinic1.data["device_token"]
        )
        assistant_user = StaffUser.objects.get(email="assistant@example.com")

        doctor2 = self.register("doctor", "doctor2@example.com", "+33633333333")
        doctor2_token = doctor2.data["session_token"]
        self.verify_contacts(doctor2_token)
        clinic2 = self.client.post(
            "/api/clinics/",
            {"name": "Clinic Two", "timezone": "Europe/Paris"},
            format="json",
            **self.auth(doctor2_token),
        )
        setup2 = self.client.post(
            "/api/clinic/assistant/setup/",
            {"replace_existing": False},
            format="json",
            **self.auth(doctor2_token, clinic2.data["device_token"]),
        )
        assistant_login = self.login("assistant", "assistant@example.com", device_token=claim1.data["device_token"])
        join2 = self.client.post(
            "/api/clinic/assistant/setup/claim/",
            {"code": setup2.data["setup_code"]},
            format="json",
            **self.auth(assistant_login.data["session_token"], claim1.data["device_token"]),
        )
        self.assertEqual(join2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(assistant_user.memberships.filter(is_active=True).count(), 2)

        replaced = self.client.post(
            "/api/clinic/assistant/setup/",
            {"replace_existing": True},
            format="json",
            **self.auth(doctor1.data["session_token"], clinic1.data["device_token"]),
        )
        self.assertEqual(replaced.status_code, status.HTTP_201_CREATED)
        assistant_user.refresh_from_db()
        self.assertEqual(assistant_user.memberships.filter(is_active=True).count(), 1)
        self.assertIsNone(assistant_user.dormant_since)
        self.assertTrue(assistant_user.is_active)

    def test_zero_memberships_starts_dormancy_and_two_year_cleanup_anonymizes(self):
        doctor, clinic = self.create_doctor_clinic()
        assistant, claim = self.create_assistant_for_clinic(
            doctor.data["session_token"], clinic.data["device_token"]
        )
        assistant_user = StaffUser.objects.get(email="assistant@example.com")
        removed = self.client.delete(
            "/api/clinic/assistant/",
            **self.auth(doctor.data["session_token"], clinic.data["device_token"]),
        )
        self.assertEqual(removed.status_code, status.HTTP_204_NO_CONTENT)
        assistant_user.refresh_from_db()
        self.assertIsNotNone(assistant_user.dormant_since)
        self.assertTrue(assistant_user.is_active)

        assistant_user.dormant_since = timezone.now() - timedelta(days=731)
        assistant_user.private_note = "Must disappear"
        assistant_user.save(update_fields=["dormant_since", "private_note"])
        count = anonymize_dormant_assistants()
        self.assertEqual(count, 1)
        assistant_user.refresh_from_db()
        self.assertFalse(assistant_user.is_active)
        self.assertIsNotNone(assistant_user.anonymized_at)
        self.assertEqual(assistant_user.display_name, "Former Assistant")
        self.assertEqual(assistant_user.private_note, "")
        self.assertIsNone(assistant_user.phone)
        self.assertTrue(assistant_user.email.endswith("@deleted.invalid"))
        self.assertTrue(assistant_user.memberships.exists())

    def test_assistant_has_no_account_delete_but_doctor_delete_cascades_owned_clinic_only(self):
        doctor, clinic = self.create_doctor_clinic()
        assistant, claim = self.create_assistant_for_clinic(
            doctor.data["session_token"], clinic.data["device_token"]
        )
        assistant_token = assistant.data["session_token"]
        assistant_device = claim.data["device_token"]
        assistant_delete = self.client.delete(
            "/api/staff/account/",
            {"confirmation": "DELETE", "current_password": self.password},
            format="json",
            **self.auth(assistant_token, assistant_device),
        )
        self.assertEqual(assistant_delete.status_code, status.HTTP_403_FORBIDDEN)

        doctor_token = doctor.data["session_token"]
        doctor_device = clinic.data["device_token"]
        preview = self.client.get("/api/staff/account/", **self.auth(doctor_token, doctor_device))
        self.assertEqual([item["name"] for item in preview.data["clinics"]], ["North Clinic"])
        deleted = self.client.delete(
            "/api/staff/account/",
            {"confirmation": "DELETE", "current_password": self.password},
            format="json",
            **self.auth(doctor_token, doctor_device),
        )
        self.assertEqual(deleted.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StaffUser.objects.filter(email="doctor@example.com").exists())
        self.assertFalse(Clinic.objects.filter(name="North Clinic").exists())
        self.assertTrue(StaffUser.objects.filter(email="assistant@example.com").exists())

    def test_doctor_recovery_codes_are_one_time_and_assistant_is_denied(self):
        doctor, clinic = self.create_doctor_clinic()
        generated = self.client.post(
            "/api/staff/recovery-codes/",
            {},
            format="json",
            **self.auth(doctor.data["session_token"], clinic.data["device_token"]),
        )
        self.assertEqual(generated.status_code, status.HTTP_200_OK)
        self.assertEqual(len(generated.data["codes"]), 10)
        code = generated.data["codes"][0]

        confirm = self.client.post(
            "/api/recovery/code/confirm/",
            {"identity": "doctor@example.com", "code": code},
            format="json",
        )
        self.assertEqual(confirm.status_code, status.HTTP_200_OK)
        reused = self.client.post(
            "/api/recovery/code/confirm/",
            {"identity": "doctor@example.com", "code": code},
            format="json",
        )
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)

        assistant, claim = self.create_assistant_for_clinic(
            doctor.data["session_token"], clinic.data["device_token"],
            email="assistant-recovery@example.com", phone="+33644444444",
        )
        denied = self.client.post(
            "/api/staff/recovery-codes/",
            {},
            format="json",
            **self.auth(assistant.data["session_token"], claim.data["device_token"]),
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)
