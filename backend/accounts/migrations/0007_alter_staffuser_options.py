from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_phase8_global_accounts"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="staffuser",
            options={
                "verbose_name": "user",
                "verbose_name_plural": "users",
            },
        ),
    ]
