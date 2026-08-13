import uuid

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Clinic(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=160)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=40)
    password_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        return check_password(raw_password, self.password_hash)


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
