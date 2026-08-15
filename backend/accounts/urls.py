from django.urls import path

from .views import (
    ClinicContextView,
    ClinicCreateView,
    DevicePairingApproveView,
    DevicePairingStartView,
    DevicePairingStatusView,
    HealthView,
    StaffLoginView,
    StaffLogoutView,
    StaffMeView,
    StaffPrivateNoteView,
    StaffRegisterView,
    TrustedDeviceDeleteView,
    TrustedDeviceListView,
)

urlpatterns = [
    path("health/", HealthView.as_view(), name="health"),
    path("clinics/", ClinicCreateView.as_view(), name="clinic-create"),
    path("clinic/context/", ClinicContextView.as_view(), name="clinic-context"),
    path("devices/", TrustedDeviceListView.as_view(), name="trusted-device-list"),
    path(
        "devices/<uuid:device_id>/",
        TrustedDeviceDeleteView.as_view(),
        name="trusted-device-delete",
    ),
    path(
        "devices/pairing/",
        DevicePairingStartView.as_view(),
        name="device-pairing-start",
    ),
    path(
        "devices/pairing/status/",
        DevicePairingStatusView.as_view(),
        name="device-pairing-status",
    ),
    path(
        "devices/pairing/approve/",
        DevicePairingApproveView.as_view(),
        name="device-pairing-approve",
    ),
    path("staff/register/", StaffRegisterView.as_view(), name="staff-register"),
    path("staff/login/", StaffLoginView.as_view(), name="staff-login"),
    path("staff/me/", StaffMeView.as_view(), name="staff-me"),
    path(
        "staff/private-note/",
        StaffPrivateNoteView.as_view(),
        name="staff-private-note",
    ),
    path("staff/logout/", StaffLogoutView.as_view(), name="staff-logout"),
]
