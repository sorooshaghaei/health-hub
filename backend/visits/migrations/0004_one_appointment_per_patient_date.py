from django.db import migrations, models
from django.db.models import Count, Q


def reject_existing_active_duplicates(apps, schema_editor):
    Visit = apps.get_model("visits", "Visit")
    duplicates = list(
        Visit.objects.filter(deleted_at__isnull=True)
        .values("clinic_id", "patient_id", "date")
        .annotate(appointment_count=Count("id"))
        .filter(appointment_count__gt=1)
        .order_by("clinic_id", "patient_id", "date")[:10]
    )
    if not duplicates:
        return

    examples = "; ".join(
        (
            f"clinic={item['clinic_id']}, patient={item['patient_id']}, "
            f"date={item['date']}, count={item['appointment_count']}"
        )
        for item in duplicates
    )
    raise RuntimeError(
        "Cannot enforce one Appointment per Patient per date because active "
        "duplicates already exist. Resolve them manually without silently deleting "
        f"or merging records, then rerun the migration. Examples: {examples}"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("visits", "0003_consultation_room"),
    ]

    operations = [
        migrations.RunPython(
            reject_existing_active_duplicates,
            migrations.RunPython.noop,
        ),
        migrations.AddConstraint(
            model_name="visit",
            constraint=models.UniqueConstraint(
                fields=("clinic", "patient", "date"),
                condition=Q(deleted_at__isnull=True),
                name="visit_patient_date_unique",
            ),
        ),
    ]
