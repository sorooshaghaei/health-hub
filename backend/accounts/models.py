import uuid

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Clinic(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=40)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class TrustedDevice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name="trusted_devices",
    )
    token_hash = models.CharField(max_length=64, unique=True)
    browser = models.CharField(max_length=80)
    operating_system = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.browser} on {self.operating_system}"


class DevicePairingRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(
        Clinic,
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
    email = models.EmailField("email address", unique=True)

    class Role(models.TextChoices):
        DOCTOR = "doctor", "Doctor"
        ASSISTANT = "assistant", "Assistant"

    clinic = models.ForeignKey(
        Clinic,
        on_delete=models.CASCADE,
        related_name="staff_members",
        null=True,
        blank=True,
    )
    role = models.CharField(max_length=16, choices=Role.choices, blank=True)
    task_attention_seen_at = models.DateTimeField(default=timezone.now)
    private_note = models.TextField(blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["clinic", "role"],
                condition=Q(clinic__isnull=False),
                name="one_staff_member_per_role_per_clinic",
            )
        ]

    @property
    def is_clinic_admin(self):
        return self.role == self.Role.DOCTOR and self.clinic_id is not None


class StaffSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        StaffUser,
        on_delete=models.CASCADE,
        related_name="staff_sessions",
    )
    trusted_device = models.ForeignKey(
        TrustedDevice,
        on_delete=models.CASCADE,
        related_name="staff_sessions",
    )
    workspace_role = models.CharField(
        max_length=16,
        choices=StaffUser.Role.choices,
    )
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_expired(self):
        return self.expires_at <= timezone.now()
