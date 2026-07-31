from django.contrib import admin

from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "clinic",
        "gender",
        "phone_e164",
        "date_of_birth",
        "deleted_at",
    )
    list_filter = ("gender", "country_calling_code", "deleted_at")
    search_fields = ("full_name", "phone_e164")
