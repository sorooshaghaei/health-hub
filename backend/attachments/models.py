import uuid
from datetime import timedelta
from pathlib import PurePath

from django.conf import settings
from django.db import models
from django.utils import timezone

from patients.models import Patient

from .names import normalize_document_name


def attachment_upload_path(instance, _filename):
    extension = PurePath(instance.document_name).suffix.lower()
    return (
        f"patient_attachments/{instance.patient.clinic_id}/"
        f"{instance.patient_id}/{instance.id}{extension}"
    )


class ActivePatientAttachmentManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class PatientAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name="attachments",
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="uploaded_patient_attachments",
        null=True,
        blank=True,
    )
    file = models.FileField(upload_to=attachment_upload_path, max_length=500)
    document_name = models.CharField(max_length=255)
    normalized_document_name = models.CharField(max_length=1024, editable=False)
    original_filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100)
    size = models.PositiveBigIntegerField()
    source_sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True, editable=False, db_index=True)

    objects = ActivePatientAttachmentManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(
                fields=["patient", "created_at"],
                name="attach_patient_created_idx",
            ),
            models.Index(
                fields=["deleted_at"],
                name="attach_deleted_at_idx",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["patient", "normalized_document_name"],
                name="one_attachment_name_per_patient",
            ),
            models.UniqueConstraint(
                fields=["patient", "source_sha256"],
                name="one_attachment_content_per_patient",
            ),
        ]

    def __str__(self):
        return f"{self.patient.full_name} · {self.document_name}"

    def save(self, *args, **kwargs):
        self.normalized_document_name = normalize_document_name(self.document_name)
        super().save(*args, **kwargs)

    @property
    def delete_undo_until(self):
        if self.deleted_at is None:
            return None
        return self.deleted_at + timedelta(
            seconds=settings.PATIENT_ATTACHMENT_DELETE_UNDO_SECONDS
        )

    def soft_delete(self):
        if self.deleted_at is None:
            self.deleted_at = timezone.now()
            self.save(update_fields=["deleted_at", "updated_at"])

    def restore(self):
        if self.deleted_at is not None:
            self.deleted_at = None
            self.save(update_fields=["deleted_at", "updated_at"])
