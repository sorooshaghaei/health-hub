from django.db import migrations, models
from django.utils import timezone


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0010_clinic_working_hours"),
    ]

    operations = [
        migrations.AddField(
            model_name="trusteddevice",
            name="last_used_at",
            field=models.DateTimeField(default=timezone.now),
        ),
        migrations.AlterModelOptions(
            name="trusteddevice",
            options={"ordering": ["-last_used_at", "-created_at"]},
        ),
    ]
