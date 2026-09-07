import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PATIENT_ATTACHMENT_ACCEPT,
  PATIENT_ATTACHMENT_MAX_BATCH,
  PATIENT_ATTACHMENT_MAX_BYTES,
  attachmentExtension,
  attachmentTypeLabel,
  attachmentUploaderLabel,
  formatAttachmentSize,
  validatePatientAttachmentFile,
} from "../src/patientAttachmentFiles.js";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Patient attachment selection follows the approved type and size contract", () => {
  assert.equal(PATIENT_ATTACHMENT_MAX_BATCH, 10);
  assert.equal(PATIENT_ATTACHMENT_MAX_BYTES, 100 * 1024 * 1024);
  for (const extension of [".pdf", ".jpg", ".jpeg", ".png", ".heic", ".heif"]) {
    assert.match(PATIENT_ATTACHMENT_ACCEPT, new RegExp(`\\${extension}`));
    assert.equal(validatePatientAttachmentFile({ name: `document${extension}`, size: 10 }), null);
  }
  assert.equal(attachmentExtension("SCAN.JPEG"), ".jpeg");
  assert.match(validatePatientAttachmentFile({ name: "document.txt", size: 10 }), /PDF, JPG, JPEG, PNG, HEIC, or HEIF/);
  assert.match(validatePatientAttachmentFile({ name: "empty.pdf", size: 0 }), /Empty files/);
  assert.match(validatePatientAttachmentFile({ name: "large.pdf", size: PATIENT_ATTACHMENT_MAX_BYTES + 1 }), /100 MB/);
});

test("Patient attachment metadata formatting remains readable and role-correct", () => {
  assert.equal(formatAttachmentSize(900), "900 B");
  assert.equal(formatAttachmentSize(1536), "1.5 KB");
  assert.equal(formatAttachmentSize(2 * 1024 * 1024), "2.0 MB");
  assert.equal(attachmentTypeLabel("application/pdf", "scan.pdf"), "PDF");
  assert.equal(attachmentTypeLabel("image/jpeg", "scan.jpg"), "JPEG");
  assert.equal(attachmentTypeLabel("image/png", "scan.png"), "PNG");
  assert.equal(attachmentUploaderLabel({ name: "Test Doctor", role: "doctor" }), "Test Doctor · Doctor");
  assert.equal(attachmentUploaderLabel({ name: "Test Assistant", role: "assistant" }), "Test Assistant · Assistant");
  assert.equal(attachmentUploaderLabel({ name: "Former Assistant", role: "assistant" }), "Former Assistant");
});

test("production Patient profiles expose the complete shared attachment workflow", async () => {
  const detail = await source("../src/PatientDetail.jsx");
  const workspace = await source("../src/PatientWorkspaceView.jsx");
  const attachments = await source("../src/PatientAttachments.jsx");
  const attachmentStyles = await source("../src/phase9.css");
  const controller = await source("../src/usePatientWorkspace.js");
  const account = await source("../src/AccountSettings.jsx");

  assert.match(detail, /<PatientAttachments/);
  assert.match(workspace, /attachmentsEnabled attachmentRefreshVersion/);
  assert.match(workspace, /onRegisterUndo=\{registerUndo\}/);
  assert.doesNotMatch(workspace, /attachmentsEnabled=\{doctorAccount|attachmentsEnabled=\{assistantWorkspace/);

  assert.match(attachments, /type="file"/);
  assert.match(attachments, /multiple/);
  assert.match(attachments, /accept=\{PATIENT_ATTACHMENT_ACCEPT\}/);
  assert.match(attachments, /onDragEnter=\{handleDragEnter\}/);
  assert.match(attachments, /onDrop=\{handleDrop\}/);
  assert.match(attachments, /Math\.min\(2, entries\.length\)/);
  assert.match(attachments, /<progress aria-label=\{`Upload progress/);
  assert.match(attachments, /Document name for retry/);
  assert.match(attachments, /aria-label=\{`Retry upload of \$\{item\.file\.name\}`\}/);
  assert.match(attachments, /upload entry for \$\{item\.file\.name\}/);
  assert.match(attachments, /complete \? "Dismiss" : "Remove"/);
  assert.match(attachments, /aria-describedby="attachment-upload-limits"/);
  assert.match(attachments, /aria-labelledby="attachment-upload-queue-title"/);
  assert.match(attachments, /role="status" aria-label="Loading attachments"/);
  assert.match(attachments, /className="patient-attachments__count"/);
  assert.doesNotMatch(attachments, /className="count-badge"/);
  assert.match(attachmentStyles, /@media \(hover: none\), \(pointer: coarse\)[\s\S]*attachment-row__actions[\s\S]*min-height: var\(--control-height-standard\)/);
  assert.match(attachmentStyles, /transition-property: background-color, border-color, box-shadow, color;/);
  assert.match(attachmentStyles, /attachment-search input \{[\s\S]*min-height: var\(--control-height-standard\)/);

  assert.match(attachments, /Search document names/);
  assert.match(attachments, /Original: \{attachment\.original_filename\}/);
  assert.match(attachments, /formatAttachmentSize\(attachment\.size\)/);
  assert.match(attachments, /formatAttachmentDate\(attachment\.created_at\)/);
  assert.match(attachments, /Uploaded by \{uploader\}/);
  assert.match(attachments, /Preview/);
  assert.match(attachments, /Download/);
  assert.match(attachments, /Rename/);
  assert.match(attachments, /role="alertdialog"/);
  assert.match(attachments, /After the Undo period, both the document record and stored file are permanently deleted/);

  assert.match(controller, /a\.kind === "attachment_delete"/);
  assert.match(controller, /attachments\/\$\{a\.resourceId\}\/undo-delete/);
  assert.match(controller, /setAttachmentRefreshVersion/);
  assert.doesNotMatch(attachments, /setInterval/);
  assert.match(detail, /Attachments become inaccessible with the Patient and return if you Undo/);
  assert.match(account, /Patient records, attachments, appointments, queue, consultation, and task data/);
});

test("production attachment transport uses authenticated multipart upload and private blob reads", async () => {
  const transport = await source("../src/patientAttachmentApi.js");
  const api = await source("../src/api.js");

  assert.match(transport, /new XMLHttpRequest\(\)/);
  assert.match(transport, /new FormData\(\)/);
  assert.match(transport, /form\.append\("files", file\)/);
  assert.match(transport, /form\.append\("document_names", documentName\)/);
  assert.match(transport, /request\.upload\.addEventListener\("progress"/);
  assert.match(transport, /authenticatedApiHeaders\(\{ staffToken \}\)/);
  assert.match(transport, /cache: "no-store"/);
  assert.match(transport, /return response\.blob\(\)/);
  assert.match(transport, /demoUploadPatientAttachment/);
  assert.match(transport, /demoFetchPatientAttachmentContent/);
  assert.match(api, /headers\.Authorization = `Bearer \$\{staffToken\}`/);
  assert.match(api, /headers\["X-Device-Token"\]/);
});

test("multipart transport reports progress, sends device proof, and returns one uploaded attachment", async () => {
  const values = new Map([["health-hub.active-device-token", "device-proof"]]);
  globalThis.localStorage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };

  class FakeRequest {
    constructor() {
      this.headers = {};
      this.listeners = {};
      this.uploadListeners = {};
      this.upload = {
        addEventListener: (name, listener) => { this.uploadListeners[name] = listener; },
      };
      FakeRequest.last = this;
    }
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    addEventListener(name, listener) { this.listeners[name] = listener; }
    send(form) {
      this.form = form;
      this.uploadListeners.progress?.({ lengthComputable: true, loaded: 1, total: 2 });
      this.status = 201;
      this.responseText = JSON.stringify({
        results: [{
          status: "uploaded",
          attachment: { id: "attachment-id", document_name: "renamed.pdf" },
        }],
      });
      this.listeners.load();
    }
  }
  globalThis.XMLHttpRequest = FakeRequest;
  const { uploadPatientAttachment } = await import("../src/patientAttachmentApi.js");
  const progress = [];
  const file = new File(["%PDF-1.7"], "source.pdf", { type: "application/pdf" });

  const attachment = await uploadPatientAttachment({
    patientId: "patient-id",
    file,
    documentName: "renamed.pdf",
    staffToken: "staff-session",
    onProgress: (value) => progress.push(value),
  });

  assert.equal(attachment.document_name, "renamed.pdf");
  assert.equal(FakeRequest.last.method, "POST");
  assert.match(FakeRequest.last.url, /\/api\/patients\/patient-id\/attachments\/$/);
  assert.equal(FakeRequest.last.headers.Authorization, "Bearer staff-session");
  assert.equal(FakeRequest.last.headers["X-Device-Token"], "device-proof");
  assert.equal(FakeRequest.last.form.get("files").name, "source.pdf");
  assert.equal(FakeRequest.last.form.get("document_names"), "renamed.pdf");
  assert.deepEqual(progress, [0, 50, 100]);
});

test("multipart partial-error responses retain the per-file server explanation", async () => {
  class FailedRequest {
    constructor() {
      this.listeners = {};
      this.upload = { addEventListener() {} };
    }
    open() {}
    setRequestHeader() {}
    addEventListener(name, listener) { this.listeners[name] = listener; }
    send() {
      this.status = 207;
      this.responseText = JSON.stringify({
        results: [{
          status: "error",
          error: {
            code: "duplicate_document_name",
            detail: "A document named “source.pdf” already exists for this Patient.",
          },
        }],
      });
      this.listeners.load();
    }
  }
  globalThis.XMLHttpRequest = FailedRequest;
  const { uploadPatientAttachment } = await import("../src/patientAttachmentApi.js");

  await assert.rejects(
    uploadPatientAttachment({
      patientId: "patient-id",
      file: new File(["%PDF-1.7"], "source.pdf", { type: "application/pdf" }),
      documentName: "source.pdf",
      staffToken: "staff-session",
    }),
    (error) => (
      error.status === 207
      && error.fields.code === "duplicate_document_name"
      && /already exists/.test(error.message)
    ),
  );
});

test("private content reads use authenticated no-store fetches and return file bytes", async () => {
  const originalFetch = globalThis.fetch;
  let request = null;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(new Blob(["preview-bytes"], { type: "application/pdf" }), {
      status: 200,
      headers: { "Content-Type": "application/pdf" },
    });
  };
  const { fetchPatientAttachmentContent } = await import("../src/patientAttachmentApi.js");
  try {
    const blob = await fetchPatientAttachmentContent(
      "/api/patients/patient-id/attachments/attachment-id/preview/",
      "staff-session",
    );
    assert.equal(await blob.text(), "preview-bytes");
    assert.equal(request.options.cache, "no-store");
    assert.equal(request.options.headers.Authorization, "Bearer staff-session");
    assert.equal(request.options.headers["X-Device-Token"], "device-proof");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Pages uses the shared UI with actual attachment bytes in IndexedDB", async () => {
  const workspace = await source("../src/PatientWorkspaceView.jsx");
  const demoAttachments = await source("../src/demoAttachments.js");
  const demoStore = await source("../src/demoAttachmentStore.js");
  const phase9 = await source("../../docs/PHASE_9_PATIENT_ATTACHMENTS.md");

  assert.match(workspace, /attachmentsEnabled attachmentRefreshVersion/);
  assert.match(demoStore, /createObjectStore\(STORE_NAME/);
  assert.match(demoStore, /unique_patient_name/);
  assert.match(demoStore, /unique_patient_content/);
  assert.match(demoAttachments, /blob: processed\.blob/);
  assert.match(demoAttachments, /source_sha256/);
  assert.match(demoAttachments, /deleteDemoAttachmentsForClinics/);
  assert.match(phase9, /actual browser-local file bytes in IndexedDB/);
  assert.match(phase9, /Metadata-only simulation is not used/);
});
