from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Clinic, StaffSession, StaffUser


@admin.register(Clinic)
class ClinicAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "created_at")
    search_fields = ("name", "email", "phone")
    readonly_fields = ("password_hash", "created_at", "updated_at")


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
    list_display = ("user", "created_at", "expires_at", "last_used_at")
    readonly_fields = ("token_hash", "created_at", "last_used_at")
    search_fields = ("user__username", "user__email")
