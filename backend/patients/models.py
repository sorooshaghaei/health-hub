import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

from accounts.models import Clinic
from .normalization import normalize_name
from .phone import normalize_phone

PATIENT_DELETE_UNDO_SECONDS = 5


class ActivePatientManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Patient(models.Model):
    class Gender(models.TextChoices):
        MAN = "Man", "Man"
        WOMAN = "Woman", "Woman"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="patients")
    full_name = models.CharField(max_length=200)
    normalized_name = models.CharField(max_length=200, editable=False, db_index=True)
    gender = models.CharField(max_length=5, choices=Gender.choices)
    country_calling_code = models.CharField(max_length=5, default="+98")
    phone_number = models.CharField(max_length=14)
    phone_e164 = models.CharField(max_length=16, db_index=True)
    date_of_birth = models.DateField(null=True, blank=True)
    patient_note = models.TextField(blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)

    objects = ActivePatientManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["normalized_name", "id"]
        indexes = [
            models.Index(fields=["clinic", "normalized_name"], name="patient_clinic_name_idx"),
            models.Index(fields=["clinic", "phone_e164"], name="patient_clinic_phone_idx"),
        ]

    def __str__(self):
        return self.full_name

    def save(self, *args, **kwargs):
        self.full_name = " ".join(self.full_name.split())
        self.normalized_name = normalize_name(self.full_name)
        (
            self.country_calling_code,
            self.phone_number,
            self.phone_e164,
        ) = normalize_phone(self.country_calling_code, self.phone_number)
        super().save(*args, **kwargs)

    @property
    def delete_undo_until(self):
        if self.deleted_at is None:
            return None
        return self.deleted_at + timedelta(seconds=PATIENT_DELETE_UNDO_SECONDS)

    def soft_delete(self):
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at"])

    def restore(self):
        if self.deleted_at is not None:
            self.deleted_at = None
            self.save(update_fields=["deleted_at"])
