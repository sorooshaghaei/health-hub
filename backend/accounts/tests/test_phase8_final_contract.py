from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic, StaffMembership, StaffUser
from accounts.services import issue_staff_session, issue_trusted_device
from tasks.models import SharedTask


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class FinalPhase8ContractTests(APITestCase):
    password = "Strong-staff-password-123"

    def make_user(self, *, role, email, phone):
        user = StaffUser.objects.create_user(
            role=role,
            email=email,
            phone=phone,
            first_name="Test",
            last_name=role.title(),
            password=self.password,
        )
        now = timezone.now()
        user.email_verified_at = now
        user.phone_verified_at = now
        user.save(update_fields=["email_verified_at", "phone_verified_at"])
        return user

    def make_doctor_session(self):
        doctor = self.make_user(
            role=StaffUser.Role.DOCTOR,
            email="doctor-final@example.com",
            phone="+33670000001",
        )
        clinic = Clinic.objects.create(
            name="Final Contract Clinic",
            timezone="Europe/Paris",
            owner_doctor=doctor,
        )
        membership = StaffMembership.objects.create(user=doctor, clinic=clinic)
        raw_device, device = issue_trusted_device(doctor, "Phase 8 test browser")
        raw_session, _ = issue_staff_session(
            doctor,
            membership=membership,
            trusted_device=device,
            workspace_role=StaffUser.Role.DOCTOR,
        )
        return doctor, clinic, membership, raw_session, raw_device

    def auth(self, session_token, device_token=None):
        headers = {"HTTP_AUTHORIZATION": f"Bearer {session_token}"}
        if device_token:
            headers["HTTP_X_DEVICE_TOKEN"] = device_token
        return headers

    def test_user_payload_reports_global_trusted_device_history(self):
        doctor, _, _, trusted_session, raw_device = self.make_doctor_session()

        trusted = self.client.get(
            "/api/staff/me/",
            **self.auth(trusted_session, raw_device),
        )
        self.assertEqual(trusted.status_code, status.HTTP_200_OK)
        self.assertTrue(trusted.data["user"]["device_trusted"])
        self.assertTrue(trusted.data["user"]["has_trusted_devices"])

        untrusted_session, _ = issue_staff_session(doctor)
        untrusted = self.client.get(
            "/api/staff/me/",
            **self.auth(untrusted_session),
        )
        self.assertEqual(untrusted.status_code, status.HTTP_200_OK)
        self.assertFalse(untrusted.data["user"]["device_trusted"])
        self.assertTrue(untrusted.data["user"]["has_trusted_devices"])

    def test_untrusted_session_cannot_manage_trusted_devices(self):
        doctor, _, _, _, _ = self.make_doctor_session()
        untrusted_session, _ = issue_staff_session(doctor)

        response = self.client.get(
            "/api/devices/",
            **self.auth(untrusted_session),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_doctor_delete_removes_owned_clinic_before_protected_task_author_and_starts_assistant_dormancy(self):
        doctor, clinic, _, doctor_session, raw_device = self.make_doctor_session()
        assistant = self.make_user(
            role=StaffUser.Role.ASSISTANT,
            email="assistant-final@example.com",
            phone="+33670000002",
        )
        StaffMembership.objects.create(user=assistant, clinic=clinic)
        task = SharedTask.objects.create(
            clinic=clinic,
            created_by=doctor,
            title="Historical Doctor task",
        )

        response = self.client.delete(
            "/api/staff/account/",
            {"confirmation": "DELETE", "current_password": self.password},
            format="json",
            **self.auth(doctor_session, raw_device),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(StaffUser.objects.filter(pk=doctor.pk).exists())
        self.assertFalse(Clinic.objects.filter(pk=clinic.pk).exists())
        self.assertFalse(SharedTask.all_objects.filter(pk=task.pk).exists())
        assistant.refresh_from_db()
        self.assertTrue(assistant.is_active)
        self.assertIsNotNone(assistant.dormant_since)
        self.assertEqual(assistant.memberships.filter(is_active=True).count(), 0)
