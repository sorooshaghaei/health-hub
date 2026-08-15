import hashlib
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Clinic, DevicePairingRequest, StaffSession, StaffUser, TrustedDevice


class InvalidTrustedDevice(Exception):
    pass


class InvalidDevicePairing(Exception):
    pass


def hash_secret(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def device_details_from_user_agent(user_agent):
    value = user_agent or ""
    if "Edg/" in value:
        browser = "Edge"
    elif "Chrome/" in value and "Chromium/" not in value:
        browser = "Chrome"
    elif "Firefox/" in value:
        browser = "Firefox"
    elif "Safari/" in value and "Chrome/" not in value and "Chromium/" not in value:
        browser = "Safari"
    else:
        browser = "Unknown browser"

    if "iPhone" in value or "iPad" in value:
        operating_system = "iOS"
    elif "Macintosh" in value or "Mac OS X" in value:
        operating_system = "macOS"
    elif "Windows" in value:
        operating_system = "Windows"
    elif "Android" in value:
        operating_system = "Android"
    elif "Linux" in value:
        operating_system = "Linux"
    else:
        operating_system = "Unknown OS"

    return browser, operating_system


def issue_trusted_device(clinic, user_agent):
    raw_token = secrets.token_urlsafe(32)
    browser, operating_system = device_details_from_user_agent(user_agent)
    device = TrustedDevice.objects.create(
        clinic=clinic,
        token_hash=hash_secret(raw_token),
        browser=browser,
        operating_system=operating_system,
    )
    return raw_token, device


def resolve_trusted_device_token(raw_token):
    if not raw_token:
        raise InvalidTrustedDevice("A trusted clinic device is required.")
    try:
        return TrustedDevice.objects.select_related("clinic").get(
            token_hash=hash_secret(raw_token)
        )
    except TrustedDevice.DoesNotExist:
        raise InvalidTrustedDevice("This browser is not trusted for a clinic.")


def create_device_pairing_request(clinic, user_agent):
    now = timezone.now()
    DevicePairingRequest.objects.filter(expires_at__lte=now).delete()
    browser, operating_system = device_details_from_user_agent(user_agent)

    for _ in range(20):
        code = f"{secrets.randbelow(1_000_000):06d}"
        code_hash = hash_secret(code)
        if not DevicePairingRequest.objects.filter(code_hash=code_hash).exists():
            break
    else:
        raise InvalidDevicePairing("A pairing code could not be created. Try again.")

    request_token = secrets.token_urlsafe(32)
    pairing = DevicePairingRequest.objects.create(
        clinic=clinic,
        request_token_hash=hash_secret(request_token),
        code_hash=code_hash,
        browser=browser,
        operating_system=operating_system,
        expires_at=now + timedelta(seconds=settings.DEVICE_PAIRING_MAX_AGE),
    )
    return pairing, code, request_token


def approve_device_pairing(clinic, code):
    now = timezone.now()
    code_hash = hash_secret(code)
    expired = False
    with transaction.atomic():
        try:
            pairing = DevicePairingRequest.objects.select_for_update().get(
                clinic=clinic,
                code_hash=code_hash,
            )
        except DevicePairingRequest.DoesNotExist:
            raise InvalidDevicePairing("Pairing code is invalid or expired.")
        if pairing.expires_at <= now:
            pairing.delete()
            expired = True
        elif pairing.approved_at is not None:
            raise InvalidDevicePairing("Pairing code has already been approved.")
        else:
            pairing.approved_at = now
            pairing.save(update_fields=["approved_at"])

    if expired:
        raise InvalidDevicePairing("Pairing code is invalid or expired.")
    return pairing


def claim_device_pairing(request_token):
    now = timezone.now()
    expired = False
    with transaction.atomic():
        try:
            pairing = (
                DevicePairingRequest.objects.select_for_update()
                .select_related("clinic")
                .get(request_token_hash=hash_secret(request_token))
            )
        except DevicePairingRequest.DoesNotExist:
            raise InvalidDevicePairing("Device pairing request is invalid or expired.")
        if pairing.expires_at <= now:
            pairing.delete()
            expired = True
        elif pairing.approved_at is None:
            return pairing, None, None
        else:
            raw_token = secrets.token_urlsafe(32)
            device = TrustedDevice.objects.create(
                clinic=pairing.clinic,
                token_hash=hash_secret(raw_token),
                browser=pairing.browser,
                operating_system=pairing.operating_system,
            )
            pairing.delete()
            return None, raw_token, device

    if expired:
        raise InvalidDevicePairing("Device pairing request is invalid or expired.")
    raise InvalidDevicePairing("Device pairing request is invalid or expired.")


def issue_staff_session(user, trusted_device, workspace_role=None):
    if user.clinic_id != trusted_device.clinic_id:
        raise ValueError("This device is not trusted for this staff account's clinic.")

    workspace_role = workspace_role or user.role
    allowed = workspace_role == user.role or (
        user.role == StaffUser.Role.DOCTOR
        and workspace_role == StaffUser.Role.ASSISTANT
    )
    if not allowed:
        raise ValueError("This account cannot open the requested workspace.")

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_secret(raw_token)
    expires_at = timezone.now() + timedelta(seconds=settings.STAFF_SESSION_MAX_AGE)
    StaffSession.objects.create(
        user=user,
        trusted_device=trusted_device,
        workspace_role=workspace_role,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    return raw_token, expires_at
