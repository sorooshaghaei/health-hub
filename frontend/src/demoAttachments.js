import {
  PATIENT_ATTACHMENT_MAX_BYTES,
  attachmentExtension,
} from "./patientAttachmentFiles.js";
import {
  addDemoAttachment,
  deleteDemoAttachment,
  deleteDemoAttachmentsForClinics as deleteStoredAttachmentsForClinics,
  getDemoAttachment,
  listDemoAttachmentsForPatient,
  purgeDemoAttachments,
  putDemoAttachment,
} from "./demoAttachmentStore.js";

const AUTH_STORE_KEY = "health-hub.demo-auth.v2";
const OPERATIONAL_STORE_KEY = "health-hub.demo-store.v1";
const UNDO_WINDOW_MS = 5000;
const PAGE_SIZE = 50;
const MAX_NAME_LENGTH = 255;

const EXPECTED_CONTENT_TYPES = {
  ".pdf": new Set(["application/pdf", "application/octet-stream", ""]),
  ".jpg": new Set(["image/jpeg", "application/octet-stream", ""]),
  ".jpeg": new Set(["image/jpeg", "application/octet-stream", ""]),
  ".png": new Set(["image/png", "application/octet-stream", ""]),
  ".heic": new Set(["image/heic", "image/heic-sequence", "image/heif", "image/heif-sequence", "application/octet-stream", ""]),
  ".heif": new Set(["image/heic", "image/heic-sequence", "image/heif", "image/heif-sequence", "application/octet-stream", ""]),
};

function fail(payload, status = 400) {
  const error = new Error("Demo attachment request failed.");
  error.payload = payload;
  error.status = status;
  throw error;
}

function storageFailure(error) {
  if (error?.name === "QuotaExceededError") {
    fail({
      code: "browser_storage_full",
      detail: "This browser does not have enough local storage for that document. Remove unneeded demo attachments and try again.",
    }, 507);
  }
  fail({
    code: "browser_storage_unavailable",
    detail: "This browser could not store the demo document locally. Check private-browsing or storage settings and try again.",
  }, 503);
}

function readJsonStore(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function readDemoState() {
  return {
    auth: readJsonStore(AUTH_STORE_KEY),
    operational: readJsonStore(OPERATIONAL_STORE_KEY),
  };
}

function activeContext(staffToken, patientId) {
  const state = readDemoState();
  const session = staffToken ? state.auth?.sessions?.[staffToken] : null;
  const account = session
    ? state.auth?.accounts?.find((candidate) => candidate.id === session.user_id)
    : null;
  if (!session || !account || account.is_active === false) {
    fail({ detail: "Staff session is invalid or expired." }, 401);
  }
  if (!session.clinic_id || !session.workspace_role) {
    fail({ detail: "Choose a clinic and workspace first." }, 403);
  }
  const membership = state.auth?.memberships?.find((candidate) => (
    candidate.user_id === account.id
      && candidate.clinic_id === session.clinic_id
      && candidate.is_active !== false
  ));
  if (!membership) fail({ detail: "Choose a clinic first." }, 403);
  if (!account.email_verified_at || !account.phone_verified_at) {
    fail({ detail: "Verify both email and phone before opening clinic data." }, 403);
  }
  if (state.operational?.clinic?.id !== session.clinic_id) {
    fail({ detail: "Open this clinic again before using demo documents." }, 409);
  }
  const patient = state.operational?.patients?.find((candidate) => (
    candidate.id === patientId && !candidate.deleted_at
  ));
  if (!patient) fail({ detail: "Patient not found." }, 404);
  return {
    account,
    clinicId: session.clinic_id,
    patient,
    state,
  };
}

function printableName(value) {
  const pathParts = String(value || "").replaceAll("\\", "/").split("/");
  const filename = (pathParts.at(-1) || "")
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}]/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^\.+|\.+$/gu, "");
  if (!filename) fail({ code: "invalid_filename", detail: "The file must have a valid filename." });
  if ([...filename].length > MAX_NAME_LENGTH) {
    fail({ code: "invalid_filename", detail: "The filename must be 255 characters or fewer." });
  }
  return filename;
}

function documentName(value, requiredExtension) {
  let name = printableName(value);
  const extension = attachmentExtension(name);
  if (!extension) name += requiredExtension;
  else if (extension !== requiredExtension) {
    fail({
      code: "invalid_document_name",
      detail: `The document name must keep the ${requiredExtension} file type.`,
    });
  }
  if ([...name].length > MAX_NAME_LENGTH) {
    fail({ code: "invalid_document_name", detail: "The document name must be 255 characters or fewer." });
  }
  return name;
}

function convertedDocumentName(value, outputExtension) {
  const name = printableName(value);
  const dot = name.lastIndexOf(".");
  const initialStem = (dot > 0 ? name.slice(0, dot) : name).trim().replace(/^\.+|\.+$/gu, "") || "document";
  const maximum = MAX_NAME_LENGTH - outputExtension.length;
  return `${[...initialStem].slice(0, maximum).join("")}${outputExtension}`;
}

function normalizeDocumentName(value) {
  return String(value).normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();
}

function bytesMatch(bytes, expected) {
  return expected.every((value, index) => bytes[index] === value);
}

async function verifyBrowserImage(blob) {
  if (typeof createImageBitmap !== "function") return;
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(blob);
    if (!bitmap.width || !bitmap.height) throw new Error("Empty image");
  } catch {
    fail({ code: "invalid_file", detail: "The selected image is invalid or unsafe." });
  } finally {
    bitmap?.close?.();
  }
}

async function sourceHash(file) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function defaultHeicConverter(file) {
  if (import.meta.env.VITE_DEMO_API !== "true") {
    throw new Error("Browser-demo HEIC conversion is disabled in this build.");
  }
  const { convertDemoHeic } = await import("./demoHeicConversion.js");
  return convertDemoHeic(file);
}

export async function processDemoAttachmentUpload(
  file,
  requestedName,
  { convertHeic = defaultHeicConverter } = {},
) {
  const originalFilename = printableName(file?.name);
  const extension = attachmentExtension(originalFilename);
  if (!Object.hasOwn(EXPECTED_CONTENT_TYPES, extension)) {
    fail({ code: "unsupported_file_type", detail: "Upload a PDF, JPG, JPEG, PNG, HEIC, or HEIF file." });
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    fail({ code: "empty_file", detail: "Empty files cannot be uploaded." });
  }
  if (file.size > PATIENT_ATTACHMENT_MAX_BYTES) {
    fail({ code: "file_too_large", detail: "Files must be 100 MB or smaller." });
  }
  const claimedType = String(file.type || "").toLowerCase();
  if (!EXPECTED_CONTENT_TYPES[extension].has(claimedType)) {
    fail({
      code: "file_type_mismatch",
      detail: "The filename, file content, and reported file type do not match.",
    });
  }

  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (extension === ".pdf" && !bytesMatch(header, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    fail({ code: "invalid_file", detail: "The selected file is not a valid PDF." });
  }
  if ([".jpg", ".jpeg"].includes(extension) && !bytesMatch(header, [0xff, 0xd8, 0xff])) {
    fail({ code: "file_type_mismatch", detail: "The filename, file content, and reported file type do not match." });
  }
  if (extension === ".png" && !bytesMatch(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    fail({ code: "file_type_mismatch", detail: "The filename, file content, and reported file type do not match." });
  }

  const hash = await sourceHash(file);
  if ([".heic", ".heif"].includes(extension)) {
    let converted;
    try {
      converted = await convertHeic(file);
    } catch {
      fail({ code: "conversion_failed", detail: "The HEIC or HEIF image could not be converted safely." });
    }
    if (!(converted?.blob instanceof Blob) || !["image/jpeg", "image/png"].includes(converted.contentType)) {
      fail({ code: "conversion_failed", detail: "The HEIC or HEIF image could not be converted safely." });
    }
    if (converted.blob.size > PATIENT_ATTACHMENT_MAX_BYTES) {
      fail({ code: "file_too_large", detail: "The converted image is larger than the 100 MB file limit." });
    }
    const outputExtension = converted.contentType === "image/png" ? ".png" : ".jpg";
    return {
      blob: converted.blob.slice(0, converted.blob.size, converted.contentType),
      contentType: converted.contentType,
      documentName: convertedDocumentName(requestedName || originalFilename, outputExtension),
      originalFilename,
      sourceSha256: hash,
    };
  }

  const contentType = extension === ".pdf"
    ? "application/pdf"
    : extension === ".png" ? "image/png" : "image/jpeg";
  const blob = file.slice(0, file.size, contentType);
  if (contentType.startsWith("image/")) await verifyBrowserImage(blob);
  return {
    blob,
    contentType,
    documentName: documentName(requestedName || originalFilename, extension),
    originalFilename,
    sourceSha256: hash,
  };
}

function patientStateForClinic(state, clinicId) {
  if (state.operational?.clinic?.id === clinicId) return state.operational;
  return state.auth?.clinic_data?.[clinicId] ?? null;
}

async function purgeExpiredAndOrphaned() {
  const state = readDemoState();
  const clinicIds = new Set(state.auth?.clinics?.map((clinic) => clinic.id) ?? []);
  const now = Date.now();
  try {
    await purgeDemoAttachments((attachment) => {
      if (!clinicIds.has(attachment.clinic_id)) return true;
      if (attachment.deleted_at && now >= new Date(attachment.deleted_at).getTime() + UNDO_WINDOW_MS) return true;
      const clinicState = patientStateForClinic(state, attachment.clinic_id);
      const patient = clinicState?.patients?.find((candidate) => candidate.id === attachment.patient_id);
      return !patient;
    });
  } catch (error) {
    storageFailure(error);
  }
}

function uploaderIdentity(attachment, state) {
  const uploader = state.auth?.accounts?.find((candidate) => candidate.id === attachment.uploader_id);
  if (!uploader || uploader.anonymized_at) {
    return { id: null, name: "Former Assistant", role: "assistant" };
  }
  return {
    id: uploader.id,
    name: `${uploader.first_name || ""} ${uploader.last_name || ""}`.trim() || uploader.email,
    role: uploader.role,
  };
}

function publicAttachment(attachment, state = readDemoState()) {
  const basePath = `/api/patients/${attachment.patient_id}/attachments/${attachment.id}/`;
  return {
    id: attachment.id,
    document_name: attachment.document_name,
    original_filename: attachment.original_filename,
    content_type: attachment.content_type,
    size: attachment.size,
    uploader_identity: uploaderIdentity(attachment, state),
    created_at: attachment.created_at,
    updated_at: attachment.updated_at,
    preview_path: `${basePath}preview/`,
    download_path: `${basePath}download/`,
  };
}

function duplicateError(attachments, processed, excludeId = null) {
  const nameMatch = attachments.find((attachment) => (
    attachment.id !== excludeId
      && attachment.normalized_document_name === normalizeDocumentName(processed.documentName)
  ));
  if (nameMatch) {
    fail({
      code: "duplicate_document_name",
      detail: `A document named “${nameMatch.document_name}” already exists for this Patient. Upload a new document or change the name.`,
    }, 409);
  }
  const contentMatch = processed.sourceSha256 && attachments.find((attachment) => (
    attachment.id !== excludeId && attachment.source_sha256 === processed.sourceSha256
  ));
  if (contentMatch) {
    fail({
      code: "duplicate_file_content",
      detail: `This file has already been uploaded as “${contentMatch.document_name}” for this Patient.`,
    }, 409);
  }
}

async function attachmentForPatient(patientId, attachmentId, clinicId, { includeDeleted = false } = {}) {
  let attachment;
  try {
    attachment = await getDemoAttachment(attachmentId);
  } catch (error) {
    storageFailure(error);
  }
  if (
    !attachment
    || attachment.patient_id !== patientId
    || attachment.clinic_id !== clinicId
    || (!includeDeleted && attachment.deleted_at)
  ) {
    fail({ detail: "Attachment not found." }, 404);
  }
  return attachment;
}

function scheduleHardDelete(attachmentId, deletedAt) {
  const delay = Math.max(0, new Date(deletedAt).getTime() + UNDO_WINDOW_MS - Date.now() + 25);
  globalThis.setTimeout(async () => {
    try {
      const attachment = await getDemoAttachment(attachmentId);
      if (attachment?.deleted_at === deletedAt) await deleteDemoAttachment(attachmentId);
    } catch {
      // A later demo request will retry cleanup if the browser was temporarily unavailable.
    }
  }, delay);
}

export async function deleteDemoAttachmentsForClinics(clinicIds) {
  try {
    return await deleteStoredAttachmentsForClinics(clinicIds);
  } catch (error) {
    storageFailure(error);
  }
}

export async function demoUploadPatientAttachment({
  patientId,
  file,
  documentName: requestedName,
  staffToken,
  onProgress,
}) {
  activeContext(staffToken, patientId);
  await purgeExpiredAndOrphaned();
  onProgress?.(5);
  const processed = await processDemoAttachmentUpload(file, requestedName);
  onProgress?.(75);
  let existing;
  try {
    existing = await listDemoAttachmentsForPatient(patientId);
  } catch (error) {
    storageFailure(error);
  }
  duplicateError(existing, processed);
  const context = activeContext(staffToken, patientId);
  const now = new Date().toISOString();
  const attachment = {
    id: crypto.randomUUID(),
    clinic_id: context.clinicId,
    patient_id: patientId,
    uploader_id: context.account.id,
    document_name: processed.documentName,
    normalized_document_name: normalizeDocumentName(processed.documentName),
    original_filename: processed.originalFilename,
    content_type: processed.contentType,
    size: processed.blob.size,
    source_sha256: processed.sourceSha256,
    blob: processed.blob,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
  try {
    await addDemoAttachment(attachment);
  } catch (error) {
    if (error?.name === "ConstraintError") {
      const latest = await listDemoAttachmentsForPatient(patientId);
      duplicateError(latest, processed);
    }
    storageFailure(error);
  }
  onProgress?.(100);
  return publicAttachment(attachment, context.state);
}

async function listAttachments(url, patientId, clinicId) {
  let attachments;
  try {
    attachments = await listDemoAttachmentsForPatient(patientId);
  } catch (error) {
    storageFailure(error);
  }
  const search = String(url.searchParams.get("search") || "").trim().toLowerCase();
  const visible = attachments
    .filter((attachment) => attachment.clinic_id === clinicId)
    .filter((attachment) => !attachment.deleted_at)
    .filter((attachment) => !search || attachment.document_name.toLowerCase().includes(search))
    .sort((first, second) => second.created_at.localeCompare(first.created_at) || second.id.localeCompare(first.id));
  const rawPage = url.searchParams.get("page") || "1";
  const page = Number(rawPage);
  if (!Number.isInteger(page) || page < 1) fail({ page: ["Enter a positive page number."] });
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  if (page > totalPages && visible.length) fail({ page: ["This attachment page does not exist."] }, 404);
  const start = (page - 1) * PAGE_SIZE;
  const state = readDemoState();
  return {
    count: visible.length,
    page,
    page_size: PAGE_SIZE,
    total_pages: totalPages,
    results: visible.slice(start, start + PAGE_SIZE).map((attachment) => publicAttachment(attachment, state)),
  };
}

async function renameAttachment(patientId, attachmentId, clinicId, data) {
  const attachment = await attachmentForPatient(patientId, attachmentId, clinicId);
  const requiredExtension = attachmentExtension(attachment.document_name);
  const nextName = documentName(data?.document_name, requiredExtension);
  const attachments = await listDemoAttachmentsForPatient(patientId);
  duplicateError(attachments, { documentName: nextName }, attachment.id);
  const renamed = {
    ...attachment,
    document_name: nextName,
    normalized_document_name: normalizeDocumentName(nextName),
    updated_at: new Date().toISOString(),
  };
  try {
    await putDemoAttachment(renamed);
  } catch (error) {
    if (error?.name === "ConstraintError") {
      duplicateError(await listDemoAttachmentsForPatient(patientId), { documentName: nextName }, attachment.id);
    }
    storageFailure(error);
  }
  return publicAttachment(renamed);
}

async function softDeleteAttachment(patientId, attachmentId, clinicId) {
  const attachment = await attachmentForPatient(patientId, attachmentId, clinicId);
  const deletedAt = new Date().toISOString();
  const deleted = { ...attachment, deleted_at: deletedAt, updated_at: deletedAt };
  try {
    await putDemoAttachment(deleted);
  } catch (error) {
    storageFailure(error);
  }
  scheduleHardDelete(attachmentId, deletedAt);
  return {
    code: "attachment_deleted",
    detail: `${attachment.document_name} deleted.`,
    attachment_id: attachment.id,
    undo_until: new Date(new Date(deletedAt).getTime() + UNDO_WINDOW_MS).toISOString(),
  };
}

async function undoDeleteAttachment(patientId, attachmentId, clinicId) {
  const attachment = await attachmentForPatient(patientId, attachmentId, clinicId, { includeDeleted: true });
  if (!attachment.deleted_at) fail({ detail: "Deleted attachment not found." }, 404);
  if (Date.now() > new Date(attachment.deleted_at).getTime() + UNDO_WINDOW_MS) {
    await deleteDemoAttachment(attachment.id);
    fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
  }
  const restored = { ...attachment, deleted_at: null, updated_at: new Date().toISOString() };
  await putDemoAttachment(restored);
  return publicAttachment(restored);
}

export async function demoAttachmentApiRequest(
  path,
  { method = "GET", data = {}, staffToken } = {},
) {
  const url = new URL(path, "https://health-hub.demo");
  const pathname = url.pathname;
  const collectionMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/attachments\/$/i);
  const detailMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/attachments\/([0-9a-f-]+)\/$/i);
  const undoMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/attachments\/([0-9a-f-]+)\/undo-delete\/$/i);
  const patientId = collectionMatch?.[1] ?? detailMatch?.[1] ?? undoMatch?.[1];
  if (!patientId) fail({ detail: "This attachment route is not available in the browser demo." }, 404);
  const context = activeContext(staffToken, patientId);
  await purgeExpiredAndOrphaned();

  if (collectionMatch && method === "GET") return listAttachments(url, patientId, context.clinicId);
  if (detailMatch && method === "PATCH") return renameAttachment(patientId, detailMatch[2], context.clinicId, data);
  if (detailMatch && method === "DELETE") return softDeleteAttachment(patientId, detailMatch[2], context.clinicId);
  if (undoMatch && method === "POST") return undoDeleteAttachment(patientId, undoMatch[2], context.clinicId);
  fail({ detail: "This attachment route is not available in the browser demo." }, 404);
}

export async function demoFetchPatientAttachmentContent(path, staffToken) {
  const url = new URL(path, "https://health-hub.demo");
  const match = url.pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/attachments\/([0-9a-f-]+)\/(?:preview|download)\/$/i);
  if (!match) fail({ detail: "This attachment content route is not available in the browser demo." }, 404);
  const context = activeContext(staffToken, match[1]);
  await purgeExpiredAndOrphaned();
  const attachment = await attachmentForPatient(match[1], match[2], context.clinicId);
  return attachment.blob;
}
