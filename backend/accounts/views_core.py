from .view_helpers import *  # noqa: F401,F403


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
        response = Response(
            {
                **clinic_payload(clinic),
                "device_token": raw_device_token,
                "trusted_device": TrustedDeviceSerializer(
                    device,
                    context={"current_device_id": device.id},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )
        return set_device_cookie(response, clinic.id, raw_device_token, request)


class ClinicContextView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        device = trusted_device_from_request(request)
        return Response(clinic_payload(device.clinic))


class ClaimDoctorMembershipView(APIView):
    def post(self, request, clinic_id):
        device = trusted_device_from_request(request)
        if str(device.clinic_id) != str(clinic_id):
            raise PermissionDenied("This device is not trusted for that clinic.")
        clinic = device.clinic
        try:
            with transaction.atomic():
                Clinic.objects.select_for_update().get(pk=clinic.pk)
                if clinic.staff_memberships.filter(
                    role=StaffUser.Role.DOCTOR,
                    is_active=True,
                ).exists():
                    return Response(
                        {"detail": "This clinic already has a Doctor."},
                        status=status.HTTP_409_CONFLICT,
                    )
                if request.user.memberships.filter(clinic=clinic, is_active=True).exists():
                    return Response(
                        {"detail": "This account already belongs to this clinic."},
                        status=status.HTTP_409_CONFLICT,
                    )
                existing = request.user.memberships.filter(clinic=clinic).first()
                if existing:
                    existing.role = StaffUser.Role.DOCTOR
                    existing.is_active = True
                    existing.save(update_fields=["role", "is_active"])
                    membership = existing
                else:
                    membership = StaffMembership.objects.create(
                        user=request.user,
                        clinic=clinic,
                        role=StaffUser.Role.DOCTOR,
                    )
        except IntegrityError:
            return Response(
                {"detail": "The Doctor slot was already claimed."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


class StaffRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StaffRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        setup_code = serializer.validated_data.get("setup_code")
        setup_token = None
        device = None

        if role == StaffUser.Role.ASSISTANT and setup_code:
            try:
                setup_token = resolve_assistant_setup_code(setup_code)
            except InvalidAssistantSetup as exc:
                return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            clinic = setup_token.clinic
            raw_device_token = request.headers.get("X-Device-Token")
            if raw_device_token:
                try:
                    candidate = resolve_trusted_device_token(raw_device_token)
                    if candidate.clinic_id == clinic.id:
                        device = candidate
                except InvalidTrustedDevice:
                    device = None
        else:
            # Doctor creation and ordinary in-clinic Assistant creation require
            # a browser already trusted for the clinic.
            device = trusted_device_from_request(request)
            clinic = device.clinic

        if role == StaffUser.Role.ASSISTANT:
            outstanding = clinic.assistant_setup_tokens.filter(
                used_at__isnull=True,
                expires_at__gt=timezone.now(),
            ).exists()
            if outstanding and not setup_code:
                raise PermissionDenied("Use the Assistant setup code for this clinic.")
            if setup_token is not None and setup_token.clinic_id != clinic.id:
                raise PermissionDenied("This setup code belongs to another clinic.")

        try:
            with transaction.atomic():
                Clinic.objects.select_for_update().get(pk=clinic.pk)
                if clinic.staff_memberships.filter(role=role, is_active=True).exists():
                    return Response(
                        {"role": ["This clinic already has an account for this role."]},
                        status=status.HTTP_409_CONFLICT,
                    )
                user = serializer.save()
                membership = StaffMembership.objects.create(
                    user=user,
                    clinic=clinic,
                    role=role,
                )
                if setup_token is not None:
                    setup_token.used_at = timezone.now()
                    setup_token.save(update_fields=["used_at"])
        except IntegrityError:
            return Response(
                {"detail": "An account or clinic role with one of these values already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        if device is not None:
            raw_token, expires_at = issue_staff_session(
                user,
                membership=membership,
                trusted_device=device,
                workspace_role=role,
            )
            user_context = {"membership": membership, "workspace_role": role}
        else:
            # A replacement Assistant may create the personal account from the
            # one-time Doctor setup code on an untrusted browser. No clinic data
            # opens until verified contacts authorize that browser.
            raw_token, expires_at = issue_staff_session(user)
            user_context = {}

        return Response(
            {
                "user": StaffSerializer(user, context=user_context).data,
                "session_token": raw_token,
                "expires_at": expires_at,
            },
            status=status.HTTP_201_CREATED,
        )


class StaffLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StaffLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        raw_token, expires_at = issue_staff_session(user)
        return Response(
            {
                "user": StaffSerializer(user).data,
                "session_token": raw_token,
                "expires_at": expires_at,
            }
        )


class StaffMeView(APIView):
    def get(self, request):
        return Response({"user": serialize_user(request)})


class StaffProfileView(APIView):
    def get(self, request):
        return Response({"user": serialize_user(request)})

    def patch(self, request):
        serializer = StaffProfileSerializer(
            request.user,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"user": serialize_user(request)})


class SelectClinicView(APIView):
    def post(self, request):
        if not request.user.contacts_verified:
            raise PermissionDenied("Verify both email and phone before opening clinic data.")
        serializer = SelectClinicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            membership = request.user.memberships.select_related("clinic").get(
                clinic_id=serializer.validated_data["clinic_id"],
                is_active=True,
            )
        except StaffMembership.DoesNotExist:
            raise PermissionDenied("This account does not belong to that clinic.")
        device = trusted_device_from_request(request)
        if device.clinic_id != membership.clinic_id:
            raise PermissionDenied("This browser is not trusted for that clinic.")
        try:
            activate_session_clinic(
                request.auth,
                membership,
                device,
                serializer.validated_data["workspace_role"],
            )
        except ValueError as exc:
            raise PermissionDenied(str(exc))
        return Response({"user": serialize_user(request)})


class LeaveClinicView(APIView):
    def post(self, request):
        clear_session_clinic(request.auth)
        return Response(
            {"user": serialize_user(request, membership=None, workspace_role="")}
        )


class DevicePairingStartView(APIView):
    def post(self, request):
        serializer = DevicePairingStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            membership = request.user.memberships.select_related("clinic").get(
                clinic_id=serializer.validated_data["clinic_id"],
                is_active=True,
            )
        except StaffMembership.DoesNotExist:
            raise PermissionDenied("This account does not belong to that clinic.")
        try:
            pairing, code, request_token = create_device_pairing_request(
                membership.clinic,
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
            return Response({"status": "pending", "expires_at": pairing.expires_at})
        if not request.user.memberships.filter(
            clinic=device.clinic,
            is_active=True,
        ).exists():
            device.delete()
            raise PermissionDenied("This account no longer belongs to that clinic.")
        response = Response(
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
        return set_device_cookie(response, device.clinic_id, raw_device_token, request)
