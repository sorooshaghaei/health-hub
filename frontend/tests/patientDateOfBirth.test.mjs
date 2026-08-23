import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { demoApiRequest } from "../src/demoApi.js";
import {
  PATIENT_DATE_OF_BIRTH_FUTURE_ERROR,
  validatePatientDateOfBirth,
} from "../src/patientDateOfBirth.js";

const storage = new Map();

globalThis.localStorage = {
  getItem(key) { return storage.get(key) ?? null; },
  setItem(key, value) { storage.set(key, value); },
  removeItem(key) { storage.delete(key); },
  clear() { storage.clear(); },
};

function nextDate(value) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function assistantDemo() {
  const clinic = await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: { name: "North Clinic", email: "clinic@example.com", phone: "+33 1 00 00 00 00" },
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
  return { clinic: clinic.clinic, assistant };
}

test("frontend validation rejects dates after clinic today", () => {
  assert.doesNotThrow(() => validatePatientDateOfBirth("2026-08-23", "2026-08-23"));
  assert.doesNotThrow(() => validatePatientDateOfBirth("", "2026-08-23"));
  assert.throws(
    () => validatePatientDateOfBirth("2026-08-24", "2026-08-23"),
    new RegExp(PATIENT_DATE_OF_BIRTH_FUTURE_ERROR.replace(".", "\\.")),
  );
});

test("Patient forms expose clinic today as the optional birth-date maximum", async () => {
  const patientForm = await readFile(new URL("../src/patientForm.jsx", import.meta.url), "utf8");
  const visitForm = await readFile(new URL("../src/VisitForm.jsx", import.meta.url), "utf8");

  assert.match(patientForm, /label="Date of birth \(optional\)"[\s\S]*?max=\{maxDate\}/);
  assert.match(patientForm, /<PatientFields form=\{form\} onChange=\{update\} maxDate=\{clinicToday\}/);
  assert.match(visitForm, /<PatientFields form=\{patientDraft\} onChange=\{updatePatientDraft\} maxDate=\{clinicToday\}/);
});

test("browser demo rejects future birth dates for create, edit, and inline appointment creation", async () => {
  localStorage.clear();
  const { clinic, assistant } = await assistantDemo();
  const clinicToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: clinic.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const futureDate = nextDate(clinicToday);
  const basePatient = {
    full_name: "Sara Ahmadi",
    gender: "Woman",
    country_calling_code: "+98",
    phone_number: "09121234567",
    patient_note: "",
  };

  await assert.rejects(
    demoApiRequest("/api/patients/", {
      method: "POST",
      staffToken: assistant.session_token,
      data: { ...basePatient, date_of_birth: futureDate },
    }),
    (error) => error.payload.date_of_birth[0] === PATIENT_DATE_OF_BIRTH_FUTURE_ERROR,
  );

  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: { ...basePatient, date_of_birth: null },
  });
  await assert.rejects(
    demoApiRequest(`/api/patients/${patient.id}/`, {
      method: "PATCH",
      staffToken: assistant.session_token,
      data: { date_of_birth: futureDate },
    }),
    (error) => error.payload.date_of_birth[0] === PATIENT_DATE_OF_BIRTH_FUTURE_ERROR,
  );
  await assert.rejects(
    demoApiRequest("/api/visits/", {
      method: "POST",
      staffToken: assistant.session_token,
      data: {
        date: clinicToday,
        scheduled_time: "12:15",
        reason: "First appointment",
        new_patient: {
          ...basePatient,
          full_name: "Inline Patient",
          phone_number: "09125556677",
          date_of_birth: futureDate,
        },
      },
    }),
    (error) => error.payload.date_of_birth[0] === PATIENT_DATE_OF_BIRTH_FUTURE_ERROR,
  );
  const patients = await demoApiRequest("/api/patients/", { staffToken: assistant.session_token });
  assert.deepEqual(patients.patients.map((item) => item.id), [patient.id]);
});
