from rest_framework import serializers

from .models import PatientAttachment


class PatientAttachmentSerializer(serializers.ModelSerializer):
    uploader_identity = serializers.SerializerMethodField()
    preview_path = serializers.SerializerMethodField()
    download_path = serializers.SerializerMethodField()

    class Meta:
        model = PatientAttachment
        fields = [
            "id",
            "document_name",
            "original_filename",
            "content_type",
            "size",
            "uploader_identity",
            "created_at",
            "updated_at",
            "preview_path",
            "download_path",
        ]
        read_only_fields = fields

    def get_uploader_identity(self, attachment):
        if attachment.uploader is None:
            return {"id": None, "name": "Former Assistant", "role": "assistant"}
        return {
            "id": str(attachment.uploader_id),
            "name": attachment.uploader.display_name,
            "role": attachment.uploader.role,
        }

    def get_preview_path(self, attachment):
        return (
            f"/api/patients/{attachment.patient_id}/attachments/"
            f"{attachment.id}/preview/"
        )

    def get_download_path(self, attachment):
        return (
            f"/api/patients/{attachment.patient_id}/attachments/"
            f"{attachment.id}/download/"
        )
