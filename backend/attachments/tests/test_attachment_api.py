from datetime import timedelta
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from pillow_heif import register_heif_opener
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import Clinic, StaffUser
from attachments.models import PatientAttachment
from attachments.services import purge_expired_deleted_attachments


register_heif_opener()


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PatientAttachmentApiTests(APITestCase):
    def setUp(self):
        self.private_media = TemporaryDirectory()
        self.addCleanup(self.private_media.cleanup)
        self.media_override = override_settings(MEDIA_ROOT=self.private_media.name)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)

        clinic_response = self.client.post(
            "/api/clinics/",
            {
                "name": "North Clinic",
                "email": "clinic@example.com",
                "phone": "+33 1 00 00 00 00",
            },
            format="json",
        )
        self.clinic_token = clinic_response.data["device_token"]
        self.doctor_token = self.register_staff(
            "doctor",
            "doctor.one",
            "doctor@example.com",
        )
        self.assistant_token = self.register_staff(
            "assistant",
            "assistant.one",
            "assistant@example.com",
        )
        self.doctor_assistant_token = self.login_staff("assistant", "doctor.one")
        self.patient = self.create_patient()

    def register_staff(self, role, username, email):
        response = self.client.post(
            "/api/staff/register/",
            {
                "role": role,
                "username": username,
                "email": email,
                "first_name": "Test",
                "last_name": role.title(),
                "password": "Strong-staff-password-123",
                "password_confirm": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data["session_token"]

    def login_staff(self, role, username):
        response = self.client.post(
            "/api/staff/login/",
            {
                "role": role,
                "username": username,
                "password": "Strong-staff-password-123",
            },
            format="json",
            HTTP_X_DEVICE_TOKEN=self.clinic_token,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["session_token"]

    def request_as(self, token, method, path, data=None, *, format="json"):
        return getattr(self.client, method)(
            path,
            data,
            format=format,
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

    def create_patient(self, **overrides):
        payload = {
            "full_name": "Sara Ahmadi",
            "gender": "Woman",
            "country_calling_code": "+98",
            "phone_number": "0912 123 4567",
            "date_of_birth": "1992-04-15",
            "patient_note": "",
        }
        payload.update(overrides)
        response = self.request_as(
            self.assistant_token,
            "post",
            "/api/patients/",
            payload,
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response.data

    def collection_path(self, patient_id=None):
        patient_id = patient_id or self.patient["id"]
        return f"/api/patients/{patient_id}/attachments/"

    def detail_path(self, attachment_id, suffix=""):
        return (
            f"/api/patients/{self.patient['id']}/attachments/"
            f"{attachment_id}/{suffix}"
        )

    def pdf(self, name="document.pdf", marker=b"one"):
        return SimpleUploadedFile(
            name,
            b"%PDF-1.7\n" + marker,
            content_type="application/pdf",
        )

    def image(self, name, *, mode="RGB", color=(25, 50, 75), format=None):
        output = BytesIO()
        image = Image.new(mode, (4, 4), color)
        image.save(output, format=format or Path(name).suffix.lstrip(".").upper())
        content_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".heic": "image/heic",
            ".heif": "image/heif",
        }[Path(name).suffix.lower()]
        return SimpleUploadedFile(name, output.getvalue(), content_type=content_type)

    def upload(self, token, files, names=None, *, patient_id=None):
        payload = {"files": files}
        if names is not None:
            payload["document_names"] = names
        return self.request_as(
            token,
            "post",
            self.collection_path(patient_id),
            payload,
            format="multipart",
        )

    def uploaded_attachment(self, response, index=0):
        return response.data["results"][index]["attachment"]

    def test_doctor_assistant_and_doctor_in_assistant_workspace_have_equal_access(self):
        assistant_upload = self.upload(
            self.assistant_token,
            [self.pdf("assistant.pdf", b"assistant")],
        )
        doctor_upload = self.upload(
            self.doctor_token,
            [self.pdf("doctor.pdf", b"doctor")],
        )
        assistant_attachment = self.uploaded_attachment(assistant_upload)
        doctor_attachment = self.uploaded_attachment(doctor_upload)

        renamed = self.request_as(
            self.doctor_assistant_token,
            "patch",
            self.detail_path(assistant_attachment["id"]),
            {"document_name": "reviewed.pdf"},
        )
        preview = self.request_as(
            self.assistant_token,
            "get",
            self.detail_path(doctor_attachment["id"], "preview/"),
        )
        deleted = self.request_as(
            self.doctor_token,
            "delete",
            self.detail_path(doctor_attachment["id"]),
        )
        listing = self.request_as(
            self.assistant_token,
            "get",
            self.collection_path(),
        )

        self.assertEqual(assistant_upload.status_code, status.HTTP_201_CREATED)
        self.assertEqual(doctor_upload.status_code, status.HTTP_201_CREATED)
        self.assertEqual(renamed.status_code, status.HTTP_200_OK)
        self.assertEqual(renamed.data["document_name"], "reviewed.pdf")
        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertEqual(listing.data["count"], 1)
        self.assertEqual(
            doctor_attachment["uploader_identity"]["role"],
            StaffUser.Role.DOCTOR,
        )

    def test_attachment_routes_require_authentication_and_enforce_clinic_isolation(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf()])
        )
        anonymous = self.client.get(self.collection_path())

        other_clinic = self.client.post(
            "/api/clinics/",
            {
                "name": "Other Clinic",
                "email": "other@example.com",
                "phone": "+33 1 11 11 11 11",
            },
            format="json",
        ).data
        original_clinic_token = self.clinic_token
        self.clinic_token = other_clinic["device_token"]
        other_token = self.register_staff(
            "doctor",
            "other.doctor",
            "other.doctor@example.com",
        )
        self.clinic_token = original_clinic_token

        collection = self.request_as(other_token, "get", self.collection_path())
        detail = self.request_as(
            other_token,
            "get",
            self.detail_path(attachment["id"], "download/"),
        )

        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(collection.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(detail.status_code, status.HTTP_404_NOT_FOUND)

    def test_batch_upload_supports_partial_success_and_both_duplicate_rules(self):
        first = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("existing.pdf", b"same")])
        )
        response = self.upload(
            self.doctor_token,
            [
                self.pdf("existing.pdf", b"different"),
                self.pdf("copy.pdf", b"same"),
                self.pdf("new.pdf", b"new"),
            ],
        )

        self.assertEqual(response.status_code, status.HTTP_207_MULTI_STATUS)
        self.assertEqual(
            [result["status"] for result in response.data["results"]],
            ["error", "error", "uploaded"],
        )
        self.assertEqual(
            response.data["results"][0]["error"]["code"],
            "duplicate_document_name",
        )
        self.assertIn(first["document_name"], response.data["results"][0]["error"]["detail"])
        self.assertEqual(
            response.data["results"][1]["error"]["code"],
            "duplicate_file_content",
        )
        self.assertIn(first["document_name"], response.data["results"][1]["error"]["detail"])
        self.assertEqual(PatientAttachment.objects.count(), 2)

    def test_deleted_attachment_reserves_its_name_and_content_during_undo(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("reserved.pdf", b"reserved")])
        )
        self.request_as(
            self.assistant_token,
            "delete",
            self.detail_path(attachment["id"]),
        )

        same_name = self.upload(
            self.assistant_token,
            [self.pdf("reserved.pdf", b"other")],
        )
        same_content = self.upload(
            self.assistant_token,
            [self.pdf("other.pdf", b"reserved")],
        )

        self.assertEqual(
            same_name.data["results"][0]["error"]["code"],
            "duplicate_document_name",
        )
        self.assertEqual(
            same_content.data["results"][0]["error"]["code"],
            "duplicate_file_content",
        )

    def test_duplicate_comparison_is_normalized_but_never_crosses_patient_boundary(self):
        first = self.upload(
            self.assistant_token,
            [self.pdf("Report.pdf", b"same-across-patients")],
        )
        normalized_duplicate = self.upload(
            self.doctor_token,
            [self.pdf("source.pdf", b"different")],
            ["  report.PDF  "],
        )
        other_patient = self.create_patient(
            full_name="Mina Karimi",
            phone_number="0912 555 6677",
            date_of_birth="1984-06-10",
        )
        other_patient_upload = self.upload(
            self.doctor_token,
            [self.pdf("Report.pdf", b"same-across-patients")],
            patient_id=other_patient["id"],
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            normalized_duplicate.data["results"][0]["error"]["code"],
            "duplicate_document_name",
        )
        self.assertEqual(other_patient_upload.status_code, status.HTTP_201_CREATED)

    def test_rename_preserves_original_name_storage_key_and_file_type_and_searches_current_name(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("bloodwork.pdf", b"lab")])
        )
        model = PatientAttachment.objects.get(pk=attachment["id"])
        stored_name = model.file.name

        renamed = self.request_as(
            self.doctor_token,
            "patch",
            self.detail_path(attachment["id"]),
            {"document_name": "lab-result.pdf"},
        )
        wrong_extension = self.request_as(
            self.doctor_token,
            "patch",
            self.detail_path(attachment["id"]),
            {"document_name": "lab-result.jpg"},
        )
        malformed = self.request_as(
            self.doctor_token,
            "patch",
            self.detail_path(attachment["id"]),
            ["lab-result.pdf"],
        )
        old_search = self.request_as(
            self.assistant_token,
            "get",
            f"{self.collection_path()}?search=bloodwork",
        )
        new_search = self.request_as(
            self.assistant_token,
            "get",
            f"{self.collection_path()}?search=lab-result",
        )
        download = self.request_as(
            self.assistant_token,
            "get",
            self.detail_path(attachment["id"], "download/"),
        )
        model.refresh_from_db()

        self.assertEqual(renamed.status_code, status.HTTP_200_OK)
        self.assertEqual(renamed.data["original_filename"], "bloodwork.pdf")
        self.assertEqual(model.file.name, stored_name)
        self.assertEqual(wrong_extension.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(malformed.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(old_search.data["count"], 0)
        self.assertEqual(new_search.data["count"], 1)
        self.assertIn("attachment", download["Content-Disposition"])
        self.assertIn("lab-result.pdf", download["Content-Disposition"])

    @override_settings(PATIENT_ATTACHMENT_PAGE_SIZE=2)
    def test_list_is_newest_first_and_uses_fixed_size_pagination(self):
        for number in range(3):
            uploaded = self.upload(
                self.assistant_token,
                [self.pdf(f"document-{number}.pdf", str(number).encode())],
            )
            model = PatientAttachment.objects.get(
                pk=self.uploaded_attachment(uploaded)["id"]
            )
            PatientAttachment.all_objects.filter(pk=model.pk).update(
                created_at=timezone.now() + timedelta(seconds=number)
            )

        first_page = self.request_as(
            self.doctor_token,
            "get",
            self.collection_path(),
        )
        second_page = self.request_as(
            self.doctor_token,
            "get",
            f"{self.collection_path()}?page=2",
        )
        invalid_page = self.request_as(
            self.doctor_token,
            "get",
            f"{self.collection_path()}?page=0",
        )

        self.assertEqual(first_page.data["count"], 3)
        self.assertEqual(first_page.data["page_size"], 2)
        self.assertEqual(first_page.data["total_pages"], 2)
        self.assertEqual(
            [item["document_name"] for item in first_page.data["results"]],
            ["document-2.pdf", "document-1.pdf"],
        )
        self.assertEqual(second_page.data["results"][0]["document_name"], "document-0.pdf")
        self.assertEqual(invalid_page.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supported_images_are_verified_and_jpeg_extension_is_preserved(self):
        response = self.upload(
            self.assistant_token,
            [
                self.image("photo.jpg", format="JPEG"),
                self.image("scan.jpeg", color=(80, 90, 100), format="JPEG"),
                self.image("chart.png", color=(100, 20, 40), format="PNG"),
            ],
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        attachments = [result["attachment"] for result in response.data["results"]]
        self.assertEqual(
            [item["document_name"] for item in attachments],
            ["photo.jpg", "scan.jpeg", "chart.png"],
        )
        self.assertEqual(
            [item["content_type"] for item in attachments],
            ["image/jpeg", "image/jpeg", "image/png"],
        )

    def test_heic_and_heif_are_converted_and_only_browser_previewable_output_is_stored(self):
        response = self.upload(
            self.assistant_token,
            [
                self.image("portrait.heic", format="HEIF"),
                self.image(
                    "overlay.heif",
                    mode="RGBA",
                    color=(10, 20, 30, 0),
                    format="HEIF",
                ),
            ],
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        portrait, overlay = [
            result["attachment"] for result in response.data["results"]
        ]
        self.assertEqual(portrait["original_filename"], "portrait.heic")
        self.assertEqual(portrait["document_name"], "portrait.jpg")
        self.assertEqual(portrait["content_type"], "image/jpeg")
        self.assertEqual(overlay["original_filename"], "overlay.heif")
        self.assertEqual(overlay["document_name"], "overlay.png")
        self.assertEqual(overlay["content_type"], "image/png")

        portrait_model = PatientAttachment.objects.get(pk=portrait["id"])
        overlay_model = PatientAttachment.objects.get(pk=overlay["id"])
        with portrait_model.file.open("rb") as stored:
            self.assertEqual(stored.read(2), b"\xff\xd8")
        with overlay_model.file.open("rb") as stored:
            self.assertEqual(stored.read(8), b"\x89PNG\r\n\x1a\n")

    @override_settings(PATIENT_ATTACHMENT_MAX_BYTES=100)
    def test_invalid_signature_mismatched_type_unsupported_type_and_size_are_rejected(self):
        invalid_pdf = SimpleUploadedFile(
            "fake.pdf",
            b"not a pdf",
            content_type="application/pdf",
        )
        png_output = BytesIO()
        Image.new("RGB", (2, 2), (1, 2, 3)).save(png_output, format="PNG")
        mismatched = SimpleUploadedFile(
            "fake.jpg",
            png_output.getvalue(),
            content_type="image/jpeg",
        )
        unsupported = SimpleUploadedFile(
            "notes.txt",
            b"plain text",
            content_type="text/plain",
        )
        oversized = SimpleUploadedFile(
            "large.pdf",
            b"%PDF-1.7\n" + b"x" * 100,
            content_type="application/pdf",
        )

        response = self.upload(
            self.assistant_token,
            [invalid_pdf, mismatched, unsupported, oversized],
        )

        self.assertEqual(response.status_code, status.HTTP_207_MULTI_STATUS)
        self.assertEqual(
            [result["error"]["code"] for result in response.data["results"]],
            [
                "invalid_file",
                "file_type_mismatch",
                "unsupported_file_type",
                "file_too_large",
            ],
        )

    @override_settings(PATIENT_ATTACHMENT_MAX_BATCH=1)
    def test_batch_limit_is_enforced_before_processing(self):
        response = self.upload(
            self.assistant_token,
            [self.pdf("one.pdf", b"one"), self.pdf("two.pdf", b"two")],
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(PatientAttachment.objects.count(), 0)

    def test_preview_is_private_inline_stream_and_download_uses_current_name(self):
        content = b"%PDF-1.7\npreview"
        attachment = self.uploaded_attachment(
            self.upload(
                self.assistant_token,
                [SimpleUploadedFile("preview.pdf", content, content_type="application/pdf")],
            )
        )
        preview = self.request_as(
            self.doctor_token,
            "get",
            self.detail_path(attachment["id"], "preview/"),
        )

        self.assertEqual(preview.status_code, status.HTTP_200_OK)
        self.assertEqual(b"".join(preview.streaming_content), content)
        self.assertIn("inline", preview["Content-Disposition"])
        self.assertEqual(preview["Cache-Control"], "private, no-store")
        self.assertEqual(preview["X-Content-Type-Options"], "nosniff")
        self.assertEqual(preview["Content-Security-Policy"], "sandbox")

    def test_delete_has_five_second_undo_then_hard_deletes_row_and_stored_file(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("delete.pdf", b"delete")])
        )
        model = PatientAttachment.objects.get(pk=attachment["id"])
        stored_path = Path(self.private_media.name, model.file.name)

        deleted = self.request_as(
            self.doctor_token,
            "delete",
            self.detail_path(attachment["id"]),
        )
        hidden = self.request_as(
            self.assistant_token,
            "get",
            self.detail_path(attachment["id"], "preview/"),
        )
        restored = self.request_as(
            self.assistant_token,
            "post",
            self.detail_path(attachment["id"], "undo-delete/"),
        )

        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertTrue(stored_path.exists())

        self.request_as(
            self.assistant_token,
            "delete",
            self.detail_path(attachment["id"]),
        )
        PatientAttachment.all_objects.filter(pk=attachment["id"]).update(
            deleted_at=timezone.now() - timedelta(seconds=6)
        )
        with self.captureOnCommitCallbacks(execute=True):
            deleted_count = purge_expired_deleted_attachments()

        self.assertEqual(deleted_count, 1)
        self.assertFalse(
            PatientAttachment.all_objects.filter(pk=attachment["id"]).exists()
        )
        self.assertFalse(stored_path.exists())

    def test_patient_soft_delete_hides_attachments_and_patient_undo_restores_them(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("patient.pdf", b"patient")])
        )
        deleted = self.request_as(
            self.assistant_token,
            "delete",
            f"/api/patients/{self.patient['id']}/",
        )
        hidden = self.request_as(
            self.doctor_token,
            "get",
            self.collection_path(),
        )
        restored = self.request_as(
            self.assistant_token,
            "post",
            f"/api/patients/{self.patient['id']}/undo-delete/",
        )
        visible = self.request_as(
            self.doctor_token,
            "get",
            self.collection_path(),
        )

        self.assertEqual(deleted.status_code, status.HTTP_200_OK)
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(visible.data["results"][0]["id"], attachment["id"])

    def test_clinic_cascade_hard_deletes_attachment_row_and_file(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("clinic.pdf", b"clinic")])
        )
        model = PatientAttachment.objects.get(pk=attachment["id"])
        stored_path = Path(self.private_media.name, model.file.name)
        clinic_id = model.patient.clinic_id

        with self.captureOnCommitCallbacks(execute=True):
            Clinic.objects.get(pk=clinic_id).delete()

        self.assertFalse(
            PatientAttachment.all_objects.filter(pk=attachment["id"]).exists()
        )
        self.assertFalse(stored_path.exists())

    def test_anonymized_uploader_is_reported_as_former_assistant(self):
        attachment = self.uploaded_attachment(
            self.upload(self.assistant_token, [self.pdf("history.pdf", b"history")])
        )
        model = PatientAttachment.objects.select_related("uploader").get(
            pk=attachment["id"]
        )
        model.uploader.anonymized_at = timezone.now()
        model.uploader.save(update_fields=["anonymized_at"])

        listing = self.request_as(
            self.doctor_token,
            "get",
            self.collection_path(),
        )

        self.assertEqual(
            listing.data["results"][0]["uploader_identity"]["name"],
            "Former Assistant",
        )

    def test_default_limits_match_the_approved_contract(self):
        self.assertEqual(settings.PATIENT_ATTACHMENT_MAX_BYTES, 100 * 1024 * 1024)
        self.assertEqual(settings.PATIENT_ATTACHMENT_MAX_BATCH, 10)
        self.assertEqual(settings.PATIENT_ATTACHMENT_PAGE_SIZE, 50)
        self.assertEqual(settings.PATIENT_ATTACHMENT_DELETE_UNDO_SECONDS, 5)
