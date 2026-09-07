export const PATIENT_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;
export const PATIENT_ATTACHMENT_MAX_BATCH = 10;

const ACCEPTED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".heif",
]);

export const PATIENT_ATTACHMENT_ACCEPT = [
  ...ACCEPTED_EXTENSIONS,
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heic-sequence",
  "image/heif",
  "image/heif-sequence",
].join(",");

export function attachmentExtension(filename) {
  const name = String(filename || "");
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

export function validatePatientAttachmentFile(file) {
  if (!file || !ACCEPTED_EXTENSIONS.has(attachmentExtension(file.name))) {
    return "Choose a PDF, JPG, JPEG, PNG, HEIC, or HEIF file.";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "Empty files cannot be uploaded.";
  }
  if (file.size > PATIENT_ATTACHMENT_MAX_BYTES) {
    return "Files must be 100 MB or smaller.";
  }
  return null;
}

export function formatAttachmentSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) return "Unknown size";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(size < 10 * 1024 ? 1 : 0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(size < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function attachmentTypeLabel(contentType, documentName = "") {
  if (contentType === "application/pdf") return "PDF";
  if (contentType === "image/jpeg") return "JPEG";
  if (contentType === "image/png") return "PNG";
  const extension = attachmentExtension(documentName).slice(1);
  return extension ? extension.toUpperCase() : "File";
}

export function formatAttachmentDate(value) {
  if (!value) return "Unknown upload time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown upload time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function attachmentUploaderLabel(identity) {
  if (!identity?.name) return "Unknown uploader";
  if (identity.name === "Former Assistant") return identity.name;
  const role = identity.role === "doctor" ? "Doctor" : identity.role === "assistant" ? "Assistant" : null;
  return role ? `${identity.name} · ${role}` : identity.name;
}
