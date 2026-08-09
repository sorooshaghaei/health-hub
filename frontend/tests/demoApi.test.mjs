import assert from "node:assert/strict";
import test from "node:test";

import { demoApiRequest } from "../src/demoApi.js";

const storage = new Map();

globalThis.localStorage = {
  getItem(key) {
    return storage.get(key) ?? null;
  },
  setItem(key, value) {
    storage.set(key, value);
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  },
};

const clinicData = {
  name: "North Clinic",
  email: "CLINIC@example.com",
  phone: "+33 1 00 00 00 00",
  password: "clinic-password-123",
  password_confirm: "clinic-password-123",
};

function staffData(role) {
  return {
    role,
    username: `${role}.one`,
    email: `${role}@example.com`,
    first_name: "Test",
    last_name: role === "doctor" ? "Doctor" : "Assistant",
    password: "staff-password-123",
    password_confirm: "staff-password-123",
  };
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function currentTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function shiftedDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

async function authenticatedDemo() {
  const clinic = await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: clinicData,
  });
  const assistant = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    clinicToken: clinic.clinic_access_token,
    data: staffData("assistant"),
  });
  const doctor = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    clinicToken: clinic.clinic_access_token,
    data: staffData("doctor"),
  });
  const doctorAsAssistant = await demoApiRequest("/api/staff/login/", {
    method: "POST",
    clinicToken: clinic.clinic_access_token,
    data: {
      role: "assistant",
      username: "doctor.one",
      password: "staff-password-123",
    },
  });
  return { clinic, assistant, doctor, doctorAsAssistant };
}

const patientData = {
  full_name: "Sara Ahmadi",
  gender: "Woman",
  country_calling_code: "+98",
  phone_number: "09121234567",
  date_of_birth: "1994-05-11",
  patient_note: "",
};

test("browser demo allows Doctor Patient edits and Doctor administrator Assistant access", async () => {
  localStorage.clear();
  const { clinic, assistant, doctor, doctorAsAssistant } = await authenticatedDemo();

  assert.equal(clinic.clinic.email, "clinic@example.com");
  assert.equal(doctor.user.workspace_role, "doctor");
  assert.equal(doctorAsAssistant.user.role, "doctor");
  assert.equal(doctorAsAssistant.user.workspace_role, "assistant");

  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: patientData,
  });
  assert.equal(patient.phone_e164, "+989121234567");

  const doctorSearch = await demoApiRequest("/api/patients/?search=sara", {
    staffToken: doctor.session_token,
  });
  assert.equal(doctorSearch.patients[0].id, patient.id);

  const doctorEdit = await demoApiRequest(`/api/patients/${patient.id}/`, {
    method: "PATCH",
    staffToken: doctor.session_token,
    data: { patient_note: "Doctor correction" },
  });
  assert.equal(doctorEdit.patient_note, "Doctor correction");

  const adminEdit = await demoApiRequest(`/api/patients/${patient.id}/`, {
    method: "PATCH",
    staffToken: doctorAsAssistant.session_token,
    data: { patient_note: "Administrator correction" },
  });
  assert.equal(adminEdit.patient_note, "Administrator correction");
});

test("browser demo mirrors appointment-only check-in, queue, locking, and five-second Undo", async () => {
  localStorage.clear();
  const { assistant, doctor } = await authenticatedDemo();

  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: patientData,
  });

  await assert.rejects(
    demoApiRequest("/api/visits/", {
      method: "POST",
      staffToken: assistant.session_token,
      data: { visit_type: "legacy", patient_id: patient.id },
    }),
    (error) => error.status === 400 && Boolean(error.payload.visit_type),
  );

  const appointment = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      patient_id: patient.id,
      date: localDateValue(),
      scheduled_time: currentTime(),
      reason: "Review",
    },
  });
  assert.equal(appointment.status, "planned");
  assert.equal(appointment.can_check_in, true);

  const checkedIn = await demoApiRequest(`/api/visits/${appointment.id}/check-in/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(checkedIn.status, "checked_in");
  assert.ok(checkedIn.checked_in_at);
  assert.ok(checkedIn.check_in_undo_until);

  const assistantQueue = await demoApiRequest("/api/visits/queue/", {
    staffToken: assistant.session_token,
  });
  const doctorQueue = await demoApiRequest("/api/visits/queue/", {
    staffToken: doctor.session_token,
  });
  assert.equal(assistantQueue.queue[0].queue_position, 1);
  assert.equal(assistantQueue.queue[0].patient.phone_e164, "+989121234567");
  assert.equal("phone_e164" in doctorQueue.queue[0].patient, false);

  await assert.rejects(
    demoApiRequest(`/api/visits/${appointment.id}/`, {
      method: "PATCH",
      staffToken: assistant.session_token,
      data: { date: shiftedDate(1) },
    }),
    (error) => error.status === 400 && Boolean(error.payload.date),
  );

  const corrected = await demoApiRequest(`/api/visits/${appointment.id}/`, {
    method: "PATCH",
    staffToken: assistant.session_token,
    data: { scheduled_time: "11:45", reason: "Corrected" },
  });
  assert.equal(corrected.scheduled_time, "11:45:00");
  assert.equal(corrected.reason, "Corrected");

  const undone = await demoApiRequest(`/api/visits/${appointment.id}/undo-check-in/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(undone.status, "planned");
  assert.equal(undone.checked_in_at, null);
  assert.equal((await demoApiRequest("/api/visits/queue/", { staffToken: assistant.session_token })).queue.length, 0);

  await demoApiRequest(`/api/visits/${appointment.id}/check-in/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  const deleted = await demoApiRequest(`/api/visits/${appointment.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });
  assert.equal(deleted.code, "appointment_deleted");
  assert.equal((await demoApiRequest(`/api/visits/?date=${localDateValue()}`, { staffToken: assistant.session_token })).visits.length, 0);

  const undoneWhileDeleted = await demoApiRequest(`/api/visits/${appointment.id}/undo-check-in/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(undoneWhileDeleted.status, "planned");

  const restoredPlanned = await demoApiRequest(`/api/visits/${appointment.id}/undo-delete/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(restoredPlanned.status, "planned");
  assert.equal((await demoApiRequest("/api/visits/queue/", { staffToken: assistant.session_token })).queue.length, 0);

  await demoApiRequest(`/api/visits/${appointment.id}/check-in/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  await demoApiRequest(`/api/visits/${appointment.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });
  const restoredCheckedIn = await demoApiRequest(`/api/visits/${appointment.id}/undo-delete/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(restoredCheckedIn.status, "checked_in");
  assert.equal((await demoApiRequest("/api/visits/queue/", { staffToken: assistant.session_token })).queue.length, 1);
});

test("browser demo migrates legacy stored visits and supports Patient delete Undo", async () => {
  localStorage.clear();
  const { assistant } = await authenticatedDemo();
  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: patientData,
  });

  const stored = JSON.parse(localStorage.getItem("health-hub.demo-store.v1"));
  stored.visits.push({
    id: crypto.randomUUID(),
    clinic_id: stored.clinic.id,
    patient_id: patient.id,
    visit_type: "legacy",
    date: shiftedDate(-2),
    scheduled_time: null,
    reason: "",
    patient_full_name_snapshot: patient.full_name,
    patient_gender_snapshot: patient.gender,
    patient_phone_snapshot: patient.phone_e164,
    patient_date_of_birth_snapshot: patient.date_of_birth,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  localStorage.setItem("health-hub.demo-store.v1", JSON.stringify(stored));

  const history = await demoApiRequest(`/api/visits/?patient=${patient.id}`, {
    staffToken: assistant.session_token,
  });
  assert.equal(history.visits.length, 1);
  assert.ok(history.visits[0].scheduled_time);
  assert.equal("visit_type" in history.visits[0], false);

  const deletedPatient = await demoApiRequest(`/api/patients/${patient.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });
  assert.equal(deletedPatient.code, "patient_deleted");

  const restoredPatient = await demoApiRequest(`/api/patients/${patient.id}/undo-delete/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(restoredPatient.id, patient.id);
});
