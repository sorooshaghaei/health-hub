import uuid

import django.db.models.deletion
from django.db import migrations, models


def clear_pre_release_auth_data(apps, schema_editor):
    StaffSession = apps.get_model("accounts", "StaffSession")
    Clinic = apps.get_model("accounts", "Clinic")
    StaffSession.objects.all().delete()
    Clinic.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0004_staffuser_private_note"),
    ]

    operations = [
        migrations.RunPython(clear_pre_release_auth_data, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="clinic",
            name="password_hash",
        ),
        migrations.CreateModel(
            name="TrustedDevice",
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
                ("token_hash", models.CharField(max_length=64, unique=True)),
                ("browser", models.CharField(max_length=80)),
                ("operating_system", models.CharField(max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "clinic",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="trusted_devices",
                        to="accounts.clinic",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="DevicePairingRequest",
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
                ("request_token_hash", models.CharField(max_length=64, unique=True)),
                ("code_hash", models.CharField(max_length=64, unique=True)),
                ("browser", models.CharField(max_length=80)),
                ("operating_system", models.CharField(max_length=80)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                (
                    "clinic",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="device_pairing_requests",
                        to="accounts.clinic",
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(
            model_name="staffsession",
            name="trusted_device",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="staff_sessions",
                to="accounts.trusteddevice",
            ),
        ),
    ]
