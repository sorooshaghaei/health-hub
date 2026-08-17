from .view_helpers import *  # noqa: F401,F403

class DevicePairingApproveView(APIView):
    def post(self, request):
        membership=active_membership(request); serializer=DevicePairingCodeSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        try: pairing=approve_device_pairing(membership.clinic,serializer.validated_data["code"])
        except InvalidDevicePairing as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
        return Response({"status":"approved","browser":pairing.browser,"operating_system":pairing.operating_system})

class DeviceContactAuthorizationRequestView(APIView):
    def post(self, request):
        serializer=DevicePairingStartSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        channel_serializer=VerificationRequestSerializer(data=request.data); channel_serializer.is_valid(raise_exception=True)
        try: membership=request.user.memberships.select_related("clinic").get(clinic_id=serializer.validated_data["clinic_id"],is_active=True)
        except StaffMembership.DoesNotExist: raise PermissionDenied("This account does not belong to that clinic.")
        try: challenge,development_code=issue_verification_challenge(request.user,purpose=VerificationChallenge.Purpose.DEVICE_AUTHORIZE,channel=channel_serializer.validated_data["channel"],clinic=membership.clinic)
        except (InvalidVerificationChallenge,VerificationRateLimited,DeliveryNotConfigured) as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
        payload={"detail":"Verification code sent.","expires_at":challenge.expires_at}
        if development_code: payload["development_code"]=development_code
        return Response(payload)

class DeviceContactAuthorizationConfirmView(APIView):
    def post(self, request):
        clinic_serializer=DevicePairingStartSerializer(data=request.data); clinic_serializer.is_valid(raise_exception=True)
        code_serializer=VerificationConfirmSerializer(data=request.data); code_serializer.is_valid(raise_exception=True)
        try: membership=request.user.memberships.select_related("clinic").get(clinic_id=clinic_serializer.validated_data["clinic_id"],is_active=True)
        except StaffMembership.DoesNotExist: raise PermissionDenied("This account does not belong to that clinic.")
        try: verify_latest_challenge(request.user,purpose=VerificationChallenge.Purpose.DEVICE_AUTHORIZE,code=code_serializer.validated_data["code"],clinic=membership.clinic)
        except InvalidVerificationChallenge as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
        raw_device_token,device=issue_trusted_device(membership.clinic,user_agent(request))
        response=Response({"device_token":raw_device_token,"trusted_device":TrustedDeviceSerializer(device,context={"current_device_id":device.id}).data},status=status.HTTP_201_CREATED)
        return set_device_cookie(response,membership.clinic_id,raw_device_token,request)

class TrustedDeviceListView(APIView):
    def get(self, request):
        membership=active_membership(request); devices=membership.clinic.trusted_devices.all()
        return Response({"devices":TrustedDeviceSerializer(devices,many=True,context={"current_device_id":request.auth.trusted_device_id}).data})

class TrustedDeviceDeleteView(APIView):
    def delete(self, request, device_id):
        membership=active_membership(request)
        try: device=TrustedDevice.objects.get(pk=device_id,clinic=membership.clinic)
        except TrustedDevice.DoesNotExist: return Response({"detail":"Trusted device not found."},status=status.HTTP_404_NOT_FOUND)
        device.delete(); return Response(status=status.HTTP_204_NO_CONTENT)
