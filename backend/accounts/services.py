import base64
import hashlib
import secrets
import string
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from .delivery import deliver_verification_code
from .models import (
    AssistantSetupToken,
    Clinic,
    DevicePairingRequest,
    RecoveryCode,
    RecoveryGrant,
    StaffMembership,
    StaffSession,
    StaffUser,
    TrustedDevice,
    VerificationChallenge,
)


class InvalidTrustedDevice(Exception):
    pass


class InvalidDevicePairing(Exception):
    pass


class InvalidVerificationChallenge(Exception):
    pass


class VerificationRateLimited(Exception):
    pass


class InvalidRecoveryGrant(Exception):
    pass


class InvalidAssistantSetup(Exception):
    pass


def hash_secret(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_short_code(value, *, namespace="verification"):
    return salted_hmac(
        f"health-hub-{namespace}",
        value,
        secret=settings.SECRET_KEY,
        algorithm="sha256",
    ).hexdigest()


def normalize_staff_phone(value):
    raw = str(value or "").strip()
    cleaned = "".join(ch for ch in raw if ch not in " .()-")
    if cleaned.startswith("00"):
        cleaned = f"+{cleaned[2:]}"
    if not cleaned.startswith("+") or not cleaned[1:].isdigit():
        raise ValueError("Enter a valid international phone number beginning with +.")
    digits = cleaned[1:]
    if len(digits) < 7 or len(digits) > 15 or digits.startswith("0"):
        raise ValueError("Enter a valid international phone number.")
    return f"+{digits}"


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
        code_hash = hash_short_code(code, namespace="pairing")
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
    code_hash = hash_short_code(code, namespace="pairing")
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


def issue_staff_session(
    user,
    trusted_device=None,
    workspace_role=None,
    *,
    membership=None,
    auth_method=StaffSession.AuthMethod.PASSWORD,
    reauth_passkey=None,
):
    # `trusted_device` + `workspace_role` positional support keeps older
    # internal fixtures working while new code passes StaffMembership explicitly.
    if membership is None and trusted_device is not None:
        membership = user.memberships.filter(
            clinic_id=trusted_device.clinic_id,
            is_active=True,
        ).first()
        if membership is None:
            raise ValueError("This device is not trusted for this staff account's clinic.")
    if membership is not None:
        if membership.user_id != user.id or not membership.is_active:
            raise ValueError("This membership does not belong to this account.")
        if trusted_device is None or trusted_device.clinic_id != membership.clinic_id:
            raise ValueError("This device is not trusted for the selected clinic.")
        workspace_role = workspace_role or membership.role
        allowed = workspace_role == membership.role or (
            membership.role == StaffUser.Role.DOCTOR
            and workspace_role == StaffUser.Role.ASSISTANT
        )
        if not allowed:
            raise ValueError("This account cannot open the requested workspace.")
    else:
        trusted_device = None
        workspace_role = ""

    raw_token = secrets.token_urlsafe(32)
    now = timezone.now()
    expires_at = now + timedelta(seconds=settings.STAFF_SESSION_MAX_AGE)
    StaffSession.objects.create(
        user=user,
        membership=membership,
        trusted_device=trusted_device,
        workspace_role=workspace_role,
        auth_method=auth_method,
        reauthenticated_at=now,
        reauth_passkey=reauth_passkey,
        token_hash=hash_secret(raw_token),
        expires_at=expires_at,
    )
    return raw_token, expires_at


def activate_session_clinic(session, membership, trusted_device, workspace_role):
    if membership.user_id != session.user_id or not membership.is_active:
        raise ValueError("This clinic membership is unavailable.")
    if trusted_device.clinic_id != membership.clinic_id:
        raise ValueError("This device is not trusted for the selected clinic.")
    allowed = workspace_role == membership.role or (
        membership.role == StaffUser.Role.DOCTOR
        and workspace_role == StaffUser.Role.ASSISTANT
    )
    if not allowed:
        raise ValueError("This account cannot open the requested workspace.")
    session.membership = membership
    session.trusted_device = trusted_device
    session.workspace_role = workspace_role
    session.save(update_fields=["membership", "trusted_device", "workspace_role"])
    return session


def clear_session_clinic(session):
    session.membership = None
    session.trusted_device = None
    session.workspace_role = ""
    session.save(update_fields=["membership", "trusted_device", "workspace_role"])


def session_recently_reauthenticated(session):
    return session.reauthenticated_at >= timezone.now() - timedelta(
        seconds=settings.REAUTH_MAX_AGE
    )


def mark_session_reauthenticated(session, *, method, passkey=None):
    session.auth_method = method
    session.reauthenticated_at = timezone.now()
    session.reauth_passkey = passkey
    session.save(
        update_fields=["auth_method", "reauthenticated_at", "reauth_passkey"]
    )


def destination_for(user, channel):
    if channel == VerificationChallenge.Channel.EMAIL:
        return user.email if user.email_verified_at else None
    if channel == VerificationChallenge.Channel.SMS:
        return user.phone if user.phone_verified_at and user.phone else None
    return None


def issue_verification_challenge(
    user,
    *,
    purpose,
    channel,
    destination=None,
    pending_value="",
    clinic=None,
):
    now = timezone.now()
    recent = VerificationChallenge.objects.filter(
        user=user,
        purpose=purpose,
        created_at__gte=now - timedelta(seconds=settings.VERIFICATION_RESEND_MIN_AGE),
        consumed_at__isnull=True,
    ).exists()
    if recent:
        raise VerificationRateLimited("Wait before requesting another verification code.")

    VerificationChallenge.objects.filter(
        user=user,
        purpose=purpose,
        consumed_at__isnull=True,
    ).update(consumed_at=now)

    if destination is None:
        destination = destination_for(user, channel)
    if not destination:
        raise InvalidVerificationChallenge("The selected verified contact channel is unavailable.")

    code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = VerificationChallenge.objects.create(
        user=user,
        clinic=clinic,
        purpose=purpose,
        channel=channel,
        destination=destination,
        pending_value=pending_value,
        code_hash=hash_short_code(code, namespace="verification"),
        expires_at=now + timedelta(seconds=settings.VERIFICATION_CODE_MAX_AGE),
    )
    deliver_verification_code(
        channel=channel,
        destination=destination,
        code=code,
        purpose=purpose,
    )
    return challenge, code if settings.DEBUG else None


def verify_latest_challenge(user, *, purpose, code, clinic=None):
    now = timezone.now()
    queryset = VerificationChallenge.objects.filter(
        user=user,
        purpose=purpose,
        consumed_at__isnull=True,
    )
    if clinic is not None:
        queryset = queryset.filter(clinic=clinic)
    challenge = queryset.order_by("-created_at").first()
    if challenge is None or challenge.expires_at <= now:
        raise InvalidVerificationChallenge("Verification code is invalid or expired.")
    if challenge.attempts >= settings.VERIFICATION_MAX_ATTEMPTS:
        challenge.consumed_at = now
        challenge.save(update_fields=["consumed_at"])
        raise InvalidVerificationChallenge("Verification code is invalid or expired.")

    challenge.attempts += 1
    valid = secrets.compare_digest(
        challenge.code_hash,
        hash_short_code(str(code).strip(), namespace="verification"),
    )
    if not valid:
        challenge.save(update_fields=["attempts"])
        raise InvalidVerificationChallenge("Verification code is invalid or expired.")

    challenge.consumed_at = now
    challenge.save(update_fields=["attempts", "consumed_at"])
    return challenge


def issue_recovery_grant(user):
    now = timezone.now()
    RecoveryGrant.objects.filter(user=user, consumed_at__isnull=True).update(
        consumed_at=now
    )
    token = secrets.token_urlsafe(32)
    grant = RecoveryGrant.objects.create(
        user=user,
        token_hash=hash_secret(token),
        expires_at=now + timedelta(seconds=settings.RECOVERY_GRANT_MAX_AGE),
    )
    return token, grant


def resolve_recovery_grant(raw_token):
    if not raw_token:
        raise InvalidRecoveryGrant("Recovery authorization is invalid or expired.")
    try:
        grant = RecoveryGrant.objects.select_related("user").get(
            token_hash=hash_secret(raw_token),
            consumed_at__isnull=True,
        )
    except RecoveryGrant.DoesNotExist:
        raise InvalidRecoveryGrant("Recovery authorization is invalid or expired.")
    if grant.expires_at <= timezone.now():
        grant.consumed_at = timezone.now()
        grant.save(update_fields=["consumed_at"])
        raise InvalidRecoveryGrant("Recovery authorization is invalid or expired.")
    return grant


def generate_recovery_codes(user):
    if not user.has_doctor_membership:
        raise ValueError("Offline recovery codes are available only to Doctors.")
    RecoveryCode.objects.filter(user=user, used_at__isnull=True).delete()
    batch_id = uuid.uuid4()
    alphabet = string.ascii_uppercase + string.digits
    codes = []
    records = []
    for _ in range(10):
        raw = "".join(secrets.choice(alphabet) for _ in range(12))
        formatted = f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"
        codes.append(formatted)
        records.append(
            RecoveryCode(
                user=user,
                batch_id=batch_id,
                code_hash=make_password(formatted),
            )
        )
    RecoveryCode.objects.bulk_create(records)
    return codes


def consume_recovery_code(user, raw_code):
    for record in RecoveryCode.objects.filter(user=user, used_at__isnull=True):
        if check_password(str(raw_code).strip().upper(), record.code_hash):
            record.used_at = timezone.now()
            record.save(update_fields=["used_at"])
            return True
    return False


def generate_assistant_setup_code(clinic, created_by):
    AssistantSetupToken.objects.filter(
        clinic=clinic,
        used_at__isnull=True,
    ).delete()
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(20):
        raw = "".join(secrets.choice(alphabet) for _ in range(10))
        formatted = f"{raw[:5]}-{raw[5:]}"
        digest = hash_short_code(formatted, namespace="assistant-setup")
        if not AssistantSetupToken.objects.filter(code_hash=digest).exists():
            break
    else:
        raise InvalidAssistantSetup("A setup code could not be created.")
    token = AssistantSetupToken.objects.create(
        clinic=clinic,
        created_by=created_by,
        code_hash=digest,
        expires_at=timezone.now()
        + timedelta(seconds=settings.ASSISTANT_SETUP_MAX_AGE),
    )
    return token, formatted


def resolve_assistant_setup_code(raw_code, *, consume=False):
    digest = hash_short_code(str(raw_code).strip().upper(), namespace="assistant-setup")
    try:
        token = AssistantSetupToken.objects.select_related("clinic").get(
            code_hash=digest,
            used_at__isnull=True,
        )
    except AssistantSetupToken.DoesNotExist:
        raise InvalidAssistantSetup("Assistant setup code is invalid or expired.")
    if token.expires_at <= timezone.now():
        token.delete()
        raise InvalidAssistantSetup("Assistant setup code is invalid or expired.")
    if consume:
        token.used_at = timezone.now()
        token.save(update_fields=["used_at"])
    return token


def bytes_to_base64url(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def find_user_by_identity(identity):
    from django.db.models import Q

    value = str(identity or "").strip()
    phone = None
    if value.startswith("+") or value.startswith("00"):
        try:
            phone = normalize_staff_phone(value)
        except ValueError:
            phone = None
    query = Q(email__iexact=value.lower())
    if phone:
        query |= Q(phone=phone)
    return StaffUser.objects.filter(query, is_active=True).first()
