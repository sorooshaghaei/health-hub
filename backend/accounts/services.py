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


def issue_trusted_device(user, user_agent):
    raw_token = secrets.token_urlsafe(32)
    browser, operating_system = device_details_from_user_agent(user_agent)
    device = TrustedDevice.objects.create(
        user=user,
        token_hash=hash_secret(raw_token),
        browser=browser,
        operating_system=operating_system,
    )
    return raw_token, device


def resolve_trusted_device_token(raw_token, *, user=None):
    if not raw_token:
        raise InvalidTrustedDevice("A trusted device is required.")
    try:
        device = TrustedDevice.objects.select_related("user").get(
            token_hash=hash_secret(raw_token)
        )
    except TrustedDevice.DoesNotExist:
        raise InvalidTrustedDevice("This browser is not trusted for this account.")
    if device.user_id is None:
        raise InvalidTrustedDevice("This browser is not trusted for this account.")
    if user is not None and device.user_id != user.id:
        raise InvalidTrustedDevice("This browser is trusted for another account.")
    now = timezone.now()
    if device.last_used_at < now - timedelta(minutes=5):
        device.last_used_at = now
        device.save(update_fields=["last_used_at"])
    return device


def create_device_pairing_request(user, user_agent):
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
        user=user,
        request_token_hash=hash_secret(request_token),
        code_hash=code_hash,
        browser=browser,
        operating_system=operating_system,
        expires_at=now + timedelta(seconds=settings.DEVICE_PAIRING_MAX_AGE),
    )
    return pairing, code, request_token


def approve_device_pairing(user, code):
    now = timezone.now()
    code_hash = hash_short_code(code, namespace="pairing")
    expired = False
    with transaction.atomic():
        try:
            pairing = DevicePairingRequest.objects.select_for_update().get(
                user=user,
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


def claim_device_pairing(user, request_token):
    now = timezone.now()
    expired = False
    with transaction.atomic():
        try:
            pairing = (
                DevicePairingRequest.objects.select_for_update()
                .select_related("user")
                .get(user=user, request_token_hash=hash_secret(request_token))
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
                user=user,
                token_hash=hash_secret(raw_token),
                browser=pairing.browser,
                operating_system=pairing.operating_system,
            )
            pairing.delete()
            return None, raw_token, device

    if expired:
        raise InvalidDevicePairing("Device pairing request is invalid or expired.")
    raise InvalidDevicePairing("Device pairing request is invalid or expired.")


def allowed_workspace(user, workspace_role):
    return workspace_role == user.role or (
        user.role == StaffUser.Role.DOCTOR
        and workspace_role == StaffUser.Role.ASSISTANT
    )


def issue_staff_session(
    user,
    trusted_device=None,
    workspace_role=None,
    *,
    membership=None,
    auth_method=StaffSession.AuthMethod.PASSWORD,
    reauth_passkey=None,
):
    if trusted_device is not None and trusted_device.user_id != user.id:
        raise ValueError("This device is not trusted for this personal account.")
    if membership is not None:
        if membership.user_id != user.id or not membership.is_active:
            raise ValueError("This membership does not belong to this account.")
        if trusted_device is None:
            raise ValueError("A trusted device is required before clinic data can open.")
        workspace_role = workspace_role or user.role
        if not allowed_workspace(user, workspace_role):
            raise ValueError("This account cannot open the requested workspace.")
    else:
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
        # Normal password/passkey sign-in is authentication, not a fresh
        # sensitive-operation reauthentication.
        reauthenticated_at=None,
        reauth_passkey=None,
        token_hash=hash_secret(raw_token),
        expires_at=expires_at,
    )
    return raw_token, expires_at


def activate_session_clinic(session, membership, trusted_device, workspace_role):
    if membership.user_id != session.user_id or not membership.is_active:
        raise ValueError("This clinic membership is unavailable.")
    if trusted_device.user_id != session.user_id:
        raise ValueError("This device is not trusted for this personal account.")
    if not allowed_workspace(session.user, workspace_role):
        raise ValueError("This account cannot open the requested workspace.")
    session.membership = membership
    session.trusted_device = trusted_device
    session.workspace_role = workspace_role
    session.save(update_fields=["membership", "trusted_device", "workspace_role"])
    return session


def clear_session_clinic(session):
    session.membership = None
    session.workspace_role = ""
    session.save(update_fields=["membership", "workspace_role"])


def session_recently_reauthenticated(session):
    if session.reauthenticated_at is None:
        return False
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
    if user.role != StaffUser.Role.DOCTOR:
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
    if user.role != StaffUser.Role.DOCTOR:
        return False
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


def resolve_assistant_setup_code(raw_code, *, consume=False, include_used=False):
    digest = hash_short_code(str(raw_code).strip().upper(), namespace="assistant-setup")
    filters = {"code_hash": digest}
    if not include_used:
        filters["used_at__isnull"] = True
    try:
        token = AssistantSetupToken.objects.select_related("clinic", "clinic__owner_doctor").get(
            **filters,
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


def deactivate_assistant_membership(membership):
    if membership.user.role != StaffUser.Role.ASSISTANT:
        raise ValueError("Only Assistant memberships use the dormant lifecycle.")
    membership.is_active = False
    membership.save(update_fields=["is_active"])
    membership.staff_sessions.all().delete()
    user = membership.user
    if not user.memberships.filter(is_active=True).exists():
        user.dormant_since = timezone.now()
        user.save(update_fields=["dormant_since"])
    return membership


def reactivate_assistant_account(user):
    if user.role != StaffUser.Role.ASSISTANT:
        raise ValueError("Only Assistant accounts can join the Assistant slot.")
    if user.anonymized_at is not None or not user.is_active:
        raise InvalidAssistantSetup("This Assistant account can no longer be reactivated.")
    if user.dormant_since is not None:
        user.dormant_since = None
        user.save(update_fields=["dormant_since"])


def anonymize_dormant_assistants(*, now=None):
    now = now or timezone.now()
    cutoff = now - timedelta(days=730)
    users = StaffUser.objects.filter(
        role=StaffUser.Role.ASSISTANT,
        dormant_since__isnull=False,
        dormant_since__lte=cutoff,
        anonymized_at__isnull=True,
    )
    count = 0
    for user in users:
        if user.memberships.filter(is_active=True).exists():
            user.dormant_since = None
            user.save(update_fields=["dormant_since"])
            continue
        with transaction.atomic():
            user.staff_sessions.all().delete()
            user.trusted_devices.all().delete()
            user.passkeys.all().delete()
            user.passkey_challenges.all().delete()
            user.verification_challenges.all().delete()
            user.recovery_grants.all().delete()
            user.recovery_codes.all().delete()
            user.private_note = ""
            user.phone = None
            user.email = f"former-assistant-{user.id}@deleted.invalid"
            user.first_name = ""
            user.last_name = ""
            user.email_verified_at = None
            user.phone_verified_at = None
            user.is_active = False
            user.anonymized_at = now
            user.set_unusable_password()
            user.save(
                update_fields=[
                    "private_note",
                    "phone",
                    "email",
                    "first_name",
                    "last_name",
                    "email_verified_at",
                    "phone_verified_at",
                    "is_active",
                    "anonymized_at",
                    "password",
                ]
            )
        count += 1
    return count


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
    return StaffUser.objects.filter(query, is_active=True, anonymized_at__isnull=True).first()
