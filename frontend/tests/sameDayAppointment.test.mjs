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

function shiftedDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

async function authenticatedAssistant() {
  await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: {
      name: "North Clinic",
      email: "clinic@example.com",
      phone: "+33 1 00 00 00 00",
    },
  });
  return demoApiRequest("/api/staff/register/", {
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
}

async function createPatient(staffToken) {
  return demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken,
    data: {
      full_name: "Sara Ahmadi",
      gender: "Woman",
      country_calling_code: "+98",
      phone_number: "09121234567",
      date_of_birth: "1994-05-11",
      patient_note: "",
    },
  });
}

async function createAppointment(staffToken, patientId, date, time) {
  return demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken,
    data: {
      patient_id: patientId,
      date,
      scheduled_time: time,
      reason: "Review",
    },
  });
}

test("browser demo blocks duplicate same-day creation and conflicting edits", async () => {
  localStorage.clear();
  const assistant = await authenticatedAssistant();
  const patient = await createPatient(assistant.session_token);
  const firstDate = shiftedDate(1);
  const secondDate = shiftedDate(2);
  const first = await createAppointment(
    assistant.session_token,
    patient.id,
    firstDate,
    "10:00",
  );

  await assert.rejects(
    createAppointment(
      assistant.session_token,
      patient.id,
      firstDate,
      "14:00",
    ),
    (error) => (
      error.status === 409
      && error.payload.code === "same_day_appointment_exists"
      && error.payload.appointment.id === first.id
      && error.payload.recently_deleted === false
    ),
  );

  const second = await createAppointment(
    assistant.session_token,
    patient.id,
    secondDate,
    "11:00",
  );
  await assert.rejects(
    demoApiRequest(`/api/visits/${second.id}/`, {
      method: "PATCH",
      staffToken: assistant.session_token,
      data: { date: firstDate },
    }),
    (error) => (
      error.status === 409
      && error.payload.code === "same_day_appointment_exists"
      && error.payload.appointment.id === first.id
    ),
  );
});

test("browser demo reserves a just-deleted Patient date for five seconds", async () => {
  localStorage.clear();
  const assistant = await authenticatedAssistant();
  const patient = await createPatient(assistant.session_token);
  const appointmentDate = shiftedDate(1);
  const first = await createAppointment(
    assistant.session_token,
    patient.id,
    appointmentDate,
    "10:00",
  );

  await demoApiRequest(`/api/visits/${first.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });

  await assert.rejects(
    createAppointment(
      assistant.session_token,
      patient.id,
      appointmentDate,
      "12:00",
    ),
    (error) => (
      error.status === 409
      && error.payload.code === "same_day_appointment_exists"
      && error.payload.appointment.id === first.id
      && error.payload.recently_deleted === true
    ),
  );

  const key = "health-hub.demo-store.v1";
  const store = JSON.parse(localStorage.getItem(key));
  const deleted = store.visits.find((visit) => visit.id === first.id);
  deleted.deleted_at = new Date(Date.now() - 6_000).toISOString();
  localStorage.setItem(key, JSON.stringify(store));

  const replacement = await createAppointment(
    assistant.session_token,
    patient.id,
    appointmentDate,
    "12:00",
  );
  assert.equal(replacement.date, appointmentDate);
});
