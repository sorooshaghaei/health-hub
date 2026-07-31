import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.core import signing
from django.utils import timezone

from .models import Clinic, StaffSession, StaffUser

CLINIC_TOKEN_SALT = "health-hub.clinic-access"


class InvalidClinicAccess(Exception):
    pass


def issue_clinic_access_token(clinic):
    return signing.dumps(
        {"clinic_id": str(clinic.id)},
        salt=CLINIC_TOKEN_SALT,
        compress=True,
    )


def resolve_clinic_access_token(raw_token):
    if not raw_token:
        raise InvalidClinicAccess("Clinic access is required.")

    try:
        payload = signing.loads(
            raw_token,
            salt=CLINIC_TOKEN_SALT,
            max_age=settings.CLINIC_ACCESS_TOKEN_MAX_AGE,
        )
        clinic_id = payload["clinic_id"]
    except (signing.BadSignature, signing.SignatureExpired, KeyError, TypeError):
        raise InvalidClinicAccess("Clinic access has expired or is invalid.")

    try:
        return Clinic.objects.get(pk=clinic_id)
    except Clinic.DoesNotExist:
        raise InvalidClinicAccess("Clinic access is invalid.")


def issue_staff_session(user, workspace_role=None):
    workspace_role = workspace_role or user.role
    allowed = workspace_role == user.role or (
        user.role == StaffUser.Role.DOCTOR
        and workspace_role == StaffUser.Role.ASSISTANT
    )
    if not allowed:
        raise ValueError("This account cannot open the requested workspace.")

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = timezone.now() + timedelta(
        seconds=settings.STAFF_SESSION_MAX_AGE
    )
    StaffSession.objects.create(
        user=user,
        workspace_role=workspace_role,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    return raw_token, expires_at
