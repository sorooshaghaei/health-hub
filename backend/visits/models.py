import uuid

from django.db import models
from django.utils import timezone

from accounts.models import Clinic
from patients.models import Patient


class Visit(models.Model):
    class Type(models.TextChoices):
        APPOINTMENT = "appointment", "Appointment"
        WALK_IN = "walk_in", "Walk-in"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="visits")
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name="visits",
    )
    visit_type = models.CharField(max_length=16, choices=Type.choices)
    date = models.DateField(db_index=True)
    scheduled_time = models.TimeField(null=True, blank=True)
    reason = models.TextField(blank=True)

    patient_full_name_snapshot = models.CharField(max_length=200, editable=False)
    patient_gender_snapshot = models.CharField(max_length=5, editable=False)
    patient_phone_snapshot = models.CharField(max_length=16, editable=False)
    patient_date_of_birth_snapshot = models.DateField(null=True, blank=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["date", "scheduled_time", "created_at"]
        indexes = [
            models.Index(fields=["clinic", "date"], name="visit_clinic_date_idx"),
            models.Index(fields=["clinic", "patient", "date"], name="visit_patient_date_idx"),
        ]

    def __str__(self):
        return f"{self.get_visit_type_display()} — {self.patient_full_name_snapshot}"

    def capture_patient_snapshot(self):
        self.patient_full_name_snapshot = self.patient.full_name
        self.patient_gender_snapshot = self.patient.gender
        self.patient_phone_snapshot = self.patient.phone_e164
        self.patient_date_of_birth_snapshot = self.patient.date_of_birth

    def save(self, *args, **kwargs):
        if self._state.adding and self.patient_id:
            self.capture_patient_snapshot()
        self.reason = self.reason.strip()
        super().save(*args, **kwargs)

    @property
    def is_future(self):
        now = timezone.localtime()
        if self.date > now.date():
            return True
        if self.date < now.date():
            return False
        if self.visit_type != self.Type.APPOINTMENT or self.scheduled_time is None:
            return False
        return self.scheduled_time > now.time().replace(tzinfo=None)

    @property
    def can_delete(self):
        return self.is_future
