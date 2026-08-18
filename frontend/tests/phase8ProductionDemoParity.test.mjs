import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
  assert.match(requested.development_code, /^\d{6}$/);
  return demoPhase8ApiRequest(`/api/staff/verify/${kind}/confirm/`, {
    method: "POST",
    staffToken,
    data: { code: requested.development_code },
  });
}

async function createVerifiedDoctor() {
  const registered = await demoPhase8ApiRequest("/api/staff/register/", {
    method: "POST",
    data: {
      role: "doctor",
      first_name: "Demo",
      last_name: "Doctor",
      email: "doctor@example.com",
      phone: "+33123456789",
      password: "Strong-demo-password-123",
      password_confirm: "Strong-demo-password-123",
    },
  });
  await verifyContact(registered.session_token, "email");
  const verified = await verifyContact(registered.session_token, "phone");
  return { registered, verified };
}

test("production and Pages have one shared final Phase 8 application UI", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const env = await readFile(new URL("../.env.demo", import.meta.url), "utf8");

  assert.match(app, /Choose your role/);
  assert.match(app, /label="Email or phone"/);
  assert.match(app, /role, \.\.\.form/);
  assert.match(app, /Verify your email and phone/);
  assert.match(app, /browser is trusted for your account across all of your clinics/);
  assert.doesNotMatch(app, /DemoApp/);
  assert.doesNotMatch(app, /DEMO_MODE\s*\?/);
  assert.match(env, /^VITE_DEMO_MODE=false$/m);
  assert.match(env, /^VITE_DEMO_API=true$/m);
});

test("browser Phase 8 uses permanent roles, account-first clinic creation, and global device trust", async () => {
  localStorage.clear();
  const { registered, verified } = await createVerifiedDoctor();

  assert.equal(registered.user.role, "doctor");
  assert.equal(registered.user.account_ready, false);
  assert.equal(verified.user.account_ready, true);
  assert.equal(verified.user.memberships.length, 0);
  assert.equal(verified.user.has_trusted_devices, false);

  const clinic = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: registered.session_token,
    data: { name: "Parity Clinic", timezone: "Europe/Paris" },
  });
  assert.equal(clinic.clinic.name, "Parity Clinic");
  assert.equal(clinic.clinic.timezone, "Europe/Paris");
  assert.ok(clinic.device_token);
  assert.equal(clinic.user.role, "doctor");
  assert.equal(clinic.user.workspace_role, "doctor");
  assert.equal(clinic.user.device_trusted, true);
  assert.equal(clinic.user.memberships[0].role, "doctor");

  await demoPhase8ApiRequest("/api/staff/logout/", {
    method: "POST",
    staffToken: registered.session_token,
  });

  const trustedLogin = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    deviceToken: clinic.device_token,
    data: {
      role: "doctor",
      identity: "+33123456789",
      password: "Strong-demo-password-123",
    },
  });
  assert.equal(trustedLogin.user.role, "doctor");
  assert.equal(trustedLogin.user.device_trusted, true);
  assert.equal(trustedLogin.user.has_trusted_devices, true);

  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/login/", {
      method: "POST",
      deviceToken: clinic.device_token,
      data: {
        role: "assistant",
        identity: "doctor@example.com",
        password: "Strong-demo-password-123",
      },
    }),
    (error) => error?.payload?.non_field_errors?.[0] === "Role, email/phone, or password is incorrect.",
  );

  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/login/", {
      method: "POST",
      data: {
        role: "doctor",
        username: "doctor@example.com",
        password: "Strong-demo-password-123",
      },
    }),
    (error) => error?.payload?.non_field_errors?.[0] === "Role, email/phone, or password is incorrect.",
  );

  const membership = trustedLogin.user.memberships[0];
  const adminWorkspace = await demoPhase8ApiRequest("/api/staff/select-clinic/", {
    method: "POST",
    staffToken: trustedLogin.session_token,
    data: { clinic_id: membership.clinic.id, workspace_role: "assistant" },
  });
  assert.equal(adminWorkspace.user.role, "doctor");
  assert.equal(adminWorkspace.user.workspace_role, "assistant");

  const patient = await demoPhase8ApiRequest("/api/patients/", {
    method: "POST",
    staffToken: trustedLogin.session_token,
    data: {
      full_name: "Demo Patient",
      gender: "Woman",
      country_calling_code: "+98",
      phone_number: "09121234567",
      date_of_birth: "1990-01-02",
      patient_note: "",
    },
  });
  assert.equal(patient.full_name, "Demo Patient");
});

test("new browser authorizes once and that trusted device works across Doctor clinics", async () => {
  localStorage.clear();
  const { registered } = await createVerifiedDoctor();
  const firstClinic = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: registered.session_token,
    data: { name: "First Clinic", timezone: "Europe/Paris" },
  });
  await demoPhase8ApiRequest("/api/staff/logout/", { method: "POST", staffToken: registered.session_token });

  const untrusted = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    data: { role: "doctor", identity: "doctor@example.com", password: "Strong-demo-password-123" },
  });
  assert.equal(untrusted.user.device_trusted, false);
  assert.equal(untrusted.user.has_trusted_devices, true);

  const requested = await demoPhase8ApiRequest("/api/devices/contact/request/", {
    method: "POST",
    staffToken: untrusted.session_token,
    data: { channel: "email" },
  });
  const authorized = await demoPhase8ApiRequest("/api/devices/contact/confirm/", {
    method: "POST",
    staffToken: untrusted.session_token,
    data: { code: requested.development_code },
  });
  assert.ok(authorized.device_token);
  assert.equal(authorized.user.device_trusted, true);

  const secondClinic = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: untrusted.session_token,
    data: { name: "Second Clinic", timezone: "Europe/Paris" },
  });
  assert.equal(secondClinic.user.memberships.length, 2);
  assert.equal(secondClinic.user.workspace_role, "doctor");
  assert.equal(secondClinic.user.device_trusted, true);

  const firstMembership = secondClinic.user.memberships.find((item) => item.clinic.id === firstClinic.clinic.id);
  const selected = await demoPhase8ApiRequest("/api/staff/select-clinic/", {
    method: "POST",
    staffToken: untrusted.session_token,
    data: { clinic_id: firstMembership.clinic.id, workspace_role: "doctor" },
  });
  assert.equal(selected.user.clinic.id, firstClinic.clinic.id);
  assert.equal(selected.user.device_trusted, true);
});