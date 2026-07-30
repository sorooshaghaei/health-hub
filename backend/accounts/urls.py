from django.urls import path

from .views import (
    ClinicContextView,
    ClinicCreateView,
    ClinicEnterView,
    HealthView,
    StaffLoginView,
    StaffLogoutView,
    StaffMeView,
    StaffRegisterView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("clinics/", ClinicCreateView.as_view(), name="clinic-create"),
    path("clinics/enter/", ClinicEnterView.as_view(), name="clinic-enter"),
    path("clinic/context/", ClinicContextView.as_view(), name="clinic-context"),
    path("staff/register/", StaffRegisterView.as_view(), name="staff-register"),
    path("staff/login/", StaffLoginView.as_view(), name="staff-login"),
    path("staff/me/", StaffMeView.as_view(), name="staff-me"),
    path("staff/logout/", StaffLogoutView.as_view(), name="staff-logout"),
]
