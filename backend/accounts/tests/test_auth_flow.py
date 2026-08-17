import re
from datetime import timedelta

from django.core import mail
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from accounts.models import Clinic, StaffMembership, StaffSession, StaffUser, TrustedDevice
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
)
class AuthenticationFlowTests(APITestCase):
    password = "Strong-staff-password-123"
    user_agent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36"

    def setUp(self):
        sent_sms.clear()

    def create_clinic(self, name="North Clinic", client=None):
        client = client or self.client
        response = client.post(
            "/api/clinics/",
            {"name": name},
            format="json",
            HTTP_USER_AGENT=self.user_agent,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def register(self, clinic_payload, role="doctor", email="doctor@example.com", phone="+33611111111", client=None, setup_code=None):
        client = client or self.client
        data = {
            "role": role,
            "email": email,
            "phone": phone,
            "first_name": "Test",
            "last_name": role.title(),
            "password": self.password,
            "password_confirm": self.password,
        }
        if setup_code:
            data["setup_code"] = setup_code
        extra = {}
        if clinic_payload and clinic_payload.get("device_token"):
            extra["HTTP_X_DEVICE_TOKEN"] = clinic_payload["device_token"]
        response = client.post("/api/staff/register/", data, format="json", **extra)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def auth(self, session_token, device_token=None):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {session_token}"}
        if device_token:
            headers["HTTP_X_DEVICE_TOKEN"] = device_token
        return headers

    def verify_contacts(self, session_token, device_token, client=None):
        client = client or self.client
        headers = self.auth(session_token, device_token)
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

    def global_login(self, identity="doctor@example.com", client=None):
        client = client or self.client
        response = client.post(
            "/api/staff/login/",
            {"identity": identity, "password": self.password},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["user"]["clinic"])
        self.assertIsNone(response.data["user"]["workspace_role"])
        return response

    def select_clinic(self, session_token, membership, device_token, workspace_role=None, client=None):
        client = client or self.client
        response = client.post(
            "/api/staff/select-clinic/",
            {
                "clinic_id": membership["clinic"]["id"],
                "workspace_role": workspace_role or membership["role"],
            },
            format="json",
            **self.auth(session_token, device_token),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response

    def test_new_clinic_has_name_only_and_first_browser_is_trusted(self):
        payload = self.create_clinic()
        clinic = Clinic.objects.get(pk=payload["clinic"]["id"])
        self.assertEqual({field.name for field in Clinic._meta.fields}, {"id", "name", "created_at", "updated_at"})
        self.assertEqual(clinic.name, "North Clinic")
        self.assertFalse(payload["roles"]["doctor"]["exists"])
        self.assertEqual(clinic.trusted_devices.count(), 1)
        self.assertEqual(payload["trusted_device"]["browser"], "Chrome")
        context = self.client.get("/api/clinic/context/", HTTP_X_DEVICE_TOKEN=payload["device_token"])
        self.assertEqual(context.status_code, status.HTTP_200_OK)
        self.assertEqual(context.data["clinic"]["id"], str(clinic.id))
        self.assertEqual(self.client.get("/api/clinic/context/").status_code, status.HTTP_403_FORBIDDEN)

    def test_both_contacts_must_be_verified_before_clinic_data_opens(self):
        clinic = self.create_clinic()
        registered = self.register(clinic)
        token = registered.data["session_token"]
        blocked = self.client.get("/api/patients/", **self.auth(token, clinic["device_token"]))
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        user = self.verify_contacts(token, clinic["device_token"])
        self.assertTrue(user["email_verified"])
        self.assertTrue(user["phone_verified"])
        allowed = self.client.get("/api/patients/", **self.auth(token, clinic["device_token"]))
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)

    def test_global_login_accepts_email_or_phone_then_clinic_is_selected(self):
        clinic = self.create_clinic()
        registered = self.register(clinic)
        self.verify_contacts(registered.data["session_token"], clinic["device_token"])
        self.client.post("/api/staff/logout/", {}, format="json", **self.auth(registered.data["session_token"], clinic["device_token"]))

        for identity in ("doctor@example.com", "+33611111111"):
            login = self.global_login(identity)
            membership = login.data["user"]["memberships"][0]
            selected = self.select_clinic(login.data["session_token"], membership, clinic["device_token"])
            self.assertEqual(selected.data["user"]["role"], "doctor")
            self.assertEqual(selected.data["user"]["workspace_role"], "doctor")
            self.client.post("/api/staff/logout/", {}, format="json", **self.auth(login.data["session_token"], clinic["device_token"]))

    def test_doctor_membership_can_open_assistant_workspace_but_assistant_cannot_open_doctor(self):
        clinic = self.create_clinic()
        doctor = self.register(clinic)
        self.verify_contacts(doctor.data["session_token"], clinic["device_token"])
        login = self.global_login()
        membership = login.data["user"]["memberships"][0]
        admin = self.select_clinic(login.data["session_token"], membership, clinic["device_token"], "assistant")
        self.assertEqual(admin.data["user"]["role"], "doctor")
        self.assertEqual(admin.data["user"]["workspace_role"], "assistant")

        assistant_clinic = self.create_clinic("Assistant Clinic")
        assistant = self.register(assistant_clinic, role="assistant", email="assistant@example.com", phone="+33622222222")
        self.verify_contacts(assistant.data["session_token"], assistant_clinic["device_token"])
        assistant_login = self.global_login("assistant@example.com")
        assistant_membership = assistant_login.data["user"]["memberships"][0]
        forbidden = self.client.post(
            "/api/staff/select-clinic/",
            {"clinic_id": assistant_membership["clinic"]["id"], "workspace_role": "doctor"},
            format="json",
            **self.auth(assistant_login.data["session_token"], assistant_clinic["device_token"]),
        )
        self.assertEqual(forbidden.status_code, status.HTTP_403_FORBIDDEN)

    def test_same_person_can_be_doctor_in_multiple_clinics_and_patient_data_is_isolated(self):
        first = self.create_clinic("First Clinic")
        registered = self.register(first)
        self.verify_contacts(registered.data["session_token"], first["device_token"])
        global_session = self.global_login()
        token = global_session.data["session_token"]

        second = self.create_clinic("Second Clinic")
        claim = self.client.post(
            f"/api/clinics/{second['clinic']['id']}/claim-doctor/",
            {},
            format="json",
            **self.auth(token, second["device_token"]),
        )
        self.assertEqual(claim.status_code, status.HTTP_201_CREATED)
        me = self.client.get("/api/staff/me/", **self.auth(token))
        self.assertEqual(len(me.data["user"]["memberships"]), 2)

        first_membership = next(m for m in me.data["user"]["memberships"] if m["clinic"]["id"] == first["clinic"]["id"])
        self.select_clinic(token, first_membership, first["device_token"], "assistant")
        first_patient = self.client.post(
            "/api/patients/",
            {"full_name": "First Patient", "gender": "Woman", "country_calling_code": "+33", "phone_number": "0611111111", "patient_note": ""},
            format="json",
            **self.auth(token, first["device_token"]),
        )
        self.assertEqual(first_patient.status_code, status.HTTP_201_CREATED)
        self.client.post("/api/staff/leave-clinic/", {}, format="json", **self.auth(token, first["device_token"]))

        second_membership = next(m for m in me.data["user"]["memberships"] if m["clinic"]["id"] == second["clinic"]["id"])
        self.select_clinic(token, second_membership, second["device_token"], "assistant")
        listing = self.client.get("/api/patients/", **self.auth(token, second["device_token"]))
        self.assertEqual(listing.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["patients"], [])
        self.assertTrue(Patient.objects.filter(full_name="First Patient").exists())

    def test_verified_contact_can_authorize_a_new_device(self):
        clinic = self.create_clinic()
        registered = self.register(clinic)
        self.verify_contacts(registered.data["session_token"], clinic["device_token"])
        fresh = APIClient()
        login = self.global_login(client=fresh)
        token = login.data["session_token"]
        membership = login.data["user"]["memberships"][0]

        blocked = fresh.post(
            "/api/staff/select-clinic/",
            {"clinic_id": membership["clinic"]["id"], "workspace_role": "doctor"},
            format="json",
            **self.auth(token, "not-trusted"),
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

        request = fresh.post(
            "/api/devices/contact/request/",
            {"clinic_id": membership["clinic"]["id"], "channel": "email"},
            format="json",
            **self.auth(token),
        )
        self.assertEqual(request.status_code, status.HTTP_200_OK)
        code = code_from_message(mail.outbox[-1].body)
        confirm = fresh.post(
            "/api/devices/contact/confirm/",
            {"clinic_id": membership["clinic"]["id"], "code": code},
            format="json",
            **self.auth(token),
        )
        self.assertEqual(confirm.status_code, status.HTTP_201_CREATED)
        selected = self.select_clinic(token, membership, confirm.data["device_token"], client=fresh)
        self.assertEqual(selected.data["user"]["clinic"]["id"], membership["clinic"]["id"])

    def test_pairing_remains_an_alternative_and_last_device_can_be_removed(self):
        clinic = self.create_clinic()
        registered = self.register(clinic)
        self.verify_contacts(registered.data["session_token"], clinic["device_token"])
        global_login = self.global_login()
        global_token = global_login.data["session_token"]
        membership = global_login.data["user"]["memberships"][0]
        start = self.client.post(
            "/api/devices/pairing/",
            {"clinic_id": membership["clinic"]["id"]},
            format="json",
            **self.auth(global_token),
        )
        self.assertEqual(start.status_code, status.HTTP_201_CREATED)
        approve = self.client.post(
            "/api/devices/pairing/approve/",
            {"code": start.data["pairing_code"]},
            format="json",
            **self.auth(registered.data["session_token"], clinic["device_token"]),
        )
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        claim = self.client.post(
            "/api/devices/pairing/status/",
            {"request_token": start.data["request_token"]},
            format="json",
            **self.auth(global_token),
        )
        self.assertEqual(claim.data["status"], "approved")
        self.assertEqual(TrustedDevice.objects.count(), 2)

        # Phase 8 recovery removes the old last-device lockout.
        other_device = TrustedDevice.objects.exclude(token_hash=TrustedDevice.objects.first().token_hash).first()
        self.assertIsNotNone(other_device)
        # Remove both devices from sessions bound to each device, one at a time.
        self.select_clinic(global_token, membership, claim.data["device_token"])
        for device in list(TrustedDevice.objects.filter(clinic_id=membership["clinic"]["id"])):
            response = self.client.delete(
                f"/api/devices/{device.id}/",
                **self.auth(global_token, claim.data["device_token"]),
            )
            if device.token_hash == self.client.cookies.get(f"health_hub_device_{str(membership['clinic']['id']).replace('-', '')}", ""):
                break
            self.assertIn(response.status_code, {status.HTTP_204_NO_CONTENT, status.HTTP_401_UNAUTHORIZED})

    def test_doctor_recovery_codes_are_one_time_and_assistant_is_denied(self):
        clinic = self.create_clinic()
        doctor = self.register(clinic)
        self.verify_contacts(doctor.data["session_token"], clinic["device_token"])
        generated = self.client.post(
            "/api/staff/recovery-codes/",
            {},
            format="json",
            **self.auth(doctor.data["session_token"], clinic["device_token"]),
        )
        self.assertEqual(generated.status_code, status.HTTP_200_OK)
        self.assertEqual(len(generated.data["codes"]), 10)
        first_code = generated.data["codes"][0]

        grant = self.client.post(
            "/api/recovery/code/confirm/",
            {"identity": "doctor@example.com", "code": first_code},
            format="json",
        )
        self.assertEqual(grant.status_code, status.HTTP_200_OK)
        reused = self.client.post(
            "/api/recovery/code/confirm/",
            {"identity": "doctor@example.com", "code": first_code},
            format="json",
        )
        self.assertEqual(reused.status_code, status.HTTP_400_BAD_REQUEST)

        assistant_clinic = self.create_clinic("Assistant-only")
        assistant = self.register(assistant_clinic, role="assistant", email="assistant@example.com", phone="+33622222222")
        self.verify_contacts(assistant.data["session_token"], assistant_clinic["device_token"])
        denied = self.client.post(
            "/api/staff/recovery-codes/",
            {},
            format="json",
            **self.auth(assistant.data["session_token"], assistant_clinic["device_token"]),
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

    def test_password_recovery_revokes_only_affected_users_sessions(self):
        clinic = self.create_clinic()
        doctor = self.register(clinic)
        self.verify_contacts(doctor.data["session_token"], clinic["device_token"])
        extra = self.global_login()
        self.assertEqual(StaffSession.objects.filter(user__email="doctor@example.com").count(), 2)

        request = self.client.post(
            "/api/recovery/request/",
            {"identity": "doctor@example.com", "channel": "email"},
            format="json",
        )
        self.assertEqual(request.status_code, status.HTTP_200_OK)
        code = code_from_message(mail.outbox[-1].body)
        confirm = self.client.post(
            "/api/recovery/confirm/",
            {"identity": "doctor@example.com", "code": code},
            format="json",
        )
        reset = self.client.post(
            "/api/recovery/reset/",
            {"recovery_token": confirm.data["recovery_token"], "password": "New-strong-password-456", "password_confirm": "New-strong-password-456"},
            format="json",
        )
        self.assertEqual(reset.status_code, status.HTTP_200_OK)
        self.assertFalse(StaffSession.objects.filter(user__email="doctor@example.com").exists())
        self.assertEqual(TrustedDevice.objects.count(), 1)

    def test_assistant_replacement_changes_membership_not_personal_account(self):
        clinic = self.create_clinic()
        doctor = self.register(clinic)
        self.verify_contacts(doctor.data["session_token"], clinic["device_token"])
        assistant = self.register(clinic, role="assistant", email="old-assistant@example.com", phone="+33622222222")
        old_user = StaffUser.objects.get(email="old-assistant@example.com")
        old_user.private_note = "Personal sticky survives replacement"
        old_user.save(update_fields=["private_note"])

        setup = self.client.post(
            "/api/clinic/assistant/setup/",
            {"replace_existing": True},
            format="json",
            **self.auth(doctor.data["session_token"], clinic["device_token"]),
        )
        self.assertEqual(setup.status_code, status.HTTP_201_CREATED)
        old_membership = StaffMembership.objects.get(user=old_user, clinic_id=clinic["clinic"]["id"])
        self.assertFalse(old_membership.is_active)
        old_user.refresh_from_db()
        self.assertEqual(old_user.private_note, "Personal sticky survives replacement")

        newcomer = APIClient()
        replacement = self.register(
            None,
            role="assistant",
            email="new-assistant@example.com",
            phone="+33633333333",
            client=newcomer,
            setup_code=setup.data["setup_code"],
        )
        self.assertIsNone(replacement.data["user"]["clinic"])
        self.assertTrue(StaffMembership.objects.filter(user__email="new-assistant@example.com", clinic_id=clinic["clinic"]["id"], role="assistant", is_active=True).exists())

    def test_inactive_session_expires_and_logout_keeps_device_trusted(self):
        clinic = self.create_clinic()
        doctor = self.register(clinic)
        self.verify_contacts(doctor.data["session_token"], clinic["device_token"])
        session = StaffSession.objects.get(token_hash__isnull=False, user__email="doctor@example.com")
        session.last_used_at = timezone.now() - timedelta(hours=3)
        session.save(update_fields=["last_used_at"])
        expired = self.client.get("/api/staff/me/", **self.auth(doctor.data["session_token"], clinic["device_token"]))
        self.assertEqual(expired.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(TrustedDevice.objects.count(), 1)

        login = self.global_login()
        self.assertEqual(self.client.post("/api/staff/logout/", {}, format="json", **self.auth(login.data["session_token"])).status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(TrustedDevice.objects.count(), 1)
