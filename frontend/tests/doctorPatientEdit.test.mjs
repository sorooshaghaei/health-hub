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

async function authenticatedDemo() {
  const clinic = await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: {
      name: "North Clinic",
      email: "clinic@example.com",
      phone: "+33 1 00 00 00 00",
      password: "clinic-password-123",
      password_confirm: "clinic-password-123",
    },
  });
  const assistant = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    clinicToken: clinic.clinic_access_token,
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
    clinicToken: clinic.clinic_access_token,
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

test("Doctor workspace may edit Patient fields but may not create or delete Patients", async () => {
  localStorage.clear();
  const { assistant, doctor } = await authenticatedDemo();
  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      full_name: "Sara Ahmadi",
      gender: "Woman",
      country_calling_code: "+98",
      phone_number: "09121234567",
      date_of_birth: null,
      patient_note: "",
    },
  });

  const edited = await demoApiRequest(`/api/patients/${patient.id}/`, {
    method: "PATCH",
    staffToken: doctor.session_token,
    data: {
      full_name: "Sara Mohammadi",
      gender: "Man",
      country_calling_code: "+33",
      phone_number: "0612345678",
      date_of_birth: "1991-07-10",
      patient_note: "Call after lab results arrive.",
    },
  });

  assert.equal(edited.full_name, "Sara Mohammadi");
  assert.equal(edited.gender, "Man");
  assert.equal(edited.country_calling_code, "+33");
  assert.equal(edited.phone_number, "612345678");
  assert.equal(edited.phone_e164, "+33612345678");
  assert.equal(edited.date_of_birth, "1991-07-10");
  assert.equal(edited.patient_note, "Call after lab results arrive.");

  await assert.rejects(
    demoApiRequest("/api/patients/", {
      method: "POST",
      staffToken: doctor.session_token,
      data: {
        full_name: "Another Patient",
        gender: "Woman",
        country_calling_code: "+98",
        phone_number: "09123334455",
      },
    }),
    (error) => error.status === 403,
  );

  await assert.rejects(
    demoApiRequest(`/api/patients/${patient.id}/`, {
      method: "DELETE",
      staffToken: doctor.session_token,
    }),
    (error) => error.status === 403,
  );
});
