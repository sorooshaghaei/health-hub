from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Clinic, DevicePairingRequest, StaffSession, StaffUser, TrustedDevice


@admin.register(Clinic)
class ClinicAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "created_at")
    search_fields = ("name", "email", "phone")
    readonly_fields = ("created_at", "updated_at")


@admin.register(TrustedDevice)
class TrustedDeviceAdmin(admin.ModelAdmin):
    list_display = ("clinic", "browser", "operating_system", "created_at")
    readonly_fields = ("token_hash", "created_at")
    search_fields = ("clinic__name", "clinic__email", "browser", "operating_system")


@admin.register(DevicePairingRequest)
class DevicePairingRequestAdmin(admin.ModelAdmin):
    list_display = ("clinic", "browser", "operating_system", "created_at", "expires_at", "approved_at")
    readonly_fields = ("request_token_hash", "code_hash", "created_at", "approved_at")
    search_fields = ("clinic__name", "clinic__email", "browser", "operating_system")


@admin.register(StaffUser)
class StaffUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Health Hub", {"fields": ("clinic", "role")}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ("Health Hub", {"fields": ("clinic", "role", "email")}),
    )
    list_display = UserAdmin.list_display + ("clinic", "role")


@admin.register(StaffSession)
class StaffSessionAdmin(admin.ModelAdmin):
    list_display = ("user", "trusted_device", "created_at", "expires_at", "last_used_at")
    readonly_fields = ("token_hash", "created_at", "last_used_at")
    search_fields = ("user__username", "user__email")
