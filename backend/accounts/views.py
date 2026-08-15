from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StaffUser, TrustedDevice
from .permissions import active_workspace_role
from .serializers import (
    ClinicCreateSerializer,
    ClinicSummarySerializer,
    DevicePairingCodeSerializer,
    DevicePairingStartSerializer,
    DevicePairingStatusSerializer,
    PrivateNoteSerializer,
    StaffLoginSerializer,
    StaffRegistrationSerializer,
    StaffSerializer,
    TrustedDeviceSerializer,
)
from .services import (
    InvalidDevicePairing,
    InvalidTrustedDevice,
    approve_device_pairing,
    claim_device_pairing,
    create_device_pairing_request,
    issue_staff_session,
    issue_trusted_device,
    resolve_trusted_device_token,
)


def trusted_device_from_request(request):
    raw_token = request.headers.get("X-Device-Token") or request.headers.get("X-Clinic-Token")
    try:
        return resolve_trusted_device_token(raw_token)
    except InvalidTrustedDevice as exc:
        raise PermissionDenied(str(exc))


def clinic_payload(clinic):
    role_values = set(clinic.staff_members.values_list("role", flat=True))
    return {
        "clinic": ClinicSummarySerializer(clinic).data,
        "roles": {
            StaffUser.Role.DOCTOR: {
                "exists": StaffUser.Role.DOCTOR in role_values,
                "is_administrator": True,
            },
            StaffUser.Role.ASSISTANT: {
                "exists": StaffUser.Role.ASSISTANT in role_values,
                "is_administrator": False,
            },
        },
    }


def user_agent(request):
    return request.META.get("HTTP_USER_AGENT", "")


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "service": "Health Hub API"})


class ClinicCreateView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ClinicCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clinic = serializer.save()
        raw_device_token, device = issue_trusted_device(clinic, user_agent(request))
        return Response(
            {
                **clinic_payload(clinic),
                "device_token": raw_device_token,
                "clinic_access_token": raw_device_token,
                "trusted_device": TrustedDeviceSerializer(
                    device,
                    context={"current_device_id": device.id},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ClinicContextView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        device = trusted_device_from_request(request)
        return Response(clinic_payload(device.clinic))


class DevicePairingStartView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DevicePairingStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clinic = serializer.validated_data["clinic"]
        try:
            pairing, code, request_token = create_device_pairing_request(
                clinic,
                user_agent(request),
            )
        except InvalidDevicePairing as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "pairing_code": code,
                "request_token": request_token,
                "expires_at": pairing.expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class DevicePairingStatusView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = DevicePairingStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pairing, raw_device_token, device = claim_device_pairing(
                serializer.validated_data["request_token"]
            )
        except InvalidDevicePairing as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if device is None:
            return Response(
                {
                    "status": "pending",
                    "expires_at": pairing.expires_at,
                }
            )

        return Response(
            {
                "status": "approved",
                "device_token": raw_device_token,
                "trusted_device": TrustedDeviceSerializer(
                    device,
                    context={"current_device_id": device.id},
                ).data,
                **clinic_payload(device.clinic),
            }
        )


class StaffRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        device = trusted_device_from_request(request)
        clinic = device.clinic
        serializer = StaffRegistrationSerializer(
            data=request.data,
            context={"clinic": clinic},
        )
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        try:
            with transaction.atomic():
                locked_clinic = clinic.__class__.objects.select_for_update().get(
                    pk=clinic.pk
                )
                if locked_clinic.staff_members.filter(role=role).exists():
                    return Response(
                        {"role": ["This clinic already has an account for this role."]},
                        status=status.HTTP_409_CONFLICT,
                    )
                user = serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "An account with one of these unique values already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        raw_token, expires_at = issue_staff_session(
            user,
            device,
            workspace_role=user.role,
        )
        return Response(
            {
                "user": StaffSerializer(
                    user,
                    context={"workspace_role": user.role},
                ).data,
                "session_token": raw_token,
                "expires_at": expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class StaffLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        device = trusted_device_from_request(request)
        clinic = device.clinic
        serializer = StaffLoginSerializer(
            data=request.data,
            context={"clinic": clinic, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        workspace_role = serializer.validated_data["workspace_role"]
        raw_token, expires_at = issue_staff_session(
            user,
            device,
            workspace_role=workspace_role,
        )
        return Response(
            {
                "user": StaffSerializer(
                    user,
                    context={"workspace_role": workspace_role},
                ).data,
                "session_token": raw_token,
                "expires_at": expires_at,
            }
        )


class StaffMeView(APIView):
    def get(self, request):
        return Response(
            {
                "user": StaffSerializer(
                    request.user,
                    context={"request": request},
                ).data
            }
        )


class TrustedDeviceListView(APIView):
    def get(self, request):
        devices = request.user.clinic.trusted_devices.all()
        return Response(
            {
                "devices": TrustedDeviceSerializer(
                    devices,
                    many=True,
                    context={"current_device_id": request.auth.trusted_device_id},
                ).data
            }
        )


class TrustedDeviceDeleteView(APIView):
    def delete(self, request, device_id):
        try:
            device = TrustedDevice.objects.get(
                pk=device_id,
                clinic=request.user.clinic,
            )
        except TrustedDevice.DoesNotExist:
            return Response(
                {"detail": "Trusted device not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if request.user.clinic.trusted_devices.count() <= 1:
            return Response(
                {"detail": "At least one trusted device must remain for the clinic."},
                status=status.HTTP_409_CONFLICT,
            )

        device.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DevicePairingApproveView(APIView):
    def post(self, request):
        serializer = DevicePairingCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pairing = approve_device_pairing(
                request.user.clinic,
                serializer.validated_data["code"],
            )
        except InvalidDevicePairing as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {
                "status": "approved",
                "browser": pairing.browser,
                "operating_system": pairing.operating_system,
            }
        )


class StaffPrivateNoteView(APIView):
    def ensure_own_workspace(self, request):
        if active_workspace_role(request) != request.user.role:
            raise PermissionDenied(
                "Private notes are available only in your own workspace."
            )

    def get(self, request):
        self.ensure_own_workspace(request)
        return Response({"content": request.user.private_note})

    def patch(self, request):
        self.ensure_own_workspace(request)
        serializer = PrivateNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.private_note = serializer.validated_data["content"]
        request.user.save(update_fields=["private_note"])
        return Response({"content": request.user.private_note})


class StaffLogoutView(APIView):
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
