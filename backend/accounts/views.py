from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import StaffUser
from .serializers import (
    ClinicCreateSerializer,
    ClinicEnterSerializer,
    ClinicSummarySerializer,
    StaffLoginSerializer,
    StaffRegistrationSerializer,
    StaffSerializer,
)
from .services import (
    InvalidClinicAccess,
    issue_clinic_access_token,
    issue_staff_session,
    resolve_clinic_access_token,
)


def clinic_from_request(request):
    try:
        return resolve_clinic_access_token(request.headers.get("X-Clinic-Token"))
    except InvalidClinicAccess as exc:
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
        token = issue_clinic_access_token(clinic)
        return Response(
            {
                **clinic_payload(clinic),
                "clinic_access_token": token,
            },
            status=status.HTTP_201_CREATED,
        )


class ClinicEnterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ClinicEnterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clinic = serializer.validated_data["clinic"]
        return Response(
            {
                **clinic_payload(clinic),
                "clinic_access_token": issue_clinic_access_token(clinic),
            }
        )


class ClinicContextView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        clinic = clinic_from_request(request)
        return Response(clinic_payload(clinic))


class StaffRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        clinic = clinic_from_request(request)
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

        raw_token, expires_at = issue_staff_session(user, workspace_role=user.role)
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
        clinic = clinic_from_request(request)
        serializer = StaffLoginSerializer(
            data=request.data,
            context={"clinic": clinic, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        workspace_role = serializer.validated_data["workspace_role"]
        raw_token, expires_at = issue_staff_session(
            user,
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


class StaffLogoutView(APIView):
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
