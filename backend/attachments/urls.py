from django.urls import path

from .views import (
    PatientAttachmentCollectionView,
    PatientAttachmentDetailView,
    PatientAttachmentDownloadView,
    PatientAttachmentPreviewView,
    PatientAttachmentUndoDeleteView,
)


urlpatterns = [
    path(
        "patients/<uuid:patient_id>/attachments/",
        PatientAttachmentCollectionView.as_view(),
        name="patient-attachment-collection",
    ),
    path(
        "patients/<uuid:patient_id>/attachments/<uuid:attachment_id>/",
        PatientAttachmentDetailView.as_view(),
        name="patient-attachment-detail",
    ),
    path(
        "patients/<uuid:patient_id>/attachments/<uuid:attachment_id>/undo-delete/",
        PatientAttachmentUndoDeleteView.as_view(),
        name="patient-attachment-undo-delete",
    ),
    path(
        "patients/<uuid:patient_id>/attachments/<uuid:attachment_id>/preview/",
        PatientAttachmentPreviewView.as_view(),
        name="patient-attachment-preview",
    ),
    path(
        "patients/<uuid:patient_id>/attachments/<uuid:attachment_id>/download/",
        PatientAttachmentDownloadView.as_view(),
        name="patient-attachment-download",
    ),
]
