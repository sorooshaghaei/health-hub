from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from .models import Clinic, StaffUser


class ClinicSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = ["id", "name", "email", "phone"]


class ClinicCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    class Meta:
        model = Clinic
        fields = ["name", "email", "phone", "password", "password_confirm"]

    def validate_email(self, value):
        return value.strip().lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Clinic passwords do not match."}
            )
        if len(attrs["password"]) < 10:
            raise serializers.ValidationError(
                {"password": "Use at least 10 characters for the clinic password."}
            )
        return attrs

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("password_confirm")
        clinic = Clinic(**validated_data)
        clinic.set_password(password)
        clinic.save()
        return clinic


class ClinicEnterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        try:
            clinic = Clinic.objects.get(email__iexact=attrs["email"].strip())
        except Clinic.DoesNotExist:
            raise serializers.ValidationError("Clinic email or password is incorrect.")

        if not clinic.check_password(attrs["password"]):
            raise serializers.ValidationError("Clinic email or password is incorrect.")

        attrs["clinic"] = clinic
        return attrs


class StaffSerializer(serializers.ModelSerializer):
    clinic = ClinicSummarySerializer(read_only=True)
    is_clinic_admin = serializers.BooleanField(read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = StaffUser
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "display_name",
            "role",
            "is_clinic_admin",
            "clinic",
        ]

    def get_display_name(self, obj):
        return obj.get_full_name().strip() or obj.username


class StaffRegistrationSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=StaffUser.Role.choices)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    password_confirm = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        value = value.strip()
        if StaffUser.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already in use.")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        if StaffUser.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already in use.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Staff passwords do not match."}
            )
        candidate = StaffUser(
            username=attrs["username"],
            email=attrs["email"],
            first_name=attrs["first_name"],
            last_name=attrs["last_name"],
        )
        try:
            validate_password(attrs["password"], user=candidate)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated_data):
        clinic = self.context["clinic"]
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        return StaffUser.objects.create_user(
            clinic=clinic,
            password=password,
            **validated_data,
        )


class StaffLoginSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=StaffUser.Role.choices)
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)

    def validate(self, attrs):
        clinic = self.context["clinic"]
        user = authenticate(
            request=self.context.get("request"),
            username=attrs["username"].strip(),
            password=attrs["password"],
        )
        if (
            user is None
            or user.clinic_id != clinic.id
            or user.role != attrs["role"]
        ):
            raise serializers.ValidationError("Username or password is incorrect.")
        attrs["user"] = user
        return attrs
