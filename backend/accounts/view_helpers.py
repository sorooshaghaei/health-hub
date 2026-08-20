from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .authentication import trusted_device_cookie_name
from .delivery import DeliveryNotConfigured, deliver_security_notice
from .models import AssistantSetupToken, Clinic, ClinicWorkingHour, PasskeyCredential, RecoveryCode, StaffMembership, StaffSession, StaffUser, TrustedDevice, VerificationChallenge
from .passkeys import PasskeyError, authentication_options, registration_options, verify_authentication, verify_registration
from .permissions import active_membership, active_workspace_role
from .serializers import AccountDeleteSerializer, AssistantSetupClaimSerializer, AssistantSetupSerializer, ClinicCreateSerializer, ClinicSummarySerializer, ClinicWorkingHourSerializer, ClinicWorkingHoursUpdateSerializer, ContactChangeRequestSerializer, DevicePairingCodeSerializer, DevicePairingStartSerializer, DevicePairingStatusSerializer, MembershipSerializer, PasskeyAuthenticateBeginSerializer, PasskeyAuthenticateCompleteSerializer, PasskeyDeleteSerializer, PasskeyRegisterCompleteSerializer, PasskeySerializer, PasswordChangeConfirmSerializer, ReauthenticateSerializer, RecoveryCodeConfirmSerializer, RecoveryConfirmSerializer, RecoveryRequestSerializer, RecoveryResetSerializer, SelectClinicSerializer, StaffLoginSerializer, StaffProfileSerializer, StaffRegistrationSerializer, StaffSerializer, TrustedDeviceSerializer, VerificationConfirmSerializer, VerificationContactUpdateSerializer, VerificationRequestSerializer
from .services import InvalidAssistantSetup, InvalidDevicePairing, InvalidRecoveryGrant, InvalidTrustedDevice, InvalidVerificationChallenge, VerificationRateLimited, activate_session_clinic, anonymize_dormant_assistants, approve_device_pairing, claim_device_pairing, clear_session_clinic, consume_recovery_code, create_device_pairing_request, deactivate_assistant_membership, destination_for, find_user_by_identity, generate_assistant_setup_code, generate_recovery_codes, issue_recovery_grant, issue_staff_session, issue_trusted_device, issue_verification_challenge, mark_session_reauthenticated, normalize_staff_phone, reactivate_assistant_account, resolve_assistant_setup_code, resolve_recovery_grant, resolve_trusted_device_token, session_recently_reauthenticated, verify_latest_challenge


def user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "")


def set_device_cookie(response, raw_device_token, request):
    response.set_cookie(
        trusted_device_cookie_name(),
        raw_device_token,
        httponly=True,
        secure=request.is_secure(),
        samesite="Strict",
        max_age=60 * 60 * 24 * 365 * 5,
    )
    return response


def trusted_device_from_request(request, *, user=None):
    raw_token = request.headers.get("X-Device-Token") or request.COOKIES.get(trusted_device_cookie_name())
    try:
        return resolve_trusted_device_token(raw_token, user=user)
    except InvalidTrustedDevice as exc:
        raise PermissionDenied(str(exc))


def clinic_payload(clinic):
    doctor_exists = bool(clinic.owner_doctor_id)
    assistant_exists = clinic.staff_memberships.filter(
        is_active=True,
        user__role=StaffUser.Role.ASSISTANT,
    ).exists()
    return {
        "clinic": ClinicSummarySerializer(clinic).data,
        "roles": {
            StaffUser.Role.DOCTOR: {
                "exists": doctor_exists,
                "is_administrator": True,
            },
            StaffUser.Role.ASSISTANT: {
                "exists": assistant_exists,
                "is_administrator": False,
            },
        },
    }


def serialize_user(request, *, membership=None, workspace_role=None):
    return StaffSerializer(
        request.user,
        context={
            "request": request,
            "membership": membership,
            "workspace_role": workspace_role,
        },
    ).data


def verification_delivery_payload(challenge, development_code=None):
    payload = {
        "detail": "Verification code sent.",
        "expires_at": challenge.expires_at,
        "resend_after_seconds": settings.VERIFICATION_RESEND_MIN_AGE,
    }
    if development_code:
        payload["development_code"] = development_code
    return payload


def reauthenticate_if_needed(request, current_password=None):
    if current_password:
        if not request.user.check_password(current_password):
            raise PermissionDenied("Current password is incorrect.")
        mark_session_reauthenticated(
            request.auth,
            method=StaffSession.AuthMethod.PASSWORD,
            passkey=None,
        )
        return
    if not session_recently_reauthenticated(request.auth):
        raise PermissionDenied("Reauthenticate with your password or a passkey first.")
