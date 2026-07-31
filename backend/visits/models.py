import uuid
from datetime import timedelta

from django.db import models
from django.db.models import Q
from django.utils import timezone

from accounts.models import Clinic
from patients.models import Patient

UNDO_WINDOW_SECONDS = 5


class ActiveVisitManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Visit(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Planned"
        CHECKED_IN = "checked_in", "Checked in"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="visits")
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name="visits",
    )
    date = models.DateField(db_index=True)
    scheduled_time = models.TimeField()
    reason = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PLANNED,
    )
    checked_in_at = models.DateTimeField(null=True, blank=True, editable=False)
    queue_sequence = models.PositiveBigIntegerField(null=True, blank=True, editable=False)
    deleted_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)

    patient_full_name_snapshot = models.CharField(max_length=200, editable=False)
    patient_gender_snapshot = models.CharField(max_length=5, editable=False)
    patient_phone_snapshot = models.CharField(max_length=16, editable=False)
    patient_date_of_birth_snapshot = models.DateField(null=True, blank=True, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveVisitManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["date", "scheduled_time", "created_at"]
        indexes = [
            models.Index(fields=["clinic", "date"], name="visit_clinic_date_idx"),
            models.Index(fields=["clinic", "patient", "date"], name="visit_patient_date_idx"),
            models.Index(
                fields=["clinic", "date", "status", "queue_sequence"],
                name="visit_live_queue_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(
                        status="planned",
                        checked_in_at__isnull=True,
                        queue_sequence__isnull=True,
                    )
                    | Q(
                        status="checked_in",
                        checked_in_at__isnull=False,
                        queue_sequence__isnull=False,
                    )
                ),
                name="visit_status_queue_consistent",
            ),
            models.UniqueConstraint(
                fields=["clinic", "date", "queue_sequence"],
                condition=Q(queue_sequence__isnull=False, deleted_at__isnull=True),
                name="visit_active_queue_sequence_unique",
            ),
        ]

    def __str__(self):
        return f"Appointment — {self.patient_full_name_snapshot}"

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
        return self.scheduled_time > now.time().replace(tzinfo=None)

    @property
    def can_delete(self):
        return self.date >= timezone.localdate()

    @property
    def can_check_in(self):
        return self.date == timezone.localdate() and self.status == self.Status.PLANNED

    @property
    def check_in_undo_until(self):
        if self.status != self.Status.CHECKED_IN or self.checked_in_at is None:
            return None
        return self.checked_in_at + timedelta(seconds=UNDO_WINDOW_SECONDS)

    @property
    def delete_undo_until(self):
        if self.deleted_at is None:
            return None
        return self.deleted_at + timedelta(seconds=UNDO_WINDOW_SECONDS)

    def soft_delete(self):
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        if self.deleted_at is not None:
            self.deleted_at = None
            self.save(update_fields=["deleted_at", "updated_at"])
