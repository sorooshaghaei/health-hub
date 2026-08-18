from .view_helpers import *  # noqa: F401,F403


def require_clinic_doctor(request):
    membership = active_membership(request)
    if request.user.role != StaffUser.Role.DOCTOR or not membership.is_clinic_admin:
        raise PermissionDenied("Only the clinic Doctor can manage the Assistant slot.")
    return membership


def current_assistant_membership(clinic):
    return (
        clinic.staff_memberships.select_related("user")
        .filter(user__role=StaffUser.Role.ASSISTANT, is_active=True)
        .order_by("joined_at")
        .first()
    )


class ClinicAssistantView(APIView):
    def get(self, request):
        membership = require_clinic_doctor(request)
        assistant = current_assistant_membership(membership.clinic)
        return Response(
            {
                "assistant": (
                    {
                        "id": str(assistant.user_id),
                        "membership_id": str(assistant.id),
                        "display_name": assistant.user.display_name,
                        "email": assistant.user.email,
                        "phone": assistant.user.phone,
                    }
                    if assistant
                    else None
                )
            }
        )

    def delete(self, request):
        membership = require_clinic_doctor(request)
        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=membership.clinic_id)
            assistant = current_assistant_membership(membership.clinic)
            if assistant is None:
                return Response(
                    {"detail": "This clinic has no Assistant."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            deactivate_assistant_membership(assistant)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssistantSetupView(APIView):
    def post(self, request):
        membership = require_clinic_doctor(request)
        serializer = AssistantSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clinic = membership.clinic
        existing = current_assistant_membership(clinic)
        if existing and not serializer.validated_data["replace_existing"]:
            return Response(
                {
                    "detail": "This clinic already has an Assistant. Choose replacement explicitly."
                },
                status=status.HTTP_409_CONFLICT,
            )
        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            existing = current_assistant_membership(clinic)
            if existing:
                deactivate_assistant_membership(existing)
            token, code = generate_assistant_setup_code(clinic, request.user)
        return Response(
            {"setup_code": code, "expires_at": token.expires_at},
            status=status.HTTP_201_CREATED,
        )


class AssistantSetupInfoView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AssistantSetupClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = resolve_assistant_setup_code(serializer.validated_data["code"])
        except InvalidAssistantSetup as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"clinic": ClinicSummarySerializer(token.clinic).data})


class AssistantSetupClaimView(APIView):
    def post(self, request):
        if request.user.role != StaffUser.Role.ASSISTANT:
            raise PermissionDenied("Only an Assistant account can use an Assistant setup code.")
        if not request.user.contacts_verified:
            raise PermissionDenied("Verify both email and phone before joining a clinic.")

        serializer = AssistantSetupClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = resolve_assistant_setup_code(serializer.validated_data["code"])
        except InvalidAssistantSetup as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        raw_device_token = None
        device = request.auth.trusted_device
        if device is not None and device.user_id != request.user.id:
            raise PermissionDenied("This browser is not trusted for this account.")
        if device is None:
            if request.user.trusted_devices.exists():
                raise PermissionDenied("Authorize this browser before joining another clinic.")
            raw_device_token, device = issue_trusted_device(request.user, user_agent(request))
            request.auth.trusted_device = device
            request.auth.save(update_fields=["trusted_device"])

        try:
            with transaction.atomic():
                Clinic.objects.select_for_update().get(pk=token.clinic_id)
                if current_assistant_membership(token.clinic) is not None:
                    return Response(
                        {"detail": "The Assistant slot is already filled."},
                        status=status.HTTP_409_CONFLICT,
                    )
                membership = request.user.memberships.filter(clinic=token.clinic).first()
                if membership is not None:
                    if membership.is_active:
                        return Response(
                            {"detail": "This account already belongs to this clinic."},
                            status=status.HTTP_409_CONFLICT,
                        )
                    membership.is_active = True
                    membership.task_attention_seen_at = timezone.now()
                    membership.save(update_fields=["is_active", "task_attention_seen_at"])
                else:
                    membership = StaffMembership.objects.create(
                        user=request.user,
                        clinic=token.clinic,
                    )
                reactivate_assistant_account(request.user)
                token.used_at = timezone.now()
                token.save(update_fields=["used_at"])
                activate_session_clinic(
                    request.auth,
                    membership,
                    device,
                    StaffUser.Role.ASSISTANT,
                )
        except IntegrityError:
            return Response(
                {"detail": "The Assistant slot is already filled."},
                status=status.HTTP_409_CONFLICT,
            )

        payload = {
            "membership": MembershipSerializer(membership).data,
            "user": serialize_user(request),
            "trusted_device": TrustedDeviceSerializer(
                device,
                context={"current_device_id": device.id},
            ).data,
        }
        if raw_device_token:
            payload["device_token"] = raw_device_token
        response = Response(payload, status=status.HTTP_201_CREATED)
        if raw_device_token:
            response = set_device_cookie(response, raw_device_token, request)
        return response


class AssistantRecoveryInitiateView(APIView):
    def post(self, request):
        membership = require_clinic_doctor(request)
        serializer = VerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assistant = current_assistant_membership(membership.clinic)
        if assistant is None:
            return Response(
                {"detail": "This clinic has no Assistant."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            issue_verification_challenge(
                assistant.user,
                purpose=VerificationChallenge.Purpose.PASSWORD_RECOVERY,
                channel=serializer.validated_data["channel"],
            )
        except (
            InvalidVerificationChallenge,
            VerificationRateLimited,
            DeliveryNotConfigured,
        ) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            {"detail": "Recovery instructions were sent directly to the Assistant."}
        )


class StaffPrivateNoteView(APIView):
    def ensure_own_workspace(self, request):
        active_membership(request)
        if active_workspace_role(request) != request.user.role:
            raise PermissionDenied(
                "Private notes are available only in your own workspace."
            )

    def get(self, request):
        self.ensure_own_workspace(request)
        return Response({"content": request.user.private_note})

    def patch(self, request):
        self.ensure_own_workspace(request)
        content = request.data.get("content")
        if not isinstance(content, str):
            return Response(
                {"content": ["Not a valid string."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        request.user.private_note = content
        request.user.save(update_fields=["private_note"])
        return Response({"content": request.user.private_note})


class StaffLogoutView(APIView):
    def post(self, request):
        request.auth.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
