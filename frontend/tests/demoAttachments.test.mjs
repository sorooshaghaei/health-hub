import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import "fake-indexeddb/auto";

import {
  demoAttachmentApiRequest,
  demoFetchPatientAttachmentContent,
  demoUploadPatientAttachment,
  processDemoAttachmentUpload,
} from "../src/demoAttachments.js";
import {
  getDemoAttachment,
  putDemoAttachment,
  resetDemoAttachmentDatabase,
} from "../src/demoAttachmentStore.js";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_CLINIC_ID = "10000000-0000-4000-8000-000000000002";
const PATIENT_ID = "20000000-0000-4000-8000-000000000001";
const SECOND_PATIENT_ID = "20000000-0000-4000-8000-000000000002";
const OTHER_PATIENT_ID = "20000000-0000-4000-8000-000000000003";
const DOCTOR_ID = "30000000-0000-4000-8000-000000000001";
const ASSISTANT_ID = "30000000-0000-4000-8000-000000000002";
const OTHER_DOCTOR_ID = "30000000-0000-4000-8000-000000000003";
const DOCTOR_TOKEN = "doctor-session";
const ADMIN_TOKEN = "doctor-administrator-session";
const ASSISTANT_TOKEN = "assistant-session";
const OTHER_TOKEN = "other-doctor-session";
const AUTH_KEY = "health-hub.demo-auth.v2";
const OPERATIONAL_KEY = "health-hub.demo-store.v1";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

function account(id, role, firstName, lastName) {
  return {
    id,
    role,
    first_name: firstName,
    last_name: lastName,
    email: `${firstName.toLowerCase()}@example.test`,
    email_verified_at: "2026-01-01T00:00:00.000Z",
    phone_verified_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    anonymized_at: null,
  };
}

function installDemoState() {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    accounts: [
      account(DOCTOR_ID, "doctor", "Demo", "Doctor"),
      account(ASSISTANT_ID, "assistant", "Demo", "Assistant"),
      account(OTHER_DOCTOR_ID, "doctor", "Other", "Doctor"),
    ],
    clinics: [
      { id: CLINIC_ID, name: "Demo Clinic", owner_doctor_id: DOCTOR_ID },
      { id: OTHER_CLINIC_ID, name: "Other Clinic", owner_doctor_id: OTHER_DOCTOR_ID },
    ],
    memberships: [
      { id: "membership-1", user_id: DOCTOR_ID, clinic_id: CLINIC_ID, is_active: true },
      { id: "membership-2", user_id: ASSISTANT_ID, clinic_id: CLINIC_ID, is_active: true },
      { id: "membership-3", user_id: OTHER_DOCTOR_ID, clinic_id: OTHER_CLINIC_ID, is_active: true },
    ],
    sessions: {
      [DOCTOR_TOKEN]: { user_id: DOCTOR_ID, clinic_id: CLINIC_ID, workspace_role: "doctor" },
      [ADMIN_TOKEN]: { user_id: DOCTOR_ID, clinic_id: CLINIC_ID, workspace_role: "assistant" },
      [ASSISTANT_TOKEN]: { user_id: ASSISTANT_ID, clinic_id: CLINIC_ID, workspace_role: "assistant" },
      [OTHER_TOKEN]: { user_id: OTHER_DOCTOR_ID, clinic_id: OTHER_CLINIC_ID, workspace_role: "doctor" },
    },
    clinic_data: {},
  }));
  localStorage.setItem(OPERATIONAL_KEY, JSON.stringify({
    clinic: { id: CLINIC_ID, name: "Demo Clinic" },
    patients: [
      { id: PATIENT_ID, clinic_id: CLINIC_ID, full_name: "Demo Patient", deleted_at: null },
      { id: SECOND_PATIENT_ID, clinic_id: CLINIC_ID, full_name: "Second Patient", deleted_at: null },
    ],
    visits: [],
  }));
}

function pdfFile(name = "report.pdf", content = "%PDF-1.7\ndemo attachment") {
  return new File([content], name, { type: "application/pdf" });
}

function attachmentPath(attachment, suffix = "") {
  return `/api/patients/${PATIENT_ID}/attachments/${attachment.id}/${suffix}`;
}

async function hash(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

beforeEach(async () => {
  localStorage.clear();
  await resetDemoAttachmentDatabase();
  installDemoState();
});

test("IndexedDB keeps actual bytes and exposes equal Doctor and Assistant access", async () => {
  const progress = [];
  const uploaded = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile(),
    documentName: "Consultation report.pdf",
    staffToken: ASSISTANT_TOKEN,
    onProgress: (value) => progress.push(value),
  });
  assert.equal(uploaded.document_name, "Consultation report.pdf");
  assert.equal(uploaded.original_filename, "report.pdf");
  assert.equal(uploaded.uploader_identity.name, "Demo Assistant");
  assert.deepEqual(progress, [5, 75, 100]);

  for (const staffToken of [DOCTOR_TOKEN, ADMIN_TOKEN, ASSISTANT_TOKEN]) {
    const listing = await demoAttachmentApiRequest(
      `/api/patients/${PATIENT_ID}/attachments/?page=1`,
      { staffToken },
    );
    assert.equal(listing.count, 1);
    assert.equal(listing.results[0].id, uploaded.id);
  }
  const { demoPhase8ApiRequest } = await import("../src/demoPhase8Api.js");
  assert.equal((await demoPhase8ApiRequest(
    `/api/patients/${PATIENT_ID}/attachments/?page=1`,
    { staffToken: DOCTOR_TOKEN },
  )).results[0].id, uploaded.id);
  const preview = await demoFetchPatientAttachmentContent(
    attachmentPath(uploaded, "preview/"),
    DOCTOR_TOKEN,
  );
  assert.equal(await preview.text(), "%PDF-1.7\ndemo attachment");
});

test("document-name and source-byte duplicates are reserved per Patient", async () => {
  const first = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile(),
    staffToken: DOCTOR_TOKEN,
  });
  await assert.rejects(
    demoUploadPatientAttachment({
      patientId: PATIENT_ID,
      file: pdfFile("REPORT.PDF", "%PDF-1.7\ndifferent"),
      staffToken: ASSISTANT_TOKEN,
    }),
    (error) => error.status === 409 && error.payload.code === "duplicate_document_name",
  );
  await assert.rejects(
    demoUploadPatientAttachment({
      patientId: PATIENT_ID,
      file: pdfFile("different.pdf"),
      staffToken: ASSISTANT_TOKEN,
    }),
    (error) => error.status === 409 && error.payload.code === "duplicate_file_content",
  );
  const sameBytesForAnotherPatient = await demoUploadPatientAttachment({
    patientId: SECOND_PATIENT_ID,
    file: pdfFile("report.pdf"),
    staffToken: ASSISTANT_TOKEN,
  });
  assert.notEqual(sameBytesForAnotherPatient.id, first.id);

  await demoAttachmentApiRequest(attachmentPath(first), {
    method: "DELETE",
    staffToken: DOCTOR_TOKEN,
  });
  await assert.rejects(
    demoUploadPatientAttachment({
      patientId: PATIENT_ID,
      file: pdfFile("report.pdf", "%PDF-1.7\nthird"),
      staffToken: DOCTOR_TOKEN,
    }),
    (error) => error.payload.code === "duplicate_document_name",
  );
});

test("search, rename, delete, and five-second Undo mirror the production routes", async () => {
  const uploaded = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile(),
    staffToken: DOCTOR_TOKEN,
  });
  const renamed = await demoAttachmentApiRequest(attachmentPath(uploaded), {
    method: "PATCH",
    data: { document_name: "Referral" },
    staffToken: ASSISTANT_TOKEN,
  });
  assert.equal(renamed.document_name, "Referral.pdf");
  assert.equal((await demoAttachmentApiRequest(
    `/api/patients/${PATIENT_ID}/attachments/?search=referr&page=1`,
    { staffToken: ADMIN_TOKEN },
  )).count, 1);
  assert.equal((await demoAttachmentApiRequest(
    `/api/patients/${PATIENT_ID}/attachments/?search=report&page=1`,
    { staffToken: ADMIN_TOKEN },
  )).count, 0);

  const deleted = await demoAttachmentApiRequest(attachmentPath(uploaded), {
    method: "DELETE",
    staffToken: DOCTOR_TOKEN,
  });
  assert.ok(new Date(deleted.undo_until).getTime() > Date.now());
  assert.equal((await demoAttachmentApiRequest(
    `/api/patients/${PATIENT_ID}/attachments/?page=1`,
    { staffToken: ASSISTANT_TOKEN },
  )).count, 0);
  const restored = await demoAttachmentApiRequest(attachmentPath(uploaded, "undo-delete/"), {
    method: "POST",
    staffToken: ASSISTANT_TOKEN,
  });
  assert.equal(restored.document_name, "Referral.pdf");
});

test("expired demo deletion permanently removes bytes and releases duplicate reservations", async () => {
  const uploaded = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile("expired.pdf", "%PDF-1.7\nexpired"),
    staffToken: DOCTOR_TOKEN,
  });
  await demoAttachmentApiRequest(attachmentPath(uploaded), {
    method: "DELETE",
    staffToken: ASSISTANT_TOKEN,
  });
  const deleted = await getDemoAttachment(uploaded.id);
  await putDemoAttachment({
    ...deleted,
    deleted_at: new Date(Date.now() - 6000).toISOString(),
  });

  const listing = await demoAttachmentApiRequest(
    `/api/patients/${PATIENT_ID}/attachments/?page=1`,
    { staffToken: DOCTOR_TOKEN },
  );
  assert.equal(listing.count, 0);
  assert.equal(await getDemoAttachment(uploaded.id), undefined);

  const replacement = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile("expired.pdf", "%PDF-1.7\nexpired"),
    staffToken: ASSISTANT_TOKEN,
  });
  assert.notEqual(replacement.id, uploaded.id);
});

test("Patient deletion hides bytes, Patient Undo restores access, and Doctor-account cascade removes them", async () => {
  const uploaded = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile(),
    staffToken: DOCTOR_TOKEN,
  });
  const operational = JSON.parse(localStorage.getItem(OPERATIONAL_KEY));
  operational.patients[0].deleted_at = new Date().toISOString();
  localStorage.setItem(OPERATIONAL_KEY, JSON.stringify(operational));
  await assert.rejects(
    demoFetchPatientAttachmentContent(attachmentPath(uploaded, "download/"), DOCTOR_TOKEN),
    (error) => error.status === 404,
  );
  operational.patients[0].deleted_at = null;
  localStorage.setItem(OPERATIONAL_KEY, JSON.stringify(operational));
  assert.equal(
    await (await demoFetchPatientAttachmentContent(attachmentPath(uploaded, "download/"), DOCTOR_TOKEN)).text(),
    "%PDF-1.7\ndemo attachment",
  );

  const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
  auth.accounts.find((candidate) => candidate.id === DOCTOR_ID).password_hash = await hash("ClinicPass42!");
  auth.devices = [{ id: "doctor-device", user_id: DOCTOR_ID }];
  auth.sessions[DOCTOR_TOKEN].device_id = "doctor-device";
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  const { demoPhase8ApiRequest } = await import("../src/demoPhase8Api.js");
  await demoPhase8ApiRequest("/api/staff/account/", {
    method: "DELETE",
    data: { confirmation: "DELETE", current_password: "ClinicPass42!" },
    staffToken: DOCTOR_TOKEN,
  });
  assert.equal(await getDemoAttachment(uploaded.id), undefined);
});

test("anonymized uploaders display Former Assistant and other clinics cannot open the document", async () => {
  const uploaded = await demoUploadPatientAttachment({
    patientId: PATIENT_ID,
    file: pdfFile(),
    staffToken: ASSISTANT_TOKEN,
  });
  const auth = JSON.parse(localStorage.getItem(AUTH_KEY));
  auth.accounts.find((candidate) => candidate.id === ASSISTANT_ID).anonymized_at = new Date().toISOString();
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  const listing = await demoAttachmentApiRequest(
    `/api/patients/${PATIENT_ID}/attachments/?page=1`,
    { staffToken: DOCTOR_TOKEN },
  );
  assert.deepEqual(listing.results[0].uploader_identity, {
    id: null,
    name: "Former Assistant",
    role: "assistant",
  });

  localStorage.setItem(OPERATIONAL_KEY, JSON.stringify({
    clinic: { id: OTHER_CLINIC_ID, name: "Other Clinic" },
    patients: [{ id: OTHER_PATIENT_ID, clinic_id: OTHER_CLINIC_ID, deleted_at: null }],
  }));
  await assert.rejects(
    demoFetchPatientAttachmentContent(attachmentPath(uploaded, "preview/"), OTHER_TOKEN),
    (error) => error.status === 404,
  );
});

test("HEIC and HEIF processing keeps the source name and uses converted JPEG or PNG bytes", async () => {
  const heic = new File(["demo-heic-source"], "camera.HEIC", { type: "image/heic" });
  const jpeg = await processDemoAttachmentUpload(heic, "Clinical photo.heic", {
    convertHeic: async () => ({
      blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }),
      contentType: "image/jpeg",
    }),
  });
  assert.equal(jpeg.originalFilename, "camera.HEIC");
  assert.equal(jpeg.documentName, "Clinical photo.jpg");
  assert.equal(jpeg.contentType, "image/jpeg");

  const png = await processDemoAttachmentUpload(heic, null, {
    convertHeic: async () => ({
      blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
      contentType: "image/png",
    }),
  });
  assert.equal(png.documentName, "camera.png");
  assert.equal(png.contentType, "image/png");
});
