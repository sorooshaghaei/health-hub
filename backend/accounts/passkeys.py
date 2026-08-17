import json
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from webauthn import (
    base64url_to_bytes,
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers.structs import PublicKeyCredentialDescriptor, UserVerificationRequirement

from .models import PasskeyChallenge, PasskeyCredential
from .services import bytes_to_base64url


class PasskeyError(Exception):
    pass


def _new_challenge(user, purpose, challenge_bytes):
    now = timezone.now()
    PasskeyChallenge.objects.filter(user=user, purpose=purpose, consumed_at__isnull=True).update(consumed_at=now)
    return PasskeyChallenge.objects.create(user=user, purpose=purpose, challenge=bytes_to_base64url(challenge_bytes), expires_at=now + timedelta(seconds=settings.PASSKEY_CHALLENGE_MAX_AGE))


def _latest_challenge(user, purpose):
    challenge = PasskeyChallenge.objects.filter(user=user, purpose=purpose, consumed_at__isnull=True).order_by("-created_at").first()
    if challenge is None or challenge.expires_at <= timezone.now():
        raise PasskeyError("Passkey request is invalid or expired.")
    return challenge


def registration_options(user):
    if not user.contacts_verified:
        raise PasskeyError("Verify email and phone before adding a passkey.")
    credentials = list(user.passkeys.all())
    if len(credentials) >= 5:
        raise PasskeyError("This account already has the maximum of five passkeys.")
    options = generate_registration_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        rp_name=settings.WEBAUTHN_RP_NAME,
        user_id=user.id.to_bytes(8, "big") if isinstance(user.id, int) else user.id.bytes,
        user_name=user.email,
        user_display_name=user.display_name,
        exclude_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(item.credential_id)) for item in credentials],
    )
    _new_challenge(user, PasskeyChallenge.Purpose.REGISTER, options.challenge)
    return json.loads(options_to_json(options))


def verify_registration(user, credential, name="Passkey"):
    challenge = _latest_challenge(user, PasskeyChallenge.Purpose.REGISTER)
    try:
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge.challenge),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            require_user_verification=True,
        )
    except Exception as exc:
        raise PasskeyError("Passkey registration could not be verified.") from exc
    credential_id = bytes_to_base64url(verification.credential_id)
    if PasskeyCredential.objects.filter(credential_id=credential_id).exists():
        raise PasskeyError("This passkey is already registered.")
    transports = credential.get("response", {}).get("transports", [])
    passkey = PasskeyCredential.objects.create(
        user=user, credential_id=credential_id, public_key=verification.credential_public_key,
        sign_count=verification.sign_count, name=(str(name).strip() or "Passkey")[:120],
        transports=transports if isinstance(transports, list) else [],
    )
    challenge.consumed_at = timezone.now(); challenge.save(update_fields=["consumed_at"])
    return passkey


def authentication_options(user):
    credentials = list(user.passkeys.all())
    if not credentials:
        raise PasskeyError("This account has no registered passkeys.")
    options = generate_authentication_options(
        rp_id=settings.WEBAUTHN_RP_ID,
        allow_credentials=[PublicKeyCredentialDescriptor(id=base64url_to_bytes(item.credential_id)) for item in credentials],
        user_verification=UserVerificationRequirement.REQUIRED,
    )
    _new_challenge(user, PasskeyChallenge.Purpose.AUTHENTICATE, options.challenge)
    return json.loads(options_to_json(options))


def verify_authentication(user, credential):
    challenge = _latest_challenge(user, PasskeyChallenge.Purpose.AUTHENTICATE)
    try:
        passkey = user.passkeys.get(credential_id=credential.get("id"))
    except PasskeyCredential.DoesNotExist as exc:
        raise PasskeyError("Passkey sign-in could not be verified.") from exc
    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=base64url_to_bytes(challenge.challenge),
            expected_rp_id=settings.WEBAUTHN_RP_ID,
            expected_origin=settings.WEBAUTHN_ORIGIN,
            credential_public_key=bytes(passkey.public_key),
            credential_current_sign_count=passkey.sign_count,
            require_user_verification=True,
        )
    except Exception as exc:
        raise PasskeyError("Passkey sign-in could not be verified.") from exc
    passkey.sign_count = verification.new_sign_count; passkey.last_used_at = timezone.now(); passkey.save(update_fields=["sign_count", "last_used_at"])
    challenge.consumed_at = timezone.now(); challenge.save(update_fields=["consumed_at"])
    return passkey
