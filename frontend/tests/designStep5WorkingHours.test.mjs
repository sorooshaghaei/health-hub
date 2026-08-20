import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  suggestedAppointmentTimes,
  weekdayForDateValue,
  workingHoursForDate,
} from "../src/clinicWorkingHours.js";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const { demoPhase8ApiRequest } = await import("../src/demoPhase8Api.js");

async function verifyContact(staffToken, kind) {
  const requested = await demoPhase8ApiRequest(`/api/staff/verify/${kind}/request/`, {
    method: "POST",
    staffToken,
  });
  return demoPhase8ApiRequest(`/api/staff/verify/${kind}/confirm/`, {
    method: "POST",
    staffToken,
    data: { code: requested.development_code },
  });
}

async function registerVerified(role, email, phone) {
  const registered = await demoPhase8ApiRequest("/api/staff/register/", {
    method: "POST",
    data: {
      role,
      first_name: "Working",
      last_name: role === "doctor" ? "Doctor" : "Assistant",
      email,
      phone,
      password: "Strong-demo-password-123",
      password_confirm: "Strong-demo-password-123",
    },
  });
  await verifyContact(registered.session_token, "email");
  await verifyContact(registered.session_token, "phone");
  return registered;
}

test("weekly civil dates and time suggestions include both exact endpoints", () => {
  assert.equal(weekdayForDateValue("2026-08-17"), 0);
  assert.equal(weekdayForDateValue("2026-08-23"), 6);
  const hours = [{ weekday: 0, start_time: "10:05", end_time: "11:00" }];
  assert.deepEqual(workingHoursForDate(hours, "2026-08-17"), hours[0]);
  assert.equal(workingHoursForDate(hours, "2026-08-18"), null);
  assert.deepEqual(
    suggestedAppointmentTimes("10:05", "11:00"),
    ["10:05", "10:20", "10:35", "10:50", "11:00"],
  );
  assert.deepEqual(
    suggestedAppointmentTimes("10:00", "11:00"),
    ["10:00", "10:15", "10:30", "10:45", "11:00"],
  );
});

test("browser demo keeps Doctor writes idempotent and Assistant access read only", async () => {
  localStorage.clear();
  const doctor = await registerVerified("doctor", "working-doctor@example.com", "+33123456781");
  const created = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { name: "Working Clinic", timezone: "Europe/Paris" },
  });
  const clinicId = created.clinic.id;
  const endpoint = `/api/clinics/${clinicId}/working-hours/`;
  const empty = await demoPhase8ApiRequest(endpoint, { staffToken: doctor.session_token });
  assert.equal(empty.configured, false);

  const payload = {
    working_hours: [
      { weekday: 0, start_time: "09:00", end_time: "17:00" },
      { weekday: 4, start_time: "10:05", end_time: "13:00" },
    ],
  };
  await demoPhase8ApiRequest(endpoint, { method: "PUT", staffToken: doctor.session_token, data: payload });
  const repeated = await demoPhase8ApiRequest(endpoint, { method: "PUT", staffToken: doctor.session_token, data: payload });
  assert.deepEqual(repeated.working_hours, payload.working_hours);

  const setup = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { replace_existing: false },
  });
  await demoPhase8ApiRequest("/api/staff/leave-clinic/", { method: "POST", staffToken: doctor.session_token });
  assert.deepEqual((await demoPhase8ApiRequest(endpoint, { staffToken: doctor.session_token })).working_hours, payload.working_hours);

  const assistant = await registerVerified("assistant", "working-assistant@example.com", "+33123456782");
  await demoPhase8ApiRequest("/api/clinic/assistant/setup/claim/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: { code: setup.setup_code },
  });
  assert.deepEqual((await demoPhase8ApiRequest(endpoint, { staffToken: assistant.session_token })).working_hours, payload.working_hours);
  await assert.rejects(
    demoPhase8ApiRequest(endpoint, {
      method: "PUT",
      staffToken: assistant.session_token,
      data: { working_hours: [] },
    }),
    (error) => error.status === 403,
  );
});

test("Clinics and Appointment UI expose only the approved Design Step 5 controls", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const clinicHours = await readFile(new URL("../src/ClinicWorkingHours.jsx", import.meta.url), "utf8");
  const visitForm = await readFile(new URL("../src/VisitForm.jsx", import.meta.url), "utf8");

  assert.match(app, /WorkingHours/);
  assert.match(app, /Open clinic workspace/);
  assert.match(clinicHours, /Working days and hours/);
  assert.match(clinicHours, /Read only/);
  assert.match(visitForm, />Today</);
  assert.match(visitForm, /This is not a working day for this clinic\./);
  assert.match(visitForm, /Suggested appointment times/);
  assert.doesNotMatch(visitForm, /Tomorrow/);
});
