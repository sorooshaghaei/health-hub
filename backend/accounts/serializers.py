import re
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from rest_framework import serializers

from .models import Clinic, PasskeyCredential, StaffMembership, StaffUser, TrustedDevice
from .services import normalize_staff_phone


class ClinicSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = ["id", "name", "timezone"]


class ClinicCreateSerializer(serializers.ModelSerializer):
    timezone = serializers.CharField(max_length=64, required=False, default="UTC")

    class Meta:
        model = Clinic
        fields = ["name", "timezone"]

    def validate_timezone(self, value):
        value = value.strip()
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise serializers.ValidationError("Enter a valid IANA timezone, such as Europe/Paris.")
        return value


class TrustedDeviceSerializer(serializers.ModelSerializer):
    current = serializers.SerializerMethodField()

    class Meta:
        model = TrustedDevice
        fields = ["id", "browser", "operating_system", "created_at", "current"]

    def get_current(self, obj):
        return obj.id == self.context.get("current_device_id")


class MembershipSerializer(serializers.ModelSerializer):
    clinic = ClinicSummarySerializer(read_only=True)
    is_clinic_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = StaffMembership
        fields = ["id", "role", "is_clinic_admin", "clinic", "joined_at"]


class StaffSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    email_verified = serializers.SerializerMethodField()
    phone_verified = serializers.SerializerMethodField()
    account_ready = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    workspace_role = serializers.SerializerMethodField()
    is_clinic_admin = serializers.SerializerMethodField()
    clinic = serializers.SerializerMethodField()
    memberships = serializers.SerializerMethodField()
    has_doctor_membership = serializers.BooleanField(read_only=True)

    class Meta:
        model = StaffUser
        fields = [
            "id", "email", "phone", "first_name", "last_name", "display_name",
            "email_verified", "phone_verified", "account_ready", "role",
            "workspace_role", "is_clinic_admin", "clinic", "memberships",
            "has_doctor_membership",
        ]

    def _membership(self):
        explicit = self.context.get("membership")
        if explicit is not None:
            return explicit
        request = self.context.get("request")
        return getattr(getattr(request, "auth", None), "membership", None)

    def get_email_verified(self, obj):
        return obj.email_verified_at is not None

    def get_phone_verified(self, obj):
        return obj.phone_verified_at is not None

    def get_account_ready(self, obj):
        return obj.contacts_verified

    def get_role(self, obj):
        membership = self._membership()
        return membership.role if membership is not None else None

    def get_workspace_role(self, obj):
        explicit = self.context.get("workspace_role")
        if explicit is not None:
            return explicit or None
        request = self.context.get("request")
        return getattr(getattr(request, "auth", None), "workspace_role", None) or None

    def get_is_clinic_admin(self, obj):
        membership = self._membership()
        return bool(membership and membership.is_clinic_admin)

    def get_clinic(self, obj):
        membership = self._membership()
        return ClinicSummarySerializer(membership.clinic).data if membership else None

    def get_memberships(self, obj):
        memberships = obj.memberships.filter(is_active=True).select_related("clinic")
        return MembershipSerializer(memberships, many=True).data


class StaffRegistrationSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=StaffUser.Role.choices)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=32)
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)
    setup_code = serializers.CharField(max_length=32, required=False, allow_blank=False)

    def validate_email(self, value):
        value = value.strip().lower()
        if StaffUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use. Sign in instead.")
        return value

    def validate_phone(self, value):
        try:
            value = normalize_staff_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))
        if StaffUser.objects.filter(phone=value).exists():
            raise serializers.ValidationError("This phone number is already in use. Sign in instead.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        candidate = StaffUser(email=attrs["email"], phone=attrs["phone"], first_name=attrs["first_name"], last_name=attrs["last_name"])
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm")
        validated_data.pop("role")
        validated_data.pop("setup_code", None)
        password = validated_data.pop("password")
        return StaffUser.objects.create_user(password=password, **validated_data)


class StaffLoginSerializer(serializers.Serializer):
    identity = serializers.CharField(max_length=254)
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        identity = attrs["identity"].strip()
        phone = None
        if identity.startswith("+") or identity.startswith("00"):
            try:
                phone = normalize_staff_phone(identity)
            except ValueError:
                phone = None
        query = Q(email__iexact=identity.lower())
        if phone:
            query |= Q(phone=phone)
        user = StaffUser.objects.filter(query, is_active=True).first()
        if user is None or not user.check_password(attrs["password"]):
            raise serializers.ValidationError("Email/phone or password is incorrect.")
        attrs["user"] = user
        return attrs


class StaffProfileSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(max_length=32, required=False)

    class Meta:
        model = StaffUser
        fields = ["first_name", "last_name", "phone"]

    def validate_phone(self, value):
        if self.instance and self.instance.phone:
            raise serializers.ValidationError("Use the verified phone-change flow to change your phone number.")
        try:
            value = normalize_staff_phone(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc))
        if StaffUser.objects.filter(phone=value).exclude(pk=getattr(self.instance, "pk", None)).exists():
            raise serializers.ValidationError("This phone number is already in use.")
        return value


class SelectClinicSerializer(serializers.Serializer):
    clinic_id = serializers.UUIDField()
    workspace_role = serializers.ChoiceField(choices=StaffUser.Role.choices)


class DevicePairingStartSerializer(serializers.Serializer):
    clinic_id = serializers.UUIDField()


class DevicePairingCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=16)

    def validate_code(self, value):
        normalized = re.sub(r"\D", "", value)
        if len(normalized) != 6:
            raise serializers.ValidationError("Enter the six-digit pairing code.")
        return normalized


class DevicePairingStatusSerializer(serializers.Serializer):
    request_token = serializers.CharField(max_length=200, trim_whitespace=False)


class VerificationRequestSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=["email", "sms"])


class VerificationConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(min_length=6, max_length=12, trim_whitespace=True)


class ContactChangeRequestSerializer(serializers.Serializer):
    value = serializers.CharField(max_length=254)
    current_password = serializers.CharField(required=False, allow_blank=False, trim_whitespace=False, write_only=True)


class PasswordChangeConfirmSerializer(serializers.Serializer):
    code = serializers.CharField(min_length=6, max_length=12)
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    password_confirm = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        try:
            validate_password(attrs["password"], user=self.context.get("user"))
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs


class RecoveryRequestSerializer(serializers.Serializer):
    identity = serializers.CharField(max_length=254)
    channel = serializers.ChoiceField(choices=["email", "sms"])


class RecoveryConfirmSerializer(serializers.Serializer):
    identity = serializers.CharField(max_length=254)
    code = serializers.CharField(min_length=6, max_length=16)


class RecoveryResetSerializer(serializers.Serializer):
    recovery_token = serializers.CharField(max_length=200, trim_whitespace=False)
    password = serializers.CharField(trim_whitespace=False, write_only=True)
    password_confirm = serializers.CharField(trim_whitespace=False, write_only=True)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": "Passwords do not match."})
        return attrs


class RecoveryCodeConfirmSerializer(serializers.Serializer):
    identity = serializers.CharField(max_length=254)
    code = serializers.CharField(max_length=32)


class PasskeySerializer(serializers.ModelSerializer):
    class Meta:
        model = PasskeyCredential
        fields = ["id", "name", "created_at", "last_used_at"]


class PasskeyRegisterCompleteSerializer(serializers.Serializer):
    credential = serializers.JSONField()
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)


class PasskeyAuthenticateBeginSerializer(serializers.Serializer):
    identity = serializers.CharField(max_length=254)


class PasskeyAuthenticateCompleteSerializer(serializers.Serializer):
    identity = serializers.CharField(max_length=254)
    credential = serializers.JSONField()


class PasskeyDeleteSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=False, allow_blank=False, trim_whitespace=False, write_only=True)


class ReauthenticateSerializer(serializers.Serializer):
    password = serializers.CharField(trim_whitespace=False, write_only=True)


class AssistantSetupSerializer(serializers.Serializer):
    replace_existing = serializers.BooleanField(default=False)


class AssistantSetupClaimSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=32)
    workspace_role = serializers.ChoiceField(choices=StaffUser.Role.choices, default=StaffUser.Role.ASSISTANT)
