from django.urls import path

from .views import PatientDetailView, PatientListCreateView, PatientUndoDeleteView

urlpatterns = [
    path("patients/", PatientListCreateView.as_view(), name="patient-list-create"),
    path("patients/<uuid:patient_id>/", PatientDetailView.as_view(), name="patient-detail"),
    path(
        "patients/<uuid:patient_id>/undo-delete/",
        PatientUndoDeleteView.as_view(),
        name="patient-undo-delete",
    ),
]
