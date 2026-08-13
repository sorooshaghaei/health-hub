import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_staffsession_workspace_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffuser",
            name="task_attention_seen_at",
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
    ]
