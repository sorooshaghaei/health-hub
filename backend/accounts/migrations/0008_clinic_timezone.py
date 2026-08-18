from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_alter_staffuser_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="clinic",
            name="timezone",
            field=models.CharField(default="UTC", max_length=64),
        ),
    ]
