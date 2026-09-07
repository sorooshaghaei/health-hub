from django.contrib import admin

from .models import PatientAttachment


@admin.register(PatientAttachment)
class PatientAttachmentAdmin(admin.ModelAdmin):
    list_display = (
        "document_name",
        "patient",
        "uploader",
        "content_type",
        "size",
        "created_at",
        "deleted_at",
    )
    list_filter = ("content_type", "deleted_at", "patient__clinic")
    search_fields = (
        "document_name",
        "original_filename",
        "patient__full_name",
    )
    fields = (
        "id",
        "patient",
        "uploader",
        "document_name",
        "original_filename",
        "content_type",
        "size",
        "source_sha256",
        "created_at",
        "updated_at",
        "deleted_at",
    )
    readonly_fields = fields

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
