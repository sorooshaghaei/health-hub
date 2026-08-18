from .view_helpers import *  # noqa: F401,F403


class InitialEmailVerificationRequestView(APIView):
    def post(self, request):
        if request.user.email_verified_at:
            return Response({"detail": "Email is already verified."})
        try:
            challenge, development_code = issue_verification_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.EMAIL_VERIFY,
                channel=VerificationChallenge.Channel.EMAIL,
                destination=request.user.email,
            )
        except (VerificationRateLimited, DeliveryNotConfigured) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = {"detail": "Verification code sent.", "expires_at": challenge.expires_at}
        if development_code:
            payload["development_code"] = development_code
        return Response(payload)


class InitialEmailVerificationConfirmView(APIView):
    def post(self, request):
        serializer = VerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            verify_latest_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.EMAIL_VERIFY,
                code=serializer.validated_data["code"],
            )
        except InvalidVerificationChallenge as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        request.user.email_verified_at = timezone.now()
        request.user.save(update_fields=["email_verified_at"])
        return Response({"user": serialize_user(request)})


class InitialPhoneVerificationRequestView(APIView):
    def post(self, request):
        if request.user.phone_verified_at:
            return Response({"detail": "Phone is already verified."})
        if not request.user.phone:
            return Response({"detail": "Add a phone number first."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            challenge, development_code = issue_verification_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.PHONE_VERIFY,
                channel=VerificationChallenge.Channel.SMS,
                destination=request.user.phone,
            )
        except (VerificationRateLimited, DeliveryNotConfigured) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = {"detail": "Verification code sent.", "expires_at": challenge.expires_at}
        if development_code:
            payload["development_code"] = development_code
        return Response(payload)


class InitialPhoneVerificationConfirmView(APIView):
    def post(self, request):
        serializer = VerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            verify_latest_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.PHONE_VERIFY,
                code=serializer.validated_data["code"],
            )
        except InvalidVerificationChallenge as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        request.user.phone_verified_at = timezone.now()
        request.user.save(update_fields=["phone_verified_at"])
        return Response({"user": serialize_user(request)})


class ContactChangeRequestView(APIView):
    contact_kind = None

    def post(self, request):
        serializer = ContactChangeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reauthenticate_if_needed(request, serializer.validated_data.get("current_password"))
        value = serializer.validated_data["value"].strip()

        if self.contact_kind == "email":
            value = value.lower()
            if "@" not in value:
                return Response({"value": ["Enter a valid email address."]}, status=status.HTTP_400_BAD_REQUEST)
            if StaffUser.objects.filter(email__iexact=value).exclude(pk=request.user.pk).exists():
                return Response({"value": ["This email is already in use."]}, status=status.HTTP_400_BAD_REQUEST)
            purpose = VerificationChallenge.Purpose.EMAIL_CHANGE
            channel = VerificationChallenge.Channel.EMAIL
        else:
            try:
                value = normalize_staff_phone(value)
            except ValueError as exc:
                return Response({"value": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)
            if StaffUser.objects.filter(phone=value).exclude(pk=request.user.pk).exists():
                return Response({"value": ["This phone number is already in use."]}, status=status.HTTP_400_BAD_REQUEST)
            purpose = VerificationChallenge.Purpose.PHONE_CHANGE
            channel = VerificationChallenge.Channel.SMS

        try:
            challenge, development_code = issue_verification_challenge(
                request.user,
                purpose=purpose,
                channel=channel,
                destination=value,
                pending_value=value,
            )
        except (VerificationRateLimited, DeliveryNotConfigured) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = {"detail": "Verification code sent.", "expires_at": challenge.expires_at}
        if development_code:
            payload["development_code"] = development_code
        return Response(payload)


class EmailChangeRequestView(ContactChangeRequestView):
    contact_kind = "email"


class PhoneChangeRequestView(ContactChangeRequestView):
    contact_kind = "phone"


class ContactChangeConfirmView(APIView):
    contact_kind = None

    def post(self, request):
        if not session_recently_reauthenticated(request.auth):
            raise PermissionDenied("Reauthenticate with your password or a passkey first.")
        serializer = VerificationConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purpose = (
            VerificationChallenge.Purpose.EMAIL_CHANGE
            if self.contact_kind == "email"
            else VerificationChallenge.Purpose.PHONE_CHANGE
        )
        try:
            challenge = verify_latest_challenge(
                request.user,
                purpose=purpose,
                code=serializer.validated_data["code"],
            )
        except InvalidVerificationChallenge as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        if self.contact_kind == "email":
            old = request.user.email
            request.user.email = challenge.pending_value
            request.user.email_verified_at = timezone.now()
            request.user.save(update_fields=["email", "email_verified_at"])
            deliver_security_notice(
                channel="email",
                destination=old,
                message="Your Health Hub email address was changed.",
            )
        else:
            old = request.user.phone
            request.user.phone = challenge.pending_value
            request.user.phone_verified_at = timezone.now()
            request.user.save(update_fields=["phone", "phone_verified_at"])
            deliver_security_notice(
                channel="sms",
                destination=old,
                message="Your Health Hub phone number was changed.",
            )
        return Response({"user": serialize_user(request)})


class EmailChangeConfirmView(ContactChangeConfirmView):
    contact_kind = "email"


class PhoneChangeConfirmView(ContactChangeConfirmView):
    contact_kind = "phone"


class PasswordChangeRequestView(APIView):
    def post(self, request):
        serializer = VerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            challenge, development_code = issue_verification_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.PASSWORD_CHANGE,
                channel=serializer.validated_data["channel"],
            )
        except (InvalidVerificationChallenge, VerificationRateLimited, DeliveryNotConfigured) as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        payload = {"detail": "Verification code sent.", "expires_at": challenge.expires_at}
        if development_code:
            payload["development_code"] = development_code
        return Response(payload)


class PasswordChangeConfirmView(APIView):
    def post(self, request):
        serializer = PasswordChangeConfirmSerializer(data=request.data, context={"user": request.user})
        serializer.is_valid(raise_exception=True)
        try:
            verify_latest_challenge(
                request.user,
                purpose=VerificationChallenge.Purpose.PASSWORD_CHANGE,
                code=serializer.validated_data["code"],
            )
        except InvalidVerificationChallenge as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(serializer.validated_data["password"])
        request.user.save(update_fields=["password"])
        StaffSession.objects.filter(user=request.user).exclude(pk=request.auth.pk).delete()
        return Response({"detail": "Password changed. Other sessions were signed out."})


class ReauthenticatePasswordView(APIView):
    def post(self, request):
        serializer = ReauthenticateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not request.user.check_password(serializer.validated_data["password"]):
            raise PermissionDenied("Current password is incorrect.")
        mark_session_reauthenticated(
            request.auth,
            method=StaffSession.AuthMethod.PASSWORD,
            passkey=None,
        )
        return Response({"detail": "Reauthenticated."})


class RecoveryRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RecoveryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = find_user_by_identity(serializer.validated_data["identity"])
        if user is not None:
            try:
                issue_verification_challenge(
                    user,
                    purpose=VerificationChallenge.Purpose.PASSWORD_RECOVERY,
                    channel=serializer.validated_data["channel"],
                )
            except Exception:
                pass
        return Response({"detail": "If the account and verified channel exist, a recovery code was sent."})


class RecoveryConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RecoveryConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = find_user_by_identity(serializer.validated_data["identity"])
        if user is None:
            return Response({"detail": "Recovery code is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            verify_latest_challenge(
                user,
                purpose=VerificationChallenge.Purpose.PASSWORD_RECOVERY,
                code=serializer.validated_data["code"],
            )
        except InvalidVerificationChallenge:
            return Response({"detail": "Recovery code is invalid or expired."}, status=status.HTTP_400_BAD_REQUEST)
        raw_token, grant = issue_recovery_grant(user)
        return Response({"recovery_token": raw_token, "expires_at": grant.expires_at})


class RecoveryCodeConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RecoveryCodeConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = find_user_by_identity(serializer.validated_data["identity"])
        if user is None or not consume_recovery_code(user, serializer.validated_data["code"]):
            return Response({"detail": "Recovery code is invalid or already used."}, status=status.HTTP_400_BAD_REQUEST)
        raw_token, grant = issue_recovery_grant(user)
        return Response({"recovery_token": raw_token, "expires_at": grant.expires_at})


class RecoveryResetView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RecoveryResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            grant = resolve_recovery_grant(serializer.validated_data["recovery_token"])
        except InvalidRecoveryGrant as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(serializer.validated_data["password"], user=grant.user)
        except DjangoValidationError as exc:
            return Response({"password": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)
        grant.user.set_password(serializer.validated_data["password"])
        grant.user.save(update_fields=["password"])
        grant.consumed_at = timezone.now()
        grant.save(update_fields=["consumed_at"])
        StaffSession.objects.filter(user=grant.user).delete()
        return Response({"detail": "Password reset complete. Sign in again."})


class RecoveryCodeListView(APIView):
    def get(self, request):
        if request.user.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Offline recovery codes are available only to Doctors.")
        return Response({"remaining": RecoveryCode.objects.filter(user=request.user, used_at__isnull=True).count()})

    def post(self, request):
        if request.user.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Offline recovery codes are available only to Doctors.")
        codes = generate_recovery_codes(request.user)
        return Response({"codes": codes, "remaining": len(codes)})


class StaffAccountDeleteView(APIView):
    def get(self, request):
        if request.user.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Assistant accounts are managed through clinic memberships.")
        clinics = request.user.owned_clinics.order_by("name")
        return Response({"clinics": ClinicSummarySerializer(clinics, many=True).data})

    def delete(self, request):
        if request.user.role != StaffUser.Role.DOCTOR:
            raise PermissionDenied("Assistant accounts cannot be deleted from account settings.")
        if request.auth.trusted_device_id is None:
            raise PermissionDenied("Authorize this browser before deleting the Doctor account.")
        serializer = AccountDeleteSerializer(data=request.data or {})
        serializer.is_valid(raise_exception=True)
        reauthenticate_if_needed(request, serializer.validated_data.get("current_password"))

        doctor = request.user
        with transaction.atomic():
            owned_clinics = list(doctor.owned_clinics.select_for_update())
            clinic_ids = [clinic.id for clinic in owned_clinics]
            assistant_ids = list(
                StaffMembership.objects.filter(
                    clinic_id__in=clinic_ids,
                    is_active=True,
                    user__role=StaffUser.Role.ASSISTANT,
                ).values_list("user_id", flat=True)
            )

            # Delete clinics before the Doctor account. Clinic deletion removes
            # clinic-owned tasks/comments first, so their protected author
            # references cannot block the intentional destructive cascade.
            Clinic.objects.filter(id__in=clinic_ids).delete()

            dormant_at = timezone.now()
            for assistant in StaffUser.objects.filter(
                id__in=assistant_ids,
                role=StaffUser.Role.ASSISTANT,
                is_active=True,
            ):
                if not assistant.memberships.filter(is_active=True).exists():
                    assistant.dormant_since = dormant_at
                    assistant.save(update_fields=["dormant_since"])

            doctor.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)