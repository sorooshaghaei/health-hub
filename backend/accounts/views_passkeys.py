from .view_helpers import *  # noqa: F401,F403

class PasskeyListView(APIView):
    def get(self, request): return Response({"passkeys":PasskeySerializer(request.user.passkeys.all(),many=True).data})

class PasskeyRegistrationOptionsView(APIView):
    def post(self, request):
        try: return Response({"public_key":registration_options(request.user)})
        except PasskeyError as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)

class PasskeyRegistrationCompleteView(APIView):
    def post(self, request):
        serializer=PasskeyRegisterCompleteSerializer(data=request.data); serializer.is_valid(raise_exception=True)
        try: passkey=verify_registration(request.user,serializer.validated_data["credential"],serializer.validated_data.get("name","Passkey"))
        except PasskeyError as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
        return Response(PasskeySerializer(passkey).data,status=status.HTTP_201_CREATED)

class PasskeyAuthenticationOptionsView(APIView):
    permission_classes=[AllowAny]
    def post(self, request):
        serializer=PasskeyAuthenticateBeginSerializer(data=request.data); serializer.is_valid(raise_exception=True); user=find_user_by_identity(serializer.validated_data["identity"])
        if user is None: return Response({"detail":"Passkey sign-in is unavailable."},status=status.HTTP_400_BAD_REQUEST)
        try: options=authentication_options(user)
        except PasskeyError: return Response({"detail":"Passkey sign-in is unavailable."},status=status.HTTP_400_BAD_REQUEST)
        return Response({"public_key":options})

class PasskeyAuthenticationCompleteView(APIView):
    permission_classes=[AllowAny]
    def post(self, request):
        serializer=PasskeyAuthenticateCompleteSerializer(data=request.data); serializer.is_valid(raise_exception=True); user=find_user_by_identity(serializer.validated_data["identity"])
        if user is None: return Response({"detail":"Passkey sign-in could not be verified."},status=status.HTTP_400_BAD_REQUEST)
        try: passkey=verify_authentication(user,serializer.validated_data["credential"])
        except PasskeyError as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
        raw_token,expires_at=issue_staff_session(user,auth_method=StaffSession.AuthMethod.PASSKEY,reauth_passkey=passkey)
        return Response({"user":StaffSerializer(user).data,"session_token":raw_token,"expires_at":expires_at})

class PasskeyReauthenticationCompleteView(APIView):
    def post(self, request):
        credential=request.data.get("credential")
        if not isinstance(credential,dict): return Response({"credential":["Passkey credential is required."]},status=status.HTTP_400_BAD_REQUEST)
        try: passkey=verify_authentication(request.user,credential)
        except PasskeyError as exc: return Response({"detail":str(exc)},status=status.HTTP_400_BAD_REQUEST)
        mark_session_reauthenticated(request.auth,method=StaffSession.AuthMethod.PASSKEY,passkey=passkey); return Response({"detail":"Reauthenticated."})

class PasskeyDeleteView(APIView):
    def delete(self, request, passkey_id):
        try: passkey=request.user.passkeys.get(pk=passkey_id)
        except PasskeyCredential.DoesNotExist: return Response({"detail":"Passkey not found."},status=status.HTTP_404_NOT_FOUND)
        serializer=PasskeyDeleteSerializer(data=request.data or {}); serializer.is_valid(raise_exception=True); current_password=serializer.validated_data.get("current_password")
        allowed=bool(current_password and request.user.check_password(current_password))
        if not allowed and session_recently_reauthenticated(request.auth): allowed=request.auth.auth_method==StaffSession.AuthMethod.PASSKEY and request.auth.reauth_passkey_id is not None and request.auth.reauth_passkey_id!=passkey.id
        if not allowed: raise PermissionDenied("Use your current password or another passkey to remove this passkey.")
        passkey.delete(); return Response(status=status.HTTP_204_NO_CONTENT)
