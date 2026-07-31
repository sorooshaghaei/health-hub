from django.db import migrations, models


def copy_account_role_to_workspace(apps, schema_editor):
    StaffSession = apps.get_model("accounts", "StaffSession")
    for session in StaffSession.objects.select_related("user").iterator():
        session.workspace_role = session.user.role
        session.save(update_fields=["workspace_role"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffsession",
            name="workspace_role",
            field=models.CharField(
                blank=True,
                choices=[("doctor", "Doctor"), ("assistant", "Assistant")],
                default="",
                max_length=16,
            ),
            preserve_default=False,
        ),
        migrations.RunPython(
            copy_account_role_to_workspace,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="staffsession",
            name="workspace_role",
            field=models.CharField(
                choices=[("doctor", "Doctor"), ("assistant", "Assistant")],
                max_length=16,
            ),
        ),
    ]
