from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic, ClinicWorkingHour, StaffMembership, StaffUser
from accounts.services import issue_staff_session, issue_trusted_device


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ClinicWorkingHoursApiTests(APITestCase):
    password = "Strong-staff-password-123"

    def make_user(self, role, email, phone):
        user = StaffUser.objects.create_user(
            role=role,
            email=email,
            phone=phone,
            first_name="Working",
            last_name=role.title(),
            password=self.password,
        )
        now = timezone.now()
        user.email_verified_at = now
        user.phone_verified_at = now
        user.save(update_fields=["email_verified_at", "phone_verified_at"])
        return user

    def session(self, user):
        raw_device, device = issue_trusted_device(user, "Working-hours browser")
        raw_session, _ = issue_staff_session(user, trusted_device=device)
        return raw_session, raw_device

    def auth(self, session_token, device_token):
        return {
            "HTTP_AUTHORIZATION": f"Bearer {session_token}",
            "HTTP_X_DEVICE_TOKEN": device_token,
        }

    def setUp(self):
        self.doctor = self.make_user(
            StaffUser.Role.DOCTOR,
            "hours-doctor@example.com",
            "+33670000101",
        )
        self.clinic = Clinic.objects.create(
            name="Hours Clinic",
            timezone="Europe/Paris",
            owner_doctor=self.doctor,
        )
        StaffMembership.objects.create(user=self.doctor, clinic=self.clinic)
        self.doctor_session, self.doctor_device = self.session(self.doctor)
        self.url = f"/api/clinics/{self.clinic.id}/working-hours/"

        self.assistant = self.make_user(
            StaffUser.Role.ASSISTANT,
            "hours-assistant@example.com",
            "+33670000102",
        )
        StaffMembership.objects.create(user=self.assistant, clinic=self.clinic)
        self.assistant_session, self.assistant_device = self.session(self.assistant)

    def test_doctor_can_read_and_idempotently_replace_weekly_hours_outside_workspace(self):
        empty = self.client.get(
            self.url,
            **self.auth(self.doctor_session, self.doctor_device),
        )
        self.assertEqual(empty.status_code, status.HTTP_200_OK)
        self.assertFalse(empty.data["configured"])
        self.assertEqual(empty.data["working_hours"], [])

        payload = {
            "working_hours": [
                {"weekday": 0, "start_time": "09:00", "end_time": "17:00"},
                {"weekday": 2, "start_time": "10:05", "end_time": "13:00"},
            ]
        }
        first = self.client.put(
            self.url,
            payload,
            format="json",
            **self.auth(self.doctor_session, self.doctor_device),
        )
        second = self.client.put(
            self.url,
            payload,
            format="json",
            **self.auth(self.doctor_session, self.doctor_device),
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertTrue(second.data["configured"])
        self.assertEqual(second.data["working_hours"], payload["working_hours"])
        self.assertEqual(ClinicWorkingHour.objects.filter(clinic=self.clinic).count(), 2)

    def test_assistant_can_read_but_cannot_change_working_hours(self):
        ClinicWorkingHour.objects.create(
            clinic=self.clinic,
            weekday=ClinicWorkingHour.Weekday.FRIDAY,
            start_time="08:30",
            end_time="12:45",
        )
        headers = self.auth(self.assistant_session, self.assistant_device)

        readable = self.client.get(self.url, **headers)
        blocked = self.client.put(
            self.url,
            {"working_hours": []},
            format="json",
            **headers,
        )

        self.assertEqual(readable.status_code, status.HTTP_200_OK)
        self.assertEqual(readable.data["working_hours"][0]["weekday"], 4)
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_rejects_duplicate_weekdays_and_invalid_ranges(self):
        headers = self.auth(self.doctor_session, self.doctor_device)
        duplicate = self.client.put(
            self.url,
            {
                "working_hours": [
                    {"weekday": 1, "start_time": "09:00", "end_time": "12:00"},
                    {"weekday": 1, "start_time": "13:00", "end_time": "17:00"},
                ]
            },
            format="json",
            **headers,
        )
        invalid = self.client.put(
            self.url,
            {
                "working_hours": [
                    {"weekday": 3, "start_time": "17:00", "end_time": "09:00"},
                ]
            },
            format="json",
            **headers,
        )

        self.assertEqual(duplicate.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(ClinicWorkingHour.objects.count(), 0)

    def test_membership_cannot_read_another_clinics_hours(self):
        other_doctor = self.make_user(
            StaffUser.Role.DOCTOR,
            "other-hours-doctor@example.com",
            "+33670000103",
        )
        other_clinic = Clinic.objects.create(
            name="Other Hours Clinic",
            owner_doctor=other_doctor,
        )

        response = self.client.get(
            f"/api/clinics/{other_clinic.id}/working-hours/",
            **self.auth(self.doctor_session, self.doctor_device),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
