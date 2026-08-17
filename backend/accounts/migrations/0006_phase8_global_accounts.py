import uuid

import accounts.models
import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q
import django.utils.timezone


def create_memberships(apps, schema_editor):
    StaffUser = apps.get_model("accounts", "StaffUser")
    StaffMembership = apps.get_model("accounts", "StaffMembership")
    StaffSession = apps.get_model("accounts", "StaffSession")
    now = django.utils.timezone.now()
    for user in StaffUser.objects.exclude(clinic_id__isnull=True).iterator():
        if not user.role:
            continue
        membership, _ = StaffMembership.objects.get_or_create(
            user_id=user.id,
            clinic_id=user.clinic_id,
            defaults={
                "role": user.role,
                "is_active": True,
                "task_attention_seen_at": user.task_attention_seen_at or now,
            },
        )
        StaffSession.objects.filter(user_id=user.id, membership_id__isnull=True).update(
            membership_id=membership.id
        )


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_trusted_device_auth")]

    operations = [
        migrations.RemoveConstraint(model_name="staffuser", name="one_staff_member_per_role_per_clinic"),
        migrations.RemoveField(model_name="clinic", name="email"),
        migrations.RemoveField(model_name="clinic", name="phone"),
        migrations.AddField(model_name="staffuser", name="phone", field=models.CharField(blank=True, max_length=32, null=True, unique=True)),
        migrations.AddField(model_name="staffuser", name="email_verified_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="staffuser", name="phone_verified_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.CreateModel(
            name="StaffMembership",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("role", models.CharField(choices=[("doctor", "Doctor"), ("assistant", "Assistant")], max_length=16)),
                ("is_active", models.BooleanField(default=True)),
                ("task_attention_seen_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("joined_at", models.DateTimeField(auto_now_add=True)),
                ("clinic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff_memberships", to="accounts.clinic")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="memberships", to="accounts.staffuser")),
            ],
            options={"ordering": ["clinic__name", "role"]},
        ),
        migrations.AddConstraint(model_name="staffmembership", constraint=models.UniqueConstraint(fields=("clinic", "role"), condition=Q(("is_active", True)), name="one_active_staff_role_per_clinic")),
        migrations.AddConstraint(model_name="staffmembership", constraint=models.UniqueConstraint(fields=("user", "clinic"), name="one_membership_per_user_clinic")),
        migrations.AddField(model_name="staffsession", name="membership", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="staff_sessions", to="accounts.staffmembership")),
        migrations.AlterField(model_name="staffsession", name="trusted_device", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="staff_sessions", to="accounts.trusteddevice")),
        migrations.AlterField(model_name="staffsession", name="workspace_role", field=models.CharField(blank=True, choices=[("doctor", "Doctor"), ("assistant", "Assistant")], default="", max_length=16)),
        migrations.AddField(model_name="staffsession", name="auth_method", field=models.CharField(choices=[("password", "Password"), ("passkey", "Passkey"), ("recovery", "Recovery")], default="password", max_length=16)),
        migrations.AddField(model_name="staffsession", name="reauthenticated_at", field=models.DateTimeField(default=django.utils.timezone.now)),
        migrations.RunPython(create_memberships, migrations.RunPython.noop),
        migrations.RemoveField(model_name="staffuser", name="clinic"),
        migrations.RemoveField(model_name="staffuser", name="role"),
        migrations.RemoveField(model_name="staffuser", name="task_attention_seen_at"),
        migrations.RemoveField(model_name="staffuser", name="username"),
        migrations.AlterModelManagers(name="staffuser", managers=[("objects", accounts.models.StaffUserManager())]),
        migrations.CreateModel(
            name="PasskeyCredential",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("credential_id", models.TextField(unique=True)), ("public_key", models.BinaryField()),
                ("sign_count", models.PositiveBigIntegerField(default=0)), ("name", models.CharField(default="Passkey", max_length=120)),
                ("transports", models.JSONField(blank=True, default=list)), ("created_at", models.DateTimeField(auto_now_add=True)),
                ("last_used_at", models.DateTimeField(blank=True, null=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="passkeys", to="accounts.staffuser")),
            ], options={"ordering": ["-created_at"]},
        ),
        migrations.AddField(model_name="staffsession", name="reauth_passkey", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="reauthenticated_sessions", to="accounts.passkeycredential")),
        migrations.CreateModel(
            name="VerificationChallenge",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("purpose", models.CharField(choices=[("email_verify", "Email verification"), ("phone_verify", "Phone verification"), ("email_change", "Email change"), ("phone_change", "Phone change"), ("password_change", "Password change"), ("password_recovery", "Password recovery"), ("device_authorize", "Device authorization")], max_length=32)),
                ("channel", models.CharField(choices=[("email", "Email"), ("sms", "SMS")], max_length=8)),
                ("destination", models.CharField(max_length=254)), ("pending_value", models.CharField(blank=True, default="", max_length=254)),
                ("code_hash", models.CharField(max_length=64)), ("attempts", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)), ("expires_at", models.DateTimeField()), ("consumed_at", models.DateTimeField(blank=True, null=True)),
                ("clinic", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="verification_challenges", to="accounts.clinic")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="verification_challenges", to="accounts.staffuser")),
            ], options={"ordering": ["-created_at"], "indexes": [models.Index(fields=["user", "purpose", "created_at"], name="verify_user_purpose_idx")]},
        ),
        migrations.CreateModel(name="RecoveryGrant", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("token_hash", models.CharField(max_length=64, unique=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("expires_at", models.DateTimeField()), ("consumed_at", models.DateTimeField(blank=True, null=True)), ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recovery_grants", to="accounts.staffuser"))], options={"ordering": ["-created_at"]}),
        migrations.CreateModel(name="RecoveryCode", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("batch_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False)), ("code_hash", models.CharField(max_length=128)), ("created_at", models.DateTimeField(auto_now_add=True)), ("used_at", models.DateTimeField(blank=True, null=True)), ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="recovery_codes", to="accounts.staffuser"))], options={"ordering": ["created_at"]}),
        migrations.CreateModel(name="PasskeyChallenge", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("purpose", models.CharField(choices=[("register", "Register"), ("authenticate", "Authenticate")], max_length=16)), ("challenge", models.TextField()), ("created_at", models.DateTimeField(auto_now_add=True)), ("expires_at", models.DateTimeField()), ("consumed_at", models.DateTimeField(blank=True, null=True)), ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="passkey_challenges", to="accounts.staffuser"))], options={"ordering": ["-created_at"]}),
        migrations.CreateModel(name="AssistantSetupToken", fields=[("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)), ("code_hash", models.CharField(max_length=64, unique=True)), ("created_at", models.DateTimeField(auto_now_add=True)), ("expires_at", models.DateTimeField()), ("used_at", models.DateTimeField(blank=True, null=True)), ("clinic", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assistant_setup_tokens", to="accounts.clinic")), ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="created_assistant_setup_tokens", to="accounts.staffuser"))], options={"ordering": ["-created_at"]}),
    ]
