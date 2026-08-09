from django.db import migrations, models
import django.db.models.deletion
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("visits", "0002_check_in_queue"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="visit",
            name="visit_status_queue_consistent",
        ),
        migrations.AddField(
            model_name="visit",
            name="doctor_finished_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="visit",
            name="with_doctor_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AlterField(
            model_name="visit",
            name="status",
            field=models.CharField(
                choices=[
                    ("planned", "Planned"),
                    ("checked_in", "Checked in"),
                    ("with_doctor", "With doctor"),
                    ("doctor_finished", "Doctor finished"),
                ],
                default="planned",
                max_length=16,
            ),
        ),
        migrations.CreateModel(
            name="RoomCall",
            fields=[
                (
                    "clinic",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        primary_key=True,
                        related_name="room_call",
                        serialize=False,
                        to="accounts.clinic",
                    ),
                ),
                ("date", models.DateField(db_index=True)),
                ("requested_at", models.DateTimeField()),
                ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "previous_visit",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="visits.visit",
                    ),
                ),
                (
                    "selected_visit",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="visits.visit",
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="visit",
            constraint=models.CheckConstraint(
                condition=(
                    Q(
                        status="planned",
                        checked_in_at__isnull=True,
                        queue_sequence__isnull=True,
                        with_doctor_at__isnull=True,
                        doctor_finished_at__isnull=True,
                    )
                    | Q(
                        status="checked_in",
                        checked_in_at__isnull=False,
                        queue_sequence__isnull=False,
                        with_doctor_at__isnull=True,
                        doctor_finished_at__isnull=True,
                    )
                    | Q(
                        status="with_doctor",
                        checked_in_at__isnull=False,
                        queue_sequence__isnull=False,
                        with_doctor_at__isnull=False,
                        doctor_finished_at__isnull=True,
                    )
                    | Q(
                        status="doctor_finished",
                        checked_in_at__isnull=False,
                        queue_sequence__isnull=False,
                        with_doctor_at__isnull=False,
                        doctor_finished_at__isnull=False,
                    )
                ),
                name="visit_status_queue_consistent",
            ),
        ),
        migrations.AddConstraint(
            model_name="roomcall",
            constraint=models.CheckConstraint(
                condition=(
                    Q(selected_visit__isnull=True, consumed_at__isnull=True)
                    | Q(selected_visit__isnull=False, consumed_at__isnull=False)
                ),
                name="room_call_consumption_consistent",
            ),
        ),
    ]
