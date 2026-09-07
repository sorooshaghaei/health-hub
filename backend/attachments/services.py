import hashlib
import warnings
from dataclasses import dataclass
from datetime import timedelta
from pathlib import PurePath
from tempfile import SpooledTemporaryFile

from django.conf import settings
from django.core.files import File
from django.db import IntegrityError, transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener

from .models import PatientAttachment
from .names import (
    DocumentNameError,
    clean_document_name,
    converted_document_name,
    normalize_document_name,
    safe_original_filename,
)


register_heif_opener()

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif"}
EXPECTED_IMAGE_FORMATS = {
    ".jpg": "JPEG",
    ".jpeg": "JPEG",
    ".png": "PNG",
    ".heic": "HEIF",
    ".heif": "HEIF",
}
EXPECTED_CONTENT_TYPES = {
    ".pdf": {"application/pdf", "application/octet-stream", ""},
    ".jpg": {"image/jpeg", "application/octet-stream", ""},
    ".jpeg": {"image/jpeg", "application/octet-stream", ""},
    ".png": {"image/png", "application/octet-stream", ""},
    ".heic": {
        "image/heic",
        "image/heic-sequence",
        "image/heif",
        "image/heif-sequence",
        "application/octet-stream",
        "",
    },
    ".heif": {
        "image/heic",
        "image/heic-sequence",
        "image/heif",
        "image/heif-sequence",
        "application/octet-stream",
        "",
    },
}


class AttachmentValidationError(ValueError):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code = code
        self.detail = detail


@dataclass
class ProcessedUpload:
    content: object
    original_filename: str
    document_name: str
    content_type: str
    size: int
    source_sha256: str
    temporary: bool = False

    def close(self):
        if self.temporary:
            self.content.close()


def _validation_error(code, detail):
    raise AttachmentValidationError(code, detail)


def _rewind(file_object):
    try:
        file_object.seek(0)
    except (AttributeError, OSError):
        _validation_error("unreadable_file", "The file could not be read.")


def _sha256(file_object):
    digest = hashlib.sha256()
    _rewind(file_object)
    while True:
        chunk = file_object.read(1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
    _rewind(file_object)
    return digest.hexdigest()


def _validate_claimed_content_type(uploaded_file, extension):
    claimed = str(getattr(uploaded_file, "content_type", "") or "").lower()
    if claimed not in EXPECTED_CONTENT_TYPES[extension]:
        _validation_error(
            "file_type_mismatch",
            "The filename, file content, and reported file type do not match.",
        )


def _validate_pdf(uploaded_file):
    _rewind(uploaded_file)
    signature = uploaded_file.read(5)
    _rewind(uploaded_file)
    if signature != b"%PDF-":
        _validation_error("invalid_file", "The selected file is not a valid PDF.")


def _open_verified_image(uploaded_file, expected_format):
    try:
        _rewind(uploaded_file)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(uploaded_file) as image:
                detected_format = image.format
                image.verify()
        _rewind(uploaded_file)
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):
        _validation_error("invalid_file", "The selected image is invalid or unsafe.")
    if detected_format != expected_format:
        _validation_error(
            "file_type_mismatch",
            "The filename, file content, and reported file type do not match.",
        )


def _heif_has_transparency(image):
    return image.mode in {"RGBA", "LA"} or (
        image.mode == "P" and "transparency" in image.info
    )


def _convert_heif(uploaded_file, original_filename, requested_name):
    source_sha256 = _sha256(uploaded_file)
    temporary = None
    try:
        _rewind(uploaded_file)
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(uploaded_file) as source:
                source.load()
                image = ImageOps.exif_transpose(source)
                has_transparency = _heif_has_transparency(image)
                output_extension = ".png" if has_transparency else ".jpg"
                output_type = "image/png" if has_transparency else "image/jpeg"
                temporary = SpooledTemporaryFile(max_size=8 * 1024 * 1024)
                if has_transparency:
                    image.convert("RGBA").save(temporary, format="PNG", optimize=True)
                else:
                    image.convert("RGB").save(
                        temporary,
                        format="JPEG",
                        quality=92,
                        optimize=True,
                    )
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):
        if temporary is not None:
            temporary.close()
        _validation_error(
            "conversion_failed",
            "The HEIC or HEIF image could not be converted safely.",
        )
    temporary.seek(0, 2)
    converted_size = temporary.tell()
    temporary.seek(0)
    if converted_size > settings.PATIENT_ATTACHMENT_MAX_BYTES:
        temporary.close()
        _validation_error(
            "file_too_large",
            "The converted image is larger than the 100 MB file limit.",
        )
    source_name = requested_name or original_filename
    document_name = converted_document_name(source_name, output_extension)
    django_file = File(temporary, name=document_name)
    return ProcessedUpload(
        content=django_file,
        original_filename=original_filename,
        document_name=document_name,
        content_type=output_type,
        size=converted_size,
        source_sha256=source_sha256,
        temporary=True,
    )


def process_upload(uploaded_file, requested_name=None):
    try:
        original_filename = safe_original_filename(uploaded_file.name)
    except DocumentNameError as exc:
        _validation_error("invalid_filename", str(exc))
    extension = PurePath(original_filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        _validation_error(
            "unsupported_file_type",
            "Upload a PDF, JPG, JPEG, PNG, HEIC, or HEIF file.",
        )
    if uploaded_file.size > settings.PATIENT_ATTACHMENT_MAX_BYTES:
        _validation_error("file_too_large", "Files must be 100 MB or smaller.")
    if uploaded_file.size <= 0:
        _validation_error("empty_file", "Empty files cannot be uploaded.")
    _validate_claimed_content_type(uploaded_file, extension)

    if extension == ".pdf":
        _validate_pdf(uploaded_file)
        try:
            document_name = clean_document_name(
                requested_name or original_filename,
                ".pdf",
            )
        except DocumentNameError as exc:
            _validation_error("invalid_document_name", str(exc))
        return ProcessedUpload(
            content=uploaded_file,
            original_filename=original_filename,
            document_name=document_name,
            content_type="application/pdf",
            size=uploaded_file.size,
            source_sha256=_sha256(uploaded_file),
        )

    expected_format = EXPECTED_IMAGE_FORMATS[extension]
    _open_verified_image(uploaded_file, expected_format)
    if extension in {".heic", ".heif"}:
        return _convert_heif(uploaded_file, original_filename, requested_name)

    output_extension = extension
    output_type = "image/jpeg" if extension in {".jpg", ".jpeg"} else "image/png"
    try:
        document_name = clean_document_name(
            requested_name or original_filename,
            output_extension,
        )
    except DocumentNameError as exc:
        _validation_error("invalid_document_name", str(exc))
    return ProcessedUpload(
        content=uploaded_file,
        original_filename=original_filename,
        document_name=document_name,
        content_type=output_type,
        size=uploaded_file.size,
        source_sha256=_sha256(uploaded_file),
    )


def _duplicate_for(patient, processed, *, exclude_id=None):
    candidates = PatientAttachment.all_objects.filter(patient=patient)
    if exclude_id is not None:
        candidates = candidates.exclude(pk=exclude_id)
    name_match = candidates.filter(
        normalized_document_name=normalize_document_name(processed.document_name)
    ).first()
    if name_match:
        _validation_error(
            "duplicate_document_name",
            f'A document named “{name_match.document_name}” already exists for this Patient. '
            "Upload a new document or change the name.",
        )
    content_match = candidates.filter(source_sha256=processed.source_sha256).first()
    if content_match:
        _validation_error(
            "duplicate_file_content",
            f'This file has already been uploaded as “{content_match.document_name}” '
            "for this Patient.",
        )


def create_attachment(*, patient, uploader, uploaded_file, requested_name=None):
    processed = process_upload(uploaded_file, requested_name)
    attachment = None
    stored_name = None
    try:
        try:
            with transaction.atomic():
                _duplicate_for(patient, processed)
                attachment = PatientAttachment(
                    patient=patient,
                    uploader=uploader,
                    document_name=processed.document_name,
                    original_filename=processed.original_filename,
                    content_type=processed.content_type,
                    size=processed.size,
                    source_sha256=processed.source_sha256,
                )
                attachment.file.save(processed.document_name, processed.content, save=False)
                stored_name = attachment.file.name
                attachment.save()
        except IntegrityError:
            if stored_name:
                attachment.file.storage.delete(stored_name)
            _duplicate_for(patient, processed)
            raise
        except Exception:
            if stored_name:
                attachment.file.storage.delete(stored_name)
            raise
        return attachment
    finally:
        processed.close()


def rename_attachment(attachment, document_name):
    extension = PurePath(attachment.document_name).suffix.lower()
    try:
        cleaned_name = clean_document_name(document_name, extension)
    except DocumentNameError as exc:
        _validation_error("invalid_document_name", str(exc))
    processed = ProcessedUpload(
        content=None,
        original_filename=attachment.original_filename,
        document_name=cleaned_name,
        content_type=attachment.content_type,
        size=attachment.size,
        source_sha256=attachment.source_sha256,
    )
    try:
        with transaction.atomic():
            locked = PatientAttachment.objects.select_for_update().get(pk=attachment.pk)
            _duplicate_for(locked.patient, processed, exclude_id=locked.id)
            locked.document_name = cleaned_name
            locked.save(update_fields=[
                "document_name",
                "normalized_document_name",
                "updated_at",
            ])
    except IntegrityError:
        _duplicate_for(attachment.patient, processed, exclude_id=attachment.id)
        raise
    return locked


def purge_expired_deleted_attachments(*, now=None, attachment_ids=None):
    now = now or timezone.now()
    cutoff = now - timedelta(
        seconds=settings.PATIENT_ATTACHMENT_DELETE_UNDO_SECONDS
    )
    queryset = PatientAttachment.all_objects.filter(
        deleted_at__isnull=False,
        deleted_at__lte=cutoff,
    )
    if attachment_ids is not None:
        queryset = queryset.filter(pk__in=attachment_ids)
    deleted = 0
    for attachment in queryset.iterator():
        attachment.delete()
        deleted += 1
    return deleted
