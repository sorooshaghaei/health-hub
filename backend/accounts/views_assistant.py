from .view_helpers import *  # noqa: F401,F403


class ClinicAssistantView(APIView):
    def get(self, request):
        membership = active_membership(request)
        if membership.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Only the Doctor can manage the clinic Assistant slot.")
        assistant = membership.clinic.staff_memberships.select_related("user").filter(
            role=StaffUser.Role.ASSISTANT,
            is_active=True,
        ).first()
        return Response(
            {
                "assistant": (
                    {
                        "id": str(assistant.user_id),
                        "display_name": assistant.user.display_name,
                        "email": assistant.user.email,
                        "phone": assistant.user.phone,
                    }
                    if assistant
                    else None
                )
            }
        )


class AssistantSetupView(APIView):
    def post(self, request):
        membership = active_membership(request)
        if membership.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Only the Doctor can manage the clinic Assistant slot.")
        serializer = AssistantSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        clinic = membership.clinic
        existing = clinic.staff_memberships.filter(
            role=StaffUser.Role.ASSISTANT,
            is_active=True,
        ).first()
        if existing and not serializer.validated_data["replace_existing"]:
            return Response(
                {
                    "detail": "This clinic already has an Assistant. Choose replacement explicitly."
                },
                status=status.HTTP_409_CONFLICT,
            )
        with transaction.atomic():
            Clinic.objects.select_for_update().get(pk=clinic.pk)
            if existing:
                existing.is_active = False
                existing.save(update_fields=["is_active"])
                existing.staff_sessions.all().delete()
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
        serializer = AssistantSetupClaimSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            token = resolve_assistant_setup_code(serializer.validated_data["code"])
        except InvalidAssistantSetup as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        device = None
        raw_device_token = request.headers.get("X-Device-Token")
        if raw_device_token:
            try:
                candidate = resolve_trusted_device_token(raw_device_token)
                if candidate.clinic_id == token.clinic_id:
                    device = candidate
            except InvalidTrustedDevice:
                device = None

        try:
            with transaction.atomic():
                Clinic.objects.select_for_update().get(pk=token.clinic_id)
                if token.clinic.staff_memberships.filter(
                    role=StaffUser.Role.ASSISTANT,
                    is_active=True,
                ).exists():
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
                    membership.role = StaffUser.Role.ASSISTANT
                    membership.is_active = True
                    membership.task_attention_seen_at = timezone.now()
                    membership.save(
                        update_fields=["role", "is_active", "task_attention_seen_at"]
                    )
                else:
                    membership = StaffMembership.objects.create(
                        user=request.user,
                        clinic=token.clinic,
                        role=StaffUser.Role.ASSISTANT,
                    )
                token.used_at = timezone.now()
                token.save(update_fields=["used_at"])
        except IntegrityError:
            return Response(
                {"detail": "The Assistant slot is already filled."},
                status=status.HTTP_409_CONFLICT,
            )

        if device is not None and request.user.contacts_verified:
            activate_session_clinic(
                request.auth,
                membership,
                device,
                StaffUser.Role.ASSISTANT,
            )
        else:
            clear_session_clinic(request.auth)
        return Response(
            {
                "membership": MembershipSerializer(membership).data,
                "user": serialize_user(request),
            },
            status=status.HTTP_201_CREATED,
        )


class AssistantRecoveryInitiateView(APIView):
    def post(self, request):
        membership = active_membership(request)
        if membership.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Only the Doctor can initiate Assistant recovery.")
        serializer = VerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assistant = membership.clinic.staff_memberships.select_related("user").filter(
            role=StaffUser.Role.ASSISTANT,
            is_active=True,
        ).first()
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
        membership = active_membership(request)
        if active_workspace_role(request) != membership.role:
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
