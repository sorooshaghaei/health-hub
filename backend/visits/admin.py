from django.contrib import admin

from .models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "scheduled_time",
        "status",
        "checked_in_at",
        "patient_full_name_snapshot",
        "clinic",
        "deleted_at",
    )
    list_filter = ("status", "date", "deleted_at")
    search_fields = (
        "patient_full_name_snapshot",
        "patient_phone_snapshot",
        "reason",
    )

    def get_queryset(self, request):
        return Visit.all_objects.select_related("clinic", "patient")
