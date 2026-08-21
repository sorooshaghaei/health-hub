from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AssistantSetupToken, Clinic, ClinicWorkingHour, DevicePairingRequest, PasskeyCredential, RecoveryCode, RecoveryGrant, StaffMembership, StaffSession, StaffUser, TrustedDevice, VerificationChallenge


@admin.register(Clinic)
class ClinicAdmin(admin.ModelAdmin):
    list_display = ("name", "owner_doctor", "created_at")
    search_fields = ("name", "owner_doctor__email")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ClinicWorkingHour)
class ClinicWorkingHourAdmin(admin.ModelAdmin):
    list_display = ("clinic", "weekday", "start_time", "end_time")
    list_filter = ("weekday",)
    search_fields = ("clinic__name",)


@admin.register(StaffUser)
class StaffUserAdmin(UserAdmin):
    ordering = ("email",)
    list_display = ("email", "role", "first_name", "last_name", "phone", "is_active", "dormant_since")
    list_filter = ("role", "is_active")
    search_fields = ("email", "phone", "first_name", "last_name")
    fieldsets = (
        (None, {"fields": ("email", "password", "role")}),
        ("Personal info", {"fields": ("first_name", "last_name", "phone", "email_verified_at", "phone_verified_at", "private_note", "dormant_since", "anonymized_at")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Important dates", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = (
        (None, {"classes": ("wide",), "fields": ("email", "role", "password1", "password2", "is_staff", "is_superuser")}),
    )


@admin.register(StaffMembership)
class StaffMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "clinic", "account_role", "is_active", "joined_at")
    list_filter = ("is_active", "user__role")
    search_fields = ("user__email", "clinic__name")

    @admin.display(description="Role", ordering="user__role")
    def account_role(self, obj):
        return obj.user.get_role_display()


@admin.register(TrustedDevice)
class TrustedDeviceAdmin(admin.ModelAdmin):
    list_display = ("user", "browser", "operating_system", "created_at", "last_used_at")
    readonly_fields = ("token_hash", "created_at", "last_used_at")
    search_fields = ("user__email", "user__phone", "browser", "operating_system")


@admin.register(DevicePairingRequest)
class DevicePairingRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "browser", "operating_system", "created_at", "expires_at", "approved_at")
    readonly_fields = ("request_token_hash", "code_hash", "created_at", "approved_at")
    search_fields = ("user__email", "user__phone")


@admin.register(StaffSession)
class StaffSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "membership", "trusted_device", "workspace_role", "auth_method", "created_at", "expires_at", "last_used_at")
    readonly_fields = ("token_hash", "created_at", "last_used_at")
    search_fields = ("user__email", "user__phone")


admin.site.register(PasskeyCredential)
admin.site.register(VerificationChallenge)
admin.site.register(RecoveryGrant)
admin.site.register(RecoveryCode)
admin.site.register(AssistantSetupToken)
