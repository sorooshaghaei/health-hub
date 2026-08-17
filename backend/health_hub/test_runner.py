import hashlib

from django.test.runner import DiscoverRunner
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient


class HealthHubDiscoverRunner(DiscoverRunner):
    """Keep Phase 1-7 HTTP fixtures useful without weakening production auth.

    Older regression tests use username-based staff setup. Phase 8 intentionally
    removes that public contract. During `manage.py test` only, this adapter
    supplies deterministic fixture phone numbers, marks fixture contacts as
    verified after account creation, and translates legacy workspace-login
    helpers into the new global-login + clinic-session model.

    Dedicated Phase 8 account tests use the real API payloads and are unaffected.
    """

    legacy_identities = {}
    original_post = APIClient.post

    @classmethod
    def _fixture_phone(cls, email):
        digits = str(int(hashlib.sha256(email.encode("utf-8")).hexdigest()[:12], 16))
        return f"+1{digits[-14:].zfill(14)}"

    @classmethod
    def _patched_post(
        cls,
        client,
        path,
        data=None,
        format=None,
        content_type=None,
        follow=False,
        **extra,
    ):
        payload = dict(data or {})

        if path == "/api/staff/register/" and "username" in payload and "phone" not in payload:
            from accounts.models import StaffUser

            username = payload.pop("username")
            email = str(payload.get("email", "")).strip().lower()
            payload["phone"] = cls._fixture_phone(email)
            response = cls.original_post(
                client,
                path,
                payload,
                format=format,
                content_type=content_type,
                follow=follow,
                **extra,
            )
            if response.status_code == 201:
                cls.legacy_identities[username] = email
                now = timezone.now()
                StaffUser.objects.filter(email__iexact=email).update(
                    email_verified_at=now,
                    phone_verified_at=now,
                )
            return response

        if path == "/api/staff/login/" and "username" in payload and "identity" not in payload:
            from accounts.models import StaffSession
            from accounts.serializers import StaffSerializer
            from accounts.services import (
                InvalidTrustedDevice,
                activate_session_clinic,
                hash_secret,
                resolve_trusted_device_token,
            )

            username = payload.get("username")
            identity = cls.legacy_identities.get(username)
            if not identity:
                return Response(
                    {"detail": "Legacy test identity is unavailable."},
                    status=400,
                )
            requested_workspace = payload.get("role")
            login_response = cls.original_post(
                client,
                path,
                {"identity": identity, "password": payload.get("password", "")},
                format=format,
                content_type=content_type,
                follow=follow,
                **extra,
            )
            if login_response.status_code != 200:
                return login_response

            raw_device_token = extra.get("HTTP_X_DEVICE_TOKEN")
            if not raw_device_token:
                session_user = StaffSession.objects.get(
                    token_hash=hash_secret(login_response.data["session_token"])
                ).user
                for membership in session_user.memberships.filter(is_active=True):
                    key = f"health_hub_device_{str(membership.clinic_id).replace('-', '')}"
                    if key in client.cookies:
                        raw_device_token = client.cookies[key].value
                        break
            try:
                device = resolve_trusted_device_token(raw_device_token)
            except InvalidTrustedDevice as exc:
                return Response({"detail": str(exc)}, status=403)

            session = StaffSession.objects.select_related("user").get(
                token_hash=hash_secret(login_response.data["session_token"])
            )
            membership = session.user.memberships.filter(
                clinic_id=device.clinic_id,
                is_active=True,
            ).first()
            if membership is None:
                return Response({"detail": "Clinic membership is unavailable."}, status=403)
            try:
                activate_session_clinic(
                    session,
                    membership,
                    device,
                    requested_workspace or membership.role,
                )
            except ValueError as exc:
                session.delete()
                return Response({"detail": str(exc)}, status=400)
            login_response.data["user"] = StaffSerializer(
                session.user,
                context={
                    "membership": membership,
                    "workspace_role": session.workspace_role,
                },
            ).data
            return login_response

        return cls.original_post(
            client,
            path,
            data,
            format=format,
            content_type=content_type,
            follow=follow,
            **extra,
        )

    def setup_test_environment(self, **kwargs):
        super().setup_test_environment(**kwargs)
        self.legacy_identities.clear()
        APIClient.post = self._patched_post

    def teardown_test_environment(self, **kwargs):
        APIClient.post = self.original_post
        self.legacy_identities.clear()
        super().teardown_test_environment(**kwargs)
