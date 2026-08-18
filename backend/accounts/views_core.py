from .view_helpers import *  # noqa: F401,F403


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok", "service": "Health Hub API"})


class ClinicCreateView(APIView):
    def post(self, request):
        if request.user.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Only Doctor accounts can create clinics.")
        if not request.user.contacts_verified:
            raise PermissionDenied("Verify both email and phone before creating a clinic.")

        serializer = ClinicCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_device_token = None
        device = request.auth.trusted_device
        if device is not None and device.user_id != request.user.id:
            raise PermissionDenied("This browser is not trusted for this account.")
        if device is None:
            if request.user.trusted_devices.exists():
                raise PermissionDenied("Authorize this browser before creating another clinic.")
            raw_device_token, device = issue_trusted_device(request.user, user_agent(request))
            request.auth.trusted_device = device
            request.auth.save(update_fields=["trusted_device"])

        with transaction.atomic():
            clinic = serializer.save(owner_doctor=request.user)
            membership = StaffMembership.objects.create(
                user=request.user,
                clinic=clinic,
            )
            activate_session_clinic(
                request.auth,
                membership,
                device,
                StaffUser.Role.DOCTOR,
            )

        payload = {
            **clinic_payload(clinic),
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


class ClinicContextView(APIView):
    def get(self, request):
        device = request.auth.trusted_device
        if device is None or device.user_id != request.user.id:
            raise PermissionDenied("This browser is not trusted for this account.")
        payload = {
            "trusted_device": TrustedDeviceSerializer(
                device,
                context={"current_device_id": device.id},
            ).data,
            "user": serialize_user(request),
        }
        if request.auth.membership_id:
            payload.update(clinic_payload(request.auth.membership.clinic))
        return Response(payload)


class ClaimDoctorMembershipView(APIView):
    """Compatibility endpoint for an ownerless migrated/test clinic.

    Normal production clinic creation assigns the Doctor owner atomically and
    never uses this endpoint.
    """

    def post(self, request, clinic_id):
        if request.user.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Only Doctor accounts can own clinics.")
        if request.auth.trusted_device_id is None:
            raise PermissionDenied("Authorize this browser first.")
        try:
            with transaction.atomic():
                clinic = Clinic.objects.select_for_update().get(pk=clinic_id)
                if clinic.owner_doctor_id and clinic.owner_doctor_id != request.user.id:
                    return Response(
                        {"detail": "This clinic already has a Doctor."},
                        status=status.HTTP_409_CONFLICT,
                    )
                membership, created = StaffMembership.objects.get_or_create(
                    user=request.user,
                    clinic=clinic,
                    defaults={"is_active": True},
                )
                if not created and membership.is_active:
                    return Response(
                        {"detail": "This account already belongs to this clinic."},
                        status=status.HTTP_409_CONFLICT,
                    )
                if not membership.is_active:
                    membership.is_active = True
                    membership.save(update_fields=["is_active"])
                clinic.owner_doctor = request.user
                clinic.save(update_fields=["owner_doctor"])
        except Clinic.DoesNotExist:
            return Response({"detail": "Clinic not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(MembershipSerializer(membership).data, status=status.HTTP_201_CREATED)


class StaffRegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = StaffRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "An account with one of these contacts already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        raw_token, expires_at = issue_staff_session(user)
        return Response(
            {
                "user": StaffSerializer(user).data,
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

        device = None
        raw_device_token = request.headers.get("X-Device-Token") or request.COOKIES.get(
            trusted_device_cookie_name()
        )
        if raw_device_token:
            try:
                device = resolve_trusted_device_token(raw_device_token, user=user)
            except InvalidTrustedDevice:
                device = None

        raw_token, expires_at = issue_staff_session(user, trusted_device=device)
        user_payload = StaffSerializer(user).data
        user_payload["device_trusted"] = device is not None
        return Response(
            {
                "user": user_payload,
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
        if request.auth.trusted_device_id is None:
            raise PermissionDenied("Authorize this browser before opening clinic data.")
        serializer = SelectClinicSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            membership = request.user.memberships.select_related("clinic", "user").get(
                clinic_id=serializer.validated_data["clinic_id"],
                is_active=True,
            )
        except StaffMembership.DoesNotExist:
            raise PermissionDenied("This account does not belong to that clinic.")
        try:
            activate_session_clinic(
                request.auth,
                membership,
                request.auth.trusted_device,
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
            pairing, code, request_token = create_device_pairing_request(
                request.user,
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
                request.user,
                serializer.validated_data["request_token"],
            )
        except InvalidDevicePairing as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if device is None:
            return Response({"status": "pending", "expires_at": pairing.expires_at})
        request.auth.trusted_device = device
        request.auth.save(update_fields=["trusted_device"])
        response = Response(
            {
                "status": "approved",
                "device_token": raw_device_token,
                "trusted_device": TrustedDeviceSerializer(
                    device,
                    context={"current_device_id": device.id},
                ).data,
                "user": serialize_user(request),
            }
        )
        return set_device_cookie(response, raw_device_token, request)
