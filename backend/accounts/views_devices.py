from .view_helpers import *  # noqa: F401,F403


class DevicePairingApproveView(APIView):
    def post(self, request):
        if request.auth.trusted_device_id is None:
            raise PermissionDenied("Use a trusted device to approve another browser.")
        serializer = DevicePairingCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pairing = approve_device_pairing(
                request.user,
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


class DeviceContactAuthorizationRequestView(APIView):
    def post(self, request):
        if not request.user.contacts_verified:
            raise PermissionDenied("Verify both email and phone before trusting a browser.")
        serializer = VerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            challenge, development_code = issue_verification_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.DEVICE_AUTHORIZE,
                channel=serializer.validated_data["channel"],
            )
        except (
            InvalidVerificationChallenge,
            VerificationRateLimited,
            DeliveryNotConfigured,
        ) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = {
            "detail": "Verification code sent.",
            "expires_at": challenge.expires_at,
        }
        if development_code:
            payload["development_code"] = development_code
        return Response(payload)


class DeviceContactAuthorizationConfirmView(APIView):
    def post(self, request):
        serializer = VerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            verify_latest_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.DEVICE_AUTHORIZE,
                code=serializer.validated_data["code"],
            )
        except InvalidVerificationChallenge as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        raw_device_token, device = issue_trusted_device(
            request.user,
            user_agent(request),
        )
        request.auth.trusted_device = device
        request.auth.save(update_fields=["trusted_device"])
        response = Response(
            {
                "device_token": raw_device_token,
                "trusted_device": TrustedDeviceSerializer(
                    device,
                    context={"current_device_id": device.id},
                ).data,
                "user": serialize_user(request),
            },
            status=status.HTTP_201_CREATED,
        )
        return set_device_cookie(response, raw_device_token, request)


class TrustedDeviceListView(APIView):
    def get(self, request):
        devices = request.user.trusted_devices.all()
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
            device = request.user.trusted_devices.get(pk=device_id)
        except TrustedDevice.DoesNotExist:
            return Response(
                {"detail": "Trusted device not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if device.id == request.auth.trusted_device_id:
            return Response(
                {"detail": "The current trusted device cannot be removed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        device.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
