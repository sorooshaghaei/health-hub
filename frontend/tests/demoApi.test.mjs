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
  return { clinic, assistant, doctor };
}

const patientData = {
  full_name: "Sara Ahmadi",
  gender: "Woman",
  country_calling_code: "+98",
  phone_number: "09121234567",
  date_of_birth: "1994-05-11",
  patient_note: "",
};

test("browser demo preserves clinic, staff, and Patient behavior", async () => {
  localStorage.clear();
  const { clinic, assistant, doctor } = await authenticatedDemo();

  assert.equal(clinic.clinic.email, "clinic@example.com");
  assert.equal(assistant.user.role, "assistant");
  assert.equal(doctor.user.is_clinic_admin, true);

  const stored = JSON.parse(localStorage.getItem("health-hub.demo-store.v1"));
  assert.notEqual(stored.clinic.password_hash, clinicData.password);
  assert.equal(stored.clinic.password_hash.length, 64);

  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: patientData,
  });
  assert.equal(patient.phone_e164, "+989121234567");

  const search = await demoApiRequest("/api/patients/?search=9121234567", {
    staffToken: doctor.session_token,
  });
  assert.equal(search.patients[0].id, patient.id);

  await assert.rejects(
    demoApiRequest("/api/patients/", {
      method: "POST",
      staffToken: assistant.session_token,
      data: patientData,
    }),
    (error) => error.status === 409 && error.payload.code === "possible_duplicate",
  );

  const me = await demoApiRequest("/api/staff/me/", {
    staffToken: doctor.session_token,
  });
  assert.equal(me.user.username, "doctor.one");

  await demoApiRequest("/api/staff/logout/", {
    method: "POST",
    staffToken: doctor.session_token,
  });
  await assert.rejects(
    demoApiRequest("/api/staff/me/", { staffToken: doctor.session_token }),
    (error) => error.status === 401,
  );
});

test("browser demo mirrors Phase 2 appointments, walk-ins, inline Patients, history, and removal rules", async () => {
  localStorage.clear();
  const { assistant, doctor } = await authenticatedDemo();

  const patient = await demoApiRequest("/api/patients/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: patientData,
  });

  const futureDate = shiftedDate(3);
  const appointment = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      visit_type: "appointment",
      patient_id: patient.id,
      date: futureDate,
      scheduled_time: "10:30",
      reason: "Review",
    },
  });
  assert.equal(appointment.patient.full_name, "Sara Ahmadi");
  assert.equal(appointment.scheduled_time, "10:30:00");
  assert.equal(appointment.can_delete, true);

  const repeated = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      visit_type: "appointment",
      patient_id: patient.id,
      date: futureDate,
      scheduled_time: "15:00",
      reason: "",
    },
  });
  assert.notEqual(repeated.id, appointment.id);

  const walkIn = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      visit_type: "walk_in",
      patient_id: patient.id,
      date: "2040-01-01",
      scheduled_time: "18:00",
      reason: "Ignored",
    },
  });
  assert.equal(walkIn.date, localDateValue());
  assert.equal(walkIn.scheduled_time, null);
  assert.equal(walkIn.reason, "");
  assert.equal(walkIn.can_delete, false);

  const inline = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      visit_type: "appointment",
      date: shiftedDate(4),
      scheduled_time: "12:15",
      reason: "First Visit",
      new_patient: {
        full_name: "Ali Moradi",
        gender: "Man",
        country_calling_code: "+98",
        phone_number: "09123334455",
        date_of_birth: null,
        patient_note: "",
      },
    },
  });
  assert.equal(inline.patient.full_name, "Ali Moradi");

  await assert.rejects(
    demoApiRequest("/api/visits/", {
      method: "POST",
      staffToken: assistant.session_token,
      data: {
        visit_type: "appointment",
        date: shiftedDate(5),
        scheduled_time: "09:00",
        reason: "",
        new_patient: patientData,
      },
    }),
    (error) => error.status === 409 && error.payload.matches[0].id === patient.id,
  );

  const day = await demoApiRequest(`/api/visits/?date=${futureDate}`, {
    staffToken: doctor.session_token,
  });
  assert.equal(day.visits.length, 2);

  const history = await demoApiRequest(`/api/visits/?patient=${patient.id}`, {
    staffToken: doctor.session_token,
  });
  assert.equal(history.visits.length, 3);

  const past = await demoApiRequest("/api/visits/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: {
      visit_type: "appointment",
      patient_id: patient.id,
      date: shiftedDate(-2),
      scheduled_time: "08:00",
      reason: "Original",
    },
  });
  const editedPast = await demoApiRequest(`/api/visits/${past.id}/`, {
    method: "PATCH",
    staffToken: doctor.session_token,
    data: { reason: "Corrected" },
  });
  assert.equal(editedPast.reason, "Corrected");

  await assert.rejects(
    demoApiRequest(`/api/visits/${past.id}/`, {
      method: "DELETE",
      staffToken: assistant.session_token,
    }),
    (error) => error.status === 400 && error.payload.code === "visit_not_future",
  );

  await assert.rejects(
    demoApiRequest(`/api/patients/${patient.id}/`, {
      method: "DELETE",
      staffToken: assistant.session_token,
    }),
    (error) => error.status === 409 && error.payload.code === "future_visits_exist",
  );

  await demoApiRequest(`/api/visits/${appointment.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });
  await demoApiRequest(`/api/visits/${repeated.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });
  await demoApiRequest(`/api/patients/${patient.id}/`, {
    method: "DELETE",
    staffToken: assistant.session_token,
  });

  const stored = JSON.parse(localStorage.getItem("health-hub.demo-store.v1"));
  assert.equal(stored.patients.find((item) => item.id === patient.id).deleted_at !== null, true);
  assert.equal(stored.visits.find((item) => item.id === past.id).patient_full_name_snapshot, "Sara Ahmadi");
});
