import attachments.models
import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("patients", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PatientAttachment",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "file",
                    models.FileField(
                        max_length=500,
                        upload_to=attachments.models.attachment_upload_path,
                    ),
                ),
                ("document_name", models.CharField(max_length=255)),
                (
                    "normalized_document_name",
                    models.CharField(editable=False, max_length=1024),
                ),
                ("original_filename", models.CharField(max_length=255)),
                ("content_type", models.CharField(max_length=100)),
                ("size", models.PositiveBigIntegerField()),
                ("source_sha256", models.CharField(max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "deleted_at",
                    models.DateTimeField(
                        blank=True,
                        db_index=True,
                        editable=False,
                        null=True,
                    ),
                ),
                (
                    "patient",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attachments",
                        to="patients.patient",
                    ),
                ),
                (
                    "uploader",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="uploaded_patient_attachments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
                "indexes": [
                    models.Index(
                        fields=["patient", "created_at"],
                        name="attach_patient_created_idx",
                    ),
                    models.Index(
                        fields=["deleted_at"],
                        name="attach_deleted_at_idx",
                    ),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("patient", "normalized_document_name"),
                        name="one_attachment_name_per_patient",
                    ),
                    models.UniqueConstraint(
                        fields=("patient", "source_sha256"),
                        name="one_attachment_content_per_patient",
                    ),
                ],
            },
        ),
    ]
