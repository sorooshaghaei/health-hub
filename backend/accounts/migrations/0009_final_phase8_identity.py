from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone


def migrate_identity(apps, schema_editor):
    StaffUser = apps.get_model("accounts", "StaffUser")
    StaffMembership = apps.get_model("accounts", "StaffMembership")
    Clinic = apps.get_model("accounts", "Clinic")
    TrustedDevice = apps.get_model("accounts", "TrustedDevice")
    StaffSession = apps.get_model("accounts", "StaffSession")
    DevicePairingRequest = apps.get_model("accounts", "DevicePairingRequest")

    # The final model has one immutable role per person. Existing installations
    # should not normally contain mixed-role memberships; if they do, Doctor
    # wins because Doctor ownership cannot safely be downgraded. Conflicting
    # Assistant memberships are made inactive rather than silently changing
    # their clinic meaning.
    for user in StaffUser.objects.all():
        memberships = list(
            StaffMembership.objects.filter(user_id=user.id).order_by("joined_at", "id")
        )
        active_roles = {item.role for item in memberships if item.is_active}
        historical_roles = {item.role for item in memberships}
        if "doctor" in active_roles or (not active_roles and "doctor" in historical_roles):
            role = "doctor"
        else:
            role = "assistant"
        user.role = role
        if role == "assistant" and not any(item.is_active and item.role == role for item in memberships):
            user.dormant_since = timezone.now()
        else:
            user.dormant_since = None
        user.save(update_fields=["role", "dormant_since"])
        for membership in memberships:
            if membership.is_active and membership.role != role:
                membership.is_active = False
                membership.save(update_fields=["is_active"])

    for clinic in Clinic.objects.all():
        doctor_membership = (
            StaffMembership.objects.filter(
                clinic_id=clinic.id,
                is_active=True,
                role="doctor",
            )
            .select_related("user")
            .order_by("joined_at", "id")
            .first()
        )
        if doctor_membership is not None:
            clinic.owner_doctor_id = doctor_membership.user_id
            clinic.save(update_fields=["owner_doctor"])

    # Old trusted devices were clinic-scoped. Bind each device to the person
    # whose session most recently used it. A session-less first device falls
    # back to the clinic owner. Orphaned devices remain unusable and nullable
    # rather than being assigned to the wrong person.
    for device in TrustedDevice.objects.all():
        session = (
            StaffSession.objects.filter(trusted_device_id=device.id)
            .order_by("-created_at", "-id")
            .first()
        )
        user_id = session.user_id if session is not None else None
        if user_id is None:
            clinic = Clinic.objects.filter(id=device.clinic_id).first()
            user_id = clinic.owner_doctor_id if clinic is not None else None
        device.user_id = user_id
        device.save(update_fields=["user"])

    for session in StaffSession.objects.select_related("trusted_device").all():
        if session.trusted_device_id and session.trusted_device.user_id != session.user_id:
            session.membership_id = None
            session.trusted_device_id = None
            session.workspace_role = ""
            session.save(update_fields=["membership", "trusted_device", "workspace_role"])

    # Pairing requests are short-lived and cannot be mapped safely from a
    # clinic identity to one personal account. The final visible flow uses
    # verified email/SMS for new-device authorization.
    DevicePairingRequest.objects.all().delete()


def reverse_identity(apps, schema_editor):
    StaffMembership = apps.get_model("accounts", "StaffMembership")
    Clinic = apps.get_model("accounts", "Clinic")
    TrustedDevice = apps.get_model("accounts", "TrustedDevice")
    StaffUser = apps.get_model("accounts", "StaffUser")

    for membership in StaffMembership.objects.select_related("user").all():
        membership.role = membership.user.role
        membership.save(update_fields=["role"])
    for device in TrustedDevice.objects.select_related("user").all():
        membership = (
            StaffMembership.objects.filter(user_id=device.user_id, is_active=True)
            .order_by("joined_at", "id")
            .first()
        )
        if membership is not None:
            device.clinic_id = membership.clinic_id
            device.save(update_fields=["clinic"])
    for clinic in Clinic.objects.all():
        if clinic.owner_doctor_id:
            StaffMembership.objects.get_or_create(
                user_id=clinic.owner_doctor_id,
                clinic_id=clinic.id,
                defaults={"role": "doctor", "is_active": True},
            )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0008_clinic_timezone"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffuser",
            name="role",
            field=models.CharField(
                choices=[("doctor", "Doctor"), ("assistant", "Assistant")],
                default="assistant",
                max_length=16,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="staffuser",
            name="dormant_since",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="staffuser",
            name="anonymized_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="clinic",
            name="owner_doctor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="owned_clinics",
                to="accounts.staffuser",
            ),
        ),
        migrations.AddField(
            model_name="trusteddevice",
            name="user",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="trusted_devices",
                to="accounts.staffuser",
            ),
        ),
        migrations.AddField(
            model_name="devicepairingrequest",
            name="user",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="device_pairing_requests",
                to="accounts.staffuser",
            ),
        ),
        migrations.AlterField(
            model_name="staffsession",
            name="reauthenticated_at",
            field=models.DateTimeField(blank=True, default=None, null=True),
        ),
        migrations.RunPython(migrate_identity, reverse_identity),
        migrations.RemoveConstraint(
            model_name="staffmembership",
            name="one_active_staff_role_per_clinic",
        ),
        migrations.RemoveField(
            model_name="staffmembership",
            name="role",
        ),
        migrations.RemoveField(
            model_name="trusteddevice",
            name="clinic",
        ),
        migrations.RemoveField(
            model_name="devicepairingrequest",
            name="clinic",
        ),
        migrations.AlterField(
            model_name="devicepairingrequest",
            name="user",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="device_pairing_requests",
                to="accounts.staffuser",
            ),
        ),
        migrations.AlterField(
            model_name="assistantsetuptoken",
            name="created_by",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="created_assistant_setup_tokens",
                to="accounts.staffuser",
            ),
        ),
        migrations.AlterModelOptions(
            name="staffmembership",
            options={"ordering": ["clinic__name", "joined_at"]},
        ),
    ]
