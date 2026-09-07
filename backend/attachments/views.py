import math
from collections.abc import Mapping

from django.conf import settings
from django.db import transaction
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import active_clinic
from patients.models import Patient

from .models import PatientAttachment
from .names import safe_original_filename
from .serializers import PatientAttachmentSerializer
from .services import (
    AttachmentValidationError,
    create_attachment,
    purge_expired_deleted_attachments,
    rename_attachment,
)


def patient_for_request(request, patient_id):
    try:
        return Patient.objects.get(pk=patient_id, clinic=active_clinic(request))
    except Patient.DoesNotExist:
        raise NotFound("Patient not found.")


def attachment_for_request(request, patient_id, attachment_id, *, include_deleted=False):
    patient = patient_for_request(request, patient_id)
    manager = PatientAttachment.all_objects if include_deleted else PatientAttachment.objects
    try:
        return manager.select_related("patient", "uploader").get(
            pk=attachment_id,
            patient=patient,
        )
    except PatientAttachment.DoesNotExist:
        raise NotFound("Attachment not found.")


def attachment_error(index, uploaded_file, error):
    try:
        original_filename = safe_original_filename(uploaded_file.name)
    except ValueError:
        original_filename = "Invalid filename"
    return {
        "index": index,
        "original_filename": original_filename,
        "status": "error",
        "error": {"code": error.code, "detail": error.detail},
    }


class PatientAttachmentCollectionView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, patient_id):
        purge_expired_deleted_attachments()
        patient = patient_for_request(request, patient_id)
        queryset = PatientAttachment.objects.filter(patient=patient).select_related("uploader")
        search = str(request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(document_name__icontains=search)
        try:
            page = int(request.query_params.get("page", "1"))
        except (TypeError, ValueError):
            return Response(
                {"page": ["Enter a positive page number."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if page < 1:
            return Response(
                {"page": ["Enter a positive page number."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        page_size = settings.PATIENT_ATTACHMENT_PAGE_SIZE
        count = queryset.count()
        total_pages = max(1, math.ceil(count / page_size))
        if page > total_pages and count:
            return Response(
                {"page": ["This attachment page does not exist."]},
                status=status.HTTP_404_NOT_FOUND,
            )
        start = (page - 1) * page_size
        results = queryset[start : start + page_size]
        return Response(
            {
                "count": count,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "results": PatientAttachmentSerializer(results, many=True).data,
            }
        )

    def post(self, request, patient_id):
        purge_expired_deleted_attachments()
        patient = patient_for_request(request, patient_id)
        files = request.FILES.getlist("files")
        if not files:
            return Response(
                {"files": ["Choose at least one file."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(files) > settings.PATIENT_ATTACHMENT_MAX_BATCH:
            return Response(
                {"files": ["Upload no more than 10 files at once."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        requested_names = request.data.getlist("document_names")
        if requested_names and len(requested_names) != len(files):
            return Response(
                {"document_names": ["Provide one document name for each file."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not requested_names:
            requested_names = [None] * len(files)

        results = []
        errors = 0
        for index, (uploaded_file, requested_name) in enumerate(
            zip(files, requested_names, strict=True)
        ):
            try:
                attachment = create_attachment(
                    patient=patient,
                    uploader=request.user,
                    uploaded_file=uploaded_file,
                    requested_name=requested_name,
                )
                results.append(
                    {
                        "index": index,
                        "original_filename": attachment.original_filename,
                        "status": "uploaded",
                        "attachment": PatientAttachmentSerializer(attachment).data,
                    }
                )
            except AttachmentValidationError as error:
                errors += 1
                results.append(attachment_error(index, uploaded_file, error))

        response_status = status.HTTP_201_CREATED if not errors else status.HTTP_207_MULTI_STATUS
        return Response({"results": results}, status=response_status)


class PatientAttachmentDetailView(APIView):
    def patch(self, request, patient_id, attachment_id):
        purge_expired_deleted_attachments()
        attachment = attachment_for_request(request, patient_id, attachment_id)
        if not isinstance(request.data, Mapping) or set(request.data) != {
            "document_name"
        }:
            return Response(
                {"document_name": ["Provide the new document name only."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            renamed = rename_attachment(attachment, request.data.get("document_name"))
        except AttachmentValidationError as error:
            return Response(
                {"code": error.code, "detail": error.detail},
                status=status.HTTP_409_CONFLICT
                if error.code == "duplicate_document_name"
                else status.HTTP_400_BAD_REQUEST,
            )
        return Response(PatientAttachmentSerializer(renamed).data)

    def delete(self, request, patient_id, attachment_id):
        purge_expired_deleted_attachments()
        with transaction.atomic():
            attachment = attachment_for_request(
                request,
                patient_id,
                attachment_id,
            )
            attachment = PatientAttachment.objects.select_for_update().get(pk=attachment.pk)
            attachment.soft_delete()
        return Response(
            {
                "code": "attachment_deleted",
                "detail": f"{attachment.document_name} deleted.",
                "attachment_id": str(attachment.id),
                "undo_until": attachment.delete_undo_until,
            }
        )


class PatientAttachmentUndoDeleteView(APIView):
    def post(self, request, patient_id, attachment_id):
        with transaction.atomic():
            attachment = attachment_for_request(
                request,
                patient_id,
                attachment_id,
                include_deleted=True,
            )
            attachment = PatientAttachment.all_objects.select_for_update().get(
                pk=attachment.pk
            )
            if attachment.deleted_at is None:
                raise NotFound("Deleted attachment not found.")
            if timezone.now() > attachment.delete_undo_until:
                purge_expired_deleted_attachments(attachment_ids=[attachment.id])
                return Response(
                    {
                        "code": "undo_expired",
                        "detail": "The five-second Undo period has expired.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            attachment.restore()
        return Response(PatientAttachmentSerializer(attachment).data)


class PatientAttachmentContentView(APIView):
    as_attachment = False

    def get(self, request, patient_id, attachment_id):
        purge_expired_deleted_attachments()
        attachment = attachment_for_request(request, patient_id, attachment_id)
        try:
            content = attachment.file.open("rb")
        except (FileNotFoundError, OSError):
            raise NotFound("Attachment file not found.")
        response = FileResponse(
            content,
            as_attachment=self.as_attachment,
            filename=attachment.document_name,
            content_type=attachment.content_type,
        )
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        if not self.as_attachment and attachment.content_type == "application/pdf":
            response["Content-Security-Policy"] = "sandbox"
        return response


class PatientAttachmentPreviewView(PatientAttachmentContentView):
    as_attachment = False


class PatientAttachmentDownloadView(PatientAttachmentContentView):
    as_attachment = True
