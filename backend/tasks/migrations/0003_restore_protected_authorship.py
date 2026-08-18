from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0002_phase8_account_cascade"),
    ]

    operations = [
        migrations.AlterField(
            model_name="sharedtask",
            name="created_by",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="created_shared_tasks",
                to="accounts.staffuser",
            ),
        ),
        migrations.AlterField(
            model_name="taskcomment",
            name="author",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="shared_task_comments",
                to="accounts.staffuser",
            ),
        ),
    ]