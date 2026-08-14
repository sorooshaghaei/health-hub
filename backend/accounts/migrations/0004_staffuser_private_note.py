from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_staffuser_task_attention_seen_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffuser",
            name="private_note",
            field=models.TextField(blank=True, default=""),
        ),
    ]
