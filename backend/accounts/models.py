import uuid

from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class StaffUserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email=None, password=None, **extra_fields):
        # `clinic` and `username` remain accepted only for historical test
        # fixtures. Production registration creates the personal account first
        # and attaches clinic memberships explicitly afterwards.
        legacy_clinic = extra_fields.pop("clinic", None)
        extra_fields.pop("username", None)
        legacy_attention = extra_fields.pop("task_attention_seen_at", None)
        role = extra_fields.pop("role", None)
        if not email:
            raise ValueError("An email address is required.")
        if role not in {StaffUser.Role.DOCTOR, StaffUser.Role.ASSISTANT}:
            raise ValueError("A permanent Doctor or Assistant role is required.")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, role=role, **extra_fields)
        user.set_password(password)
        if legacy_clinic is not None:
            now = timezone.now()
            user.email_verified_at = user.email_verified_at or now
            user.phone_verified_at = user.phone_verified_at or now
        user.save(using=self._db)
        if legacy_clinic is not None:
            membership = StaffMembership.objects.create(
                user=user,
                clinic=legacy_clinic,
                task_attention_seen_at=legacy_attention or timezone.now(),
            )
            if role == StaffUser.Role.DOCTOR and legacy_clinic.owner_doctor_id is None:
                legacy_clinic.owner_doctor = user
                legacy_clinic.save(update_fields=["owner_doctor"])
            if role == StaffUser.Role.ASSISTANT:
                user.dormant_since = None
                user.save(update_fields=["dormant_since"])
            return user
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("role", StaffUser.Role.DOCTOR)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self.create_user(email, password, **extra_fields)


class Clinic(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    timezone = models.CharField(max_length=64, default="UTC")
    owner_doctor = models.ForeignKey(
        "StaffUser",
        on_delete=models.CASCADE,
        related_name="owned_clinics",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class ClinicWorkingHour(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, "Monday"
        TUESDAY = 1, "Tuesday"
        WEDNESDAY = 2, "Wednesday"
        THURSDAY = 3, "Thursday"
        FRIDAY = 4, "Friday"
        SATURDAY = 5, "Saturday"
        SUNDAY = 6, "Sunday"

    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name="working_hours",
    )
    weekday = models.PositiveSmallIntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()

    class Meta:
        ordering = ["weekday"]
        constraints = [
            models.UniqueConstraint(
                fields=["clinic", "weekday"],
                name="one_working_range_per_clinic_weekday",
            ),
            models.CheckConstraint(
                condition=models.Q(start_time__lt=models.F("end_time")),
                name="clinic_working_start_before_end",
            ),
        ]

    def __str__(self):
        return f"{self.clinic.name} · {self.get_weekday_display()} · {self.start_time:%H:%M}–{self.end_time:%H:%M}"


class TrustedDevice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "StaffUser",
        on_delete=models.CASCADE,
        related_name="trusted_devices",
        null=True,
        blank=True,
    )
    token_hash = models.CharField(max_length=64, unique=True)
    browser = models.CharField(max_length=80)
    operating_system = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_used_at", "-created_at"]

    def __str__(self):
        return f"{self.browser} on {self.operating_system}"


class DevicePairingRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        "StaffUser",
        on_delete=models.CASCADE,
        related_name="device_pairing_requests",
    )
    request_token_hash = models.CharField(max_length=64, unique=True)
    code_hash = models.CharField(max_length=64, unique=True)
    browser = models.CharField(max_length=80)
    operating_system = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()


class StaffUser(AbstractUser):
    username = None

    class Role(models.TextChoices):
        DOCTOR = "doctor", "Doctor"
        ASSISTANT = "assistant", "Assistant"

    email = models.EmailField("email address", unique=True)
    phone = models.CharField(max_length=32, unique=True, null=True, blank=True)
    role = models.CharField(max_length=16, choices=Role.choices)
    email_verified_at = models.DateTimeField(null=True, blank=True)
    phone_verified_at = models.DateTimeField(null=True, blank=True)
    private_note = models.TextField(blank=True, default="")
    dormant_since = models.DateTimeField(null=True, blank=True)
    anonymized_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []
    objects = StaffUserManager()

    @property
    def display_name(self):
        if self.anonymized_at is not None:
            return "Former Assistant"
        return self.get_full_name().strip() or self.email

    @property
    def contacts_verified(self):
        return self.email_verified_at is not None and self.phone_verified_at is not None

    @property
    def has_doctor_membership(self):
        return self.role == self.Role.DOCTOR and self.memberships.filter(is_active=True).exists()

    @property
    def clinic(self):
        membership = self.memberships.filter(is_active=True).select_related("clinic").order_by("joined_at").first()
        return membership.clinic if membership else None

    @property
    def clinic_id(self):
        membership = self.memberships.filter(is_active=True).order_by("joined_at").first()
        return membership.clinic_id if membership else None

    @property
    def is_clinic_admin(self):
        return self.role == self.Role.DOCTOR

    @property
    def task_attention_seen_at(self):
        membership = self.memberships.filter(is_active=True).order_by("joined_at").first()
        return membership.task_attention_seen_at if membership else timezone.now()

    @task_attention_seen_at.setter
    def task_attention_seen_at(self, value):
        if self.pk:
            membership = self.memberships.filter(is_active=True).order_by("joined_at").first()
            if membership:
                membership.task_attention_seen_at = value
                membership.save(update_fields=["task_attention_seen_at"])


class StaffMembership(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="memberships")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="staff_memberships")
    is_active = models.BooleanField(default=True)
    task_attention_seen_at = models.DateTimeField(default=timezone.now)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["clinic__name", "joined_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "clinic"], name="one_membership_per_user_clinic"),
        ]

    @property
    def role(self):
        # Compatibility/readability only. Role authority lives exclusively on
        # the global personal account.
        return self.user.role

    @property
    def is_clinic_admin(self):
        return (
            self.user.role == StaffUser.Role.DOCTOR
            and self.clinic.owner_doctor_id == self.user_id
        )

    def __str__(self):
        return f"{self.user.display_name} · {self.user.get_role_display()} · {self.clinic.name}"


class PasskeyCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="passkeys")
    credential_id = models.TextField(unique=True)
    public_key = models.BinaryField()
    sign_count = models.PositiveBigIntegerField(default=0)
    name = models.CharField(max_length=120, default="Passkey")
    transports = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class StaffSession(models.Model):
    class AuthMethod(models.TextChoices):
        PASSWORD = "password", "Password"
        PASSKEY = "passkey", "Passkey"
        RECOVERY = "recovery", "Recovery"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="staff_sessions")
    membership = models.ForeignKey(StaffMembership, on_delete=models.CASCADE, related_name="staff_sessions", null=True, blank=True)
    trusted_device = models.ForeignKey(TrustedDevice, on_delete=models.CASCADE, related_name="staff_sessions", null=True, blank=True)
    workspace_role = models.CharField(max_length=16, choices=StaffUser.Role.choices, blank=True, default="")
    auth_method = models.CharField(max_length=16, choices=AuthMethod.choices, default=AuthMethod.PASSWORD)
    reauthenticated_at = models.DateTimeField(null=True, blank=True, default=None)
    reauth_passkey = models.ForeignKey(PasskeyCredential, on_delete=models.SET_NULL, related_name="reauthenticated_sessions", null=True, blank=True)
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()


class VerificationChallenge(models.Model):
    class Purpose(models.TextChoices):
        EMAIL_VERIFY = "email_verify", "Email verification"
        PHONE_VERIFY = "phone_verify", "Phone verification"
        EMAIL_CHANGE = "email_change", "Email change"
        PHONE_CHANGE = "phone_change", "Phone change"
        PASSWORD_CHANGE = "password_change", "Password change"
        PASSWORD_RECOVERY = "password_recovery", "Password recovery"
        DEVICE_AUTHORIZE = "device_authorize", "Device authorization"

    class Channel(models.TextChoices):
        EMAIL = "email", "Email"
        SMS = "sms", "SMS"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="verification_challenges")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="verification_challenges", null=True, blank=True)
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    channel = models.CharField(max_length=8, choices=Channel.choices)
    destination = models.CharField(max_length=254)
    pending_value = models.CharField(max_length=254, blank=True, default="")
    code_hash = models.CharField(max_length=64)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "purpose", "created_at"], name="verify_user_purpose_idx")]

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()


class RecoveryGrant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="recovery_grants")
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class RecoveryCode(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="recovery_codes")
    batch_id = models.UUIDField(default=uuid.uuid4, editable=False, db_index=True)
    code_hash = models.CharField(max_length=128)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["created_at"]


class PasskeyChallenge(models.Model):
    class Purpose(models.TextChoices):
        REGISTER = "register", "Register"
        AUTHENTICATE = "authenticate", "Authenticate"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="passkey_challenges")
    purpose = models.CharField(max_length=16, choices=Purpose.choices)
    challenge = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]


class AssistantSetupToken(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="assistant_setup_tokens")
    created_by = models.ForeignKey(StaffUser, on_delete=models.CASCADE, related_name="created_assistant_setup_tokens")
    code_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
