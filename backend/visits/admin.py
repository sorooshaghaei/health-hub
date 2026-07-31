from django.contrib import admin

from .models import Visit


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "scheduled_time",
        "visit_type",
        "patient_full_name_snapshot",
        "clinic",
    )
    list_filter = ("visit_type", "date")
    search_fields = (
        "patient_full_name_snapshot",
        "patient_phone_snapshot",
        "reason",
    )
