from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone


def populate_legacy_scheduled_times(apps, schema_editor):
    Visit = apps.get_model("visits", "Visit")
    for visit in Visit.objects.filter(scheduled_time__isnull=True).iterator():
        created_at = visit.created_at
        if timezone.is_aware(created_at):
            created_at = timezone.localtime(created_at)
        visit.scheduled_time = created_at.time().replace(microsecond=0, tzinfo=None)
        visit.save(update_fields=["scheduled_time"])


class Migration(migrations.Migration):
    dependencies = [
        ("visits", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="visit",
            name="checked_in_at",
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="visit",
            name="deleted_at",
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                editable=False,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="visit",
            name="queue_sequence",
            field=models.PositiveBigIntegerField(blank=True, editable=False, null=True),
        ),
        migrations.AddField(
            model_name="visit",
            name="status",
            field=models.CharField(
                choices=[("planned", "Planned"), ("checked_in", "Checked in")],
                default="planned",
                max_length=16,
            ),
        ),
        migrations.RunPython(
            populate_legacy_scheduled_times,
            migrations.RunPython.noop,
        ),
        migrations.RemoveField(
            model_name="visit",
            name="visit_type",
        ),
        migrations.AlterField(
            model_name="visit",
            name="scheduled_time",
            field=models.TimeField(),
        ),
        migrations.AddIndex(
            model_name="visit",
            index=models.Index(
                fields=["clinic", "date", "status", "queue_sequence"],
                name="visit_live_queue_idx",
            ),
        ),
        migrations.AddConstraint(
            model_name="visit",
            constraint=models.CheckConstraint(
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
        ),
        migrations.AddConstraint(
            model_name="visit",
            constraint=models.UniqueConstraint(
                fields=("clinic", "date", "queue_sequence"),
                condition=Q(queue_sequence__isnull=False, deleted_at__isnull=True),
                name="visit_active_queue_sequence_unique",
            ),
        ),
    ]
