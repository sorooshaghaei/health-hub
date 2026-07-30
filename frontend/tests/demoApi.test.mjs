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

test("browser demo preserves the approved clinic and staff access flow", async () => {
  localStorage.clear();

  const clinic = await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: clinicData,
  });

  assert.equal(clinic.clinic.email, "clinic@example.com");
  assert.equal(clinic.roles.doctor.exists, false);
  assert.equal(clinic.roles.assistant.exists, false);

  const stored = JSON.parse(localStorage.getItem("health-hub.demo-store.v1"));
  assert.notEqual(stored.clinic.password_hash, clinicData.password);
  assert.equal(stored.clinic.password_hash.length, 64);

  const doctor = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    clinicToken: clinic.clinic_access_token,
    data: staffData("doctor"),
  });

  assert.equal(doctor.user.role, "doctor");
  assert.equal(doctor.user.is_clinic_admin, true);

  const assistant = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    clinicToken: clinic.clinic_access_token,
    data: staffData("assistant"),
  });

  assert.equal(assistant.user.role, "assistant");
  assert.equal(assistant.user.is_clinic_admin, false);

  await assert.rejects(
    demoApiRequest("/api/staff/register/", {
      method: "POST",
      clinicToken: clinic.clinic_access_token,
      data: {
        ...staffData("doctor"),
        username: "doctor.two",
        email: "doctor.two@example.com",
      },
    }),
    (error) => error.status === 409,
  );

  await assert.rejects(
    demoApiRequest("/api/staff/login/", {
      method: "POST",
      clinicToken: clinic.clinic_access_token,
      data: {
        role: "assistant",
        username: "doctor.one",
        password: "staff-password-123",
      },
    }),
    (error) => error.status === 400,
  );

  const currentDoctor = await demoApiRequest("/api/staff/me/", {
    staffToken: doctor.session_token,
  });
  assert.equal(currentDoctor.user.username, "doctor.one");

  await demoApiRequest("/api/staff/logout/", {
    method: "POST",
    staffToken: doctor.session_token,
  });

  await assert.rejects(
    demoApiRequest("/api/staff/me/", { staffToken: doctor.session_token }),
    (error) => error.status === 401,
  );

  const entered = await demoApiRequest("/api/clinics/enter/", {
    method: "POST",
    data: {
      email: "clinic@example.com",
      password: "clinic-password-123",
    },
  });

  assert.equal(entered.roles.doctor.exists, true);
  assert.equal(entered.roles.assistant.exists, true);

  await assert.rejects(
    demoApiRequest("/api/clinics/enter/", {
      method: "POST",
      data: { email: "clinic@example.com", password: "wrong-password" },
    }),
    (error) => error.status === 400,
  );
});
