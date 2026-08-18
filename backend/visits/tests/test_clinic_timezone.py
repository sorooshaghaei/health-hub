from datetime import time
from zoneinfo import ZoneInfo

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic, StaffMembership, StaffUser
from accounts.services import issue_staff_session, issue_trusted_device
from patients.models import Patient
from visits.models import Visit


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ClinicOperationalTimezoneTests(APITestCase):
    def setUp(self):
        utc_now = timezone.now()
        candidates = ("Pacific/Kiritimati", "Pacific/Honolulu")
        self.timezone_name = next(
            name
            for name in candidates
            if utc_now.astimezone(ZoneInfo(name)).date() != utc_now.date()
        )
        self.clinic_date = utc_now.astimezone(ZoneInfo(self.timezone_name)).date()

        self.clinic = Clinic.objects.create(
            name="Timezone Clinic",
            timezone=self.timezone_name,
        )
        self.user = StaffUser.objects.create_user(
            email="assistant-timezone@example.com",
            phone="+33612345678",
            password="Strong-staff-password-123",
            first_name="Timezone",
            last_name="Assistant",
            role=StaffUser.Role.ASSISTANT,
        )
        now = timezone.now()
        self.user.email_verified_at = now
        self.user.phone_verified_at = now
        self.user.save(update_fields=["email_verified_at", "phone_verified_at"])
        self.membership = StaffMembership.objects.create(
            user=self.user,
            clinic=self.clinic,
        )
        self.device_token, device = issue_trusted_device(
            self.user,
            "Mozilla/5.0 Chrome/151.0.0.0",
        )
        self.session_token, _ = issue_staff_session(
            self.user,
            membership=self.membership,
            trusted_device=device,
            workspace_role=StaffUser.Role.ASSISTANT,
        )
        self.patient = Patient.objects.create(
            clinic=self.clinic,
            full_name="Clinic Time Patient",
            gender=Patient.Gender.WOMAN,
            country_calling_code="+33",
            phone_number="0612345678",
        )
        self.visit = Visit.objects.create(
            clinic=self.clinic,
            patient=self.patient,
            date=self.clinic_date,
            scheduled_time=time(10, 0),
        )

    def headers(self):
        return {
            "HTTP_AUTHORIZATION": f"Bearer {self.session_token}",
            "HTTP_X_DEVICE_TOKEN": self.device_token,
        }

    def test_check_in_and_queue_use_clinic_date_not_server_utc_date(self):
        self.assertNotEqual(self.clinic_date, timezone.now().date())

        checked_in = self.client.post(
            f"/api/visits/{self.visit.id}/check-in/",
            **self.headers(),
        )
        self.assertEqual(checked_in.status_code, status.HTTP_200_OK)
        self.assertEqual(checked_in.data["status"], Visit.Status.CHECKED_IN)

        queue = self.client.get("/api/visits/queue/", **self.headers())
        self.assertEqual(queue.status_code, status.HTTP_200_OK)
        self.assertEqual(str(queue.data["date"]), self.clinic_date.isoformat())
        self.assertEqual([item["id"] for item in queue.data["queue"]], [str(self.visit.id)])
