from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_final_phase8_identity"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClinicWorkingHour",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "weekday",
                    models.PositiveSmallIntegerField(
                        choices=[
                            (0, "Monday"),
                            (1, "Tuesday"),
                            (2, "Wednesday"),
                            (3, "Thursday"),
                            (4, "Friday"),
                            (5, "Saturday"),
                            (6, "Sunday"),
                        ]
                    ),
                ),
                ("start_time", models.TimeField()),
                ("end_time", models.TimeField()),
                (
                    "clinic",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="working_hours",
                        to="accounts.clinic",
                    ),
                ),
            ],
            options={
                "ordering": ["weekday"],
                "constraints": [
                    models.UniqueConstraint(
                        fields=("clinic", "weekday"),
                        name="one_working_range_per_clinic_weekday",
                    ),
                    models.CheckConstraint(
                        condition=models.Q(("start_time__lt", models.F("end_time"))),
                        name="clinic_working_start_before_end",
                    ),
                ],
            },
        ),
    ]
