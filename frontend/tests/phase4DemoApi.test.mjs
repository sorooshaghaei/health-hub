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

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

async function authenticatedDemo() {
  await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: {
      name: "North Clinic",
      email: "clinic@example.com",
      phone: "+33 1 00 00 00 00",
    },
  });
  const assistant = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    data: {
      role: "assistant",
      username: "assistant.one",
      email: "assistant@example.com",
      first_name: "Test",
      last_name: "Assistant",
      password: "staff-password-123",
      password_confirm: "staff-password-123",
    },
  });
  const doctor = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    data: {
      role: "doctor",
      username: "doctor.one",
      email: "doctor@example.com",
      first_name: "Test",
      last_name: "Doctor",
      password: "staff-password-123",
      password_confirm: "staff-password-123",
    },
  });
  return { assistant, doctor };
}

async function createWaitingPatient(assistantToken, name, phone, time) {
  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistantToken,
    data: {
      full_name: name,
      gender: "Woman",
      country_calling_code: "+98",
      phone_number: phone,
      date_of_birth: "1994-05-11",
      patient_note: `Shared note for ${name}`,
    },
  });
  const appointment = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistantToken,
    data: {
      patient_id: patient.id,
      date: localDateValue(),
      scheduled_time: time,
      reason: "Review",
    },
  });
  return demoApiRequest(`/api/visits/${appointment.id}/check-in/`, {
    method: "POST",
    staffToken: assistantToken,
  });
}

function updateStore(mutator) {
  const key = "health-hub.demo-store.v1";
  const store = JSON.parse(localStorage.getItem(key));
  mutator(store);
  localStorage.setItem(key, JSON.stringify(store));
}

function makePendingCallAvailable() {
  updateStore((store) => {
    store.room_call.requested_at = new Date(Date.now() - 6_000).toISOString();
  });
}

test("room-ready call is hidden during Doctor Undo and persists with an empty queue", async () => {
  localStorage.clear();
  const { assistant, doctor } = await authenticatedDemo();

  const called = await demoApiRequest("/api/visits/room-ready/", {
    method: "POST",
    staffToken: doctor.session_token,
  });
  assert.equal(called.code, "room_ready");

  const assistantBefore = await demoApiRequest("/api/visits/room-state/", {
    staffToken: assistant.session_token,
  });
  assert.equal(assistantBefore.room_call, null);

  makePendingCallAvailable();
  const assistantAfter = await demoApiRequest("/api/visits/room-state/", {
    staffToken: assistant.session_token,
  });
  assert.equal(assistantAfter.room_call.available, true);
  assert.equal(assistantAfter.room_call.suggested_visit_id, null);
});

test("Assistant may choose another Patient and Undo restores queue order and room call", async () => {
  localStorage.clear();
  const { assistant, doctor } = await authenticatedDemo();
  const first = await createWaitingPatient(
    assistant.session_token,
    "First Patient",
    "09121234567",
    "09:00",
  );
  const chosen = await createWaitingPatient(
    assistant.session_token,
    "Chosen Patient",
    "09125556677",
    "08:00",
  );

  await demoApiRequest("/api/visits/room-ready/", {
    method: "POST",
    staffToken: doctor.session_token,
  });
  makePendingCallAvailable();

  const available = await demoApiRequest("/api/visits/room-state/", {
    staffToken: assistant.session_token,
  });
  assert.equal(available.room_call.suggested_visit_id, first.id);

  const sent = await demoApiRequest(`/api/visits/${chosen.id}/with-doctor/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(sent.status, "with_doctor");

  const queueAfterSend = await demoApiRequest("/api/visits/queue/", {
    staffToken: assistant.session_token,
  });
  assert.deepEqual(queueAfterSend.queue.map((item) => item.id), [first.id]);
  assert.equal(queueAfterSend.queue[0].queue_position, 1);

  const doctorState = await demoApiRequest("/api/visits/room-state/", {
    staffToken: doctor.session_token,
  });
  assert.equal(doctorState.current_visit.id, chosen.id);
  assert.equal(
    doctorState.current_visit.patient.patient_note,
    "Shared note for Chosen Patient",
  );

  const undone = await demoApiRequest(`/api/visits/${chosen.id}/undo-with-doctor/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });
  assert.equal(undone.status, "checked_in");

  const queueAfterUndo = await demoApiRequest("/api/visits/queue/", {
    staffToken: assistant.session_token,
  });
  assert.deepEqual(
    queueAfterUndo.queue.map((item) => item.id),
    [first.id, chosen.id],
  );
  const restoredCall = await demoApiRequest("/api/visits/room-state/", {
    staffToken: assistant.session_token,
  });
  assert.equal(restoredCall.room_call.available, true);
});

test("next Room ready finishes the current Patient and Doctor Undo restores them", async () => {
  localStorage.clear();
  const { assistant, doctor } = await authenticatedDemo();
  const current = await createWaitingPatient(
    assistant.session_token,
    "Current Patient",
    "09121234567",
    "09:00",
  );

  await demoApiRequest("/api/visits/room-ready/", {
    method: "POST",
    staffToken: doctor.session_token,
  });
  makePendingCallAvailable();
  await demoApiRequest(`/api/visits/${current.id}/with-doctor/`, {
    method: "POST",
    staffToken: assistant.session_token,
  });

  updateStore((store) => {
    const past = new Date(Date.now() - 6_000).toISOString();
    const visit = store.visits.find((item) => item.id === current.id);
    visit.with_doctor_at = past;
    store.room_call.consumed_at = past;
  });

  const readyAgain = await demoApiRequest("/api/visits/room-ready/", {
    method: "POST",
    staffToken: doctor.session_token,
  });
  assert.equal(readyAgain.previous_visit.patient.full_name, "Current Patient");
  const finished = await demoApiRequest(`/api/visits/${current.id}/`, {
    staffToken: assistant.session_token,
  });
  assert.equal(finished.status, "doctor_finished");

  await demoApiRequest("/api/visits/room-ready/undo/", {
    method: "POST",
    staffToken: doctor.session_token,
  });
  const restored = await demoApiRequest("/api/visits/room-state/", {
    staffToken: doctor.session_token,
  });
  assert.equal(restored.current_visit.id, current.id);
  assert.equal(restored.current_visit.status, "with_doctor");
  assert.equal(restored.room_call, null);
});
