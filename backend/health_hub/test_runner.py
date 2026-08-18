import hashlib
import secrets

from django.test.runner import DiscoverRunner
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient


LEGACY_IDENTITIES = {}
LEGACY_CLINICS = {}
LEGACY_SESSION_DEVICES = {}
LEGACY_USER_DEVICES = {}
ORIGINAL_POST = APIClient.post
ORIGINAL_GENERIC = APIClient.generic


def fixture_phone(email):
    digits = str(int(hashlib.sha256(email.encode("utf-8")).hexdigest()[:12], 16))
    return f"+1{digits[-14:].zfill(14)}"


def patched_generic(client, method, path, data="", content_type="application/octet-stream", secure=False, **extra):
    authorization = extra.get("HTTP_AUTHORIZATION", "")
    if authorization.startswith("Bearer "):
        raw_session = authorization.split(" ", 1)[1]
        raw_device = LEGACY_SESSION_DEVICES.get(raw_session)
        if raw_device:
            # Historical tests often pass the old shared clinic device token.
            # Replace it with the translated personal-account device only for
            # sessions created by this test adapter.
            extra["HTTP_X_DEVICE_TOKEN"] = raw_device
    return ORIGINAL_GENERIC(
        client,
        method,
        path,
        data=data,
        content_type=content_type,
        secure=secure,
        **extra,
    )


def patched_post(
    client,
    path,
    data=None,
    format=None,
    content_type=None,
    follow=False,
    **extra,
):
    payload = dict(data or {})

    def real_post(target_path, target_data, target_extra=None):
        kwargs = {
            "format": format,
            "content_type": content_type,
            **(target_extra if target_extra is not None else extra),
        }
        if follow:
            kwargs["follow"] = True
        return ORIGINAL_POST(client, target_path, target_data, **kwargs)

    # Phase 1-7 tests created a clinic before a personal account existed. Keep
    # that historical fixture syntax test-only; production Phase 8 requires an
    # authenticated, verified Doctor account to create a clinic.
    if path == "/api/clinics/" and not extra.get("HTTP_AUTHORIZATION"):
        from accounts.models import Clinic
        from accounts.serializers import ClinicSummarySerializer

        clinic = Clinic.objects.create(
            name=str(payload.get("name") or "Test Clinic").strip(),
            timezone=str(payload.get("timezone") or "UTC").strip() or "UTC",
        )
        bootstrap = f"legacy-{secrets.token_urlsafe(24)}"
        LEGACY_CLINICS[bootstrap] = clinic.id
        return Response(
            {
                "clinic": ClinicSummarySerializer(clinic).data,
                "device_token": bootstrap,
                "roles": {
                    "doctor": {"exists": False, "is_administrator": True},
                    "assistant": {"exists": False, "is_administrator": False},
                },
            },
            status=201,
        )

    if path == "/api/staff/register/" and "username" in payload and "phone" not in payload:
        from accounts.models import Clinic, StaffMembership, StaffSession, StaffUser
        from accounts.serializers import StaffSerializer
        from accounts.services import activate_session_clinic, hash_secret, issue_trusted_device

        username = payload.pop("username")
        email = str(payload.get("email", "")).strip().lower()
        role = payload.get("role")
        payload["phone"] = fixture_phone(email)
        bootstrap = extra.get("HTTP_X_DEVICE_TOKEN")
        clinic_id = LEGACY_CLINICS.get(bootstrap)
        if clinic_id is None:
            return Response({"detail": "Legacy test clinic is unavailable."}, status=403)

        response = real_post(path, payload, target_extra={})
        if response.status_code != 201:
            return response

        user = StaffUser.objects.get(email__iexact=email)
        now = timezone.now()
        user.email_verified_at = now
        user.phone_verified_at = now
        user.save(update_fields=["email_verified_at", "phone_verified_at"])
        clinic = Clinic.objects.get(pk=clinic_id)
        membership, _ = StaffMembership.objects.get_or_create(
            user=user,
            clinic=clinic,
            defaults={"is_active": True},
        )
        if not membership.is_active:
            membership.is_active = True
            membership.save(update_fields=["is_active"])
        if role == StaffUser.Role.DOCTOR and clinic.owner_doctor_id is None:
            clinic.owner_doctor = user
            clinic.save(update_fields=["owner_doctor"])

        raw_device, device = issue_trusted_device(user, "Legacy Health Hub test browser")
        LEGACY_USER_DEVICES[str(user.id)] = (raw_device, device.id)
        session = StaffSession.objects.select_related("user").get(
            token_hash=hash_secret(response.data["session_token"])
        )
        try:
            activate_session_clinic(session, membership, device, role)
        except ValueError as exc:
            session.delete()
            return Response({"detail": str(exc)}, status=400)

        LEGACY_IDENTITIES[username] = email
        LEGACY_SESSION_DEVICES[response.data["session_token"]] = raw_device
        response.data["user"] = StaffSerializer(
            user,
            context={"membership": membership, "workspace_role": session.workspace_role},
        ).data
        return response

    if path == "/api/staff/login/" and "username" in payload and "identity" not in payload:
        from accounts.models import StaffSession, StaffUser, TrustedDevice
        from accounts.serializers import StaffSerializer
        from accounts.services import activate_session_clinic, hash_secret, issue_trusted_device

        username = payload.get("username")
        identity = LEGACY_IDENTITIES.get(username)
        if not identity:
            return Response({"detail": "Legacy test identity is unavailable."}, status=400)
        user = StaffUser.objects.filter(email__iexact=identity).first()
        if user is None:
            return Response({"detail": "Legacy test identity is unavailable."}, status=400)

        requested_workspace = payload.get("role") or user.role
        login_response = real_post(
            path,
            {
                "role": user.role,
                "identity": identity,
                "password": payload.get("password", ""),
            },
            target_extra={},
        )
        if login_response.status_code != 200:
            return login_response

        membership = user.memberships.filter(is_active=True).select_related("clinic").order_by("joined_at").first()
        if membership is None:
            return Response({"detail": "Clinic membership is unavailable."}, status=403)

        saved_device = LEGACY_USER_DEVICES.get(str(user.id))
        if saved_device:
            raw_device, device_id = saved_device
            device = TrustedDevice.objects.get(pk=device_id)
        else:
            raw_device, device = issue_trusted_device(user, "Legacy Health Hub test browser")
            LEGACY_USER_DEVICES[str(user.id)] = (raw_device, device.id)

        session = StaffSession.objects.select_related("user").get(
            token_hash=hash_secret(login_response.data["session_token"])
        )
        try:
            activate_session_clinic(
                session,
                membership,
                device,
                requested_workspace,
            )
        except ValueError as exc:
            session.delete()
            return Response({"detail": str(exc)}, status=400)

        LEGACY_SESSION_DEVICES[login_response.data["session_token"]] = raw_device
        login_response.data["user"] = StaffSerializer(
            session.user,
            context={
                "membership": membership,
                "workspace_role": session.workspace_role,
            },
        ).data
        return login_response

    return real_post(path, data)


class HealthHubDiscoverRunner(DiscoverRunner):
    """Keep Phase 1-7 HTTP fixtures useful without weakening production auth.

    Historical regression tests create a clinic before staff registration and
    use username helpers. During `manage.py test` only, this adapter translates
    that fixture syntax into permanent personal roles, clinic memberships, and
    account-scoped trusted devices. Dedicated Phase 8 tests use the real API.
    """

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        LEGACY_IDENTITIES.clear()
        LEGACY_CLINICS.clear()
        LEGACY_SESSION_DEVICES.clear()
        LEGACY_USER_DEVICES.clear()
        APIClient.generic = patched_generic
        APIClient.post = patched_post

    def teardown_test_environment(self, **kwargs):
        APIClient.post = ORIGINAL_POST
        APIClient.generic = ORIGINAL_GENERIC
        LEGACY_IDENTITIES.clear()
        LEGACY_CLINICS.clear()
        LEGACY_SESSION_DEVICES.clear()
        LEGACY_USER_DEVICES.clear()
        super().teardown_test_environment(**kwargs)
