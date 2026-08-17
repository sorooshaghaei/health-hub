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

test("production and Pages share the simplified Phase 8 sign-in UI", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  const env = await readFile(new URL("../.env.demo", import.meta.url), "utf8");

  assert.match(app, /function Landing\(\{ onSubmit, onPasskey, onNewClinic, onJoin, onRecovery \}\)/);
  assert.match(app, /title="Sign in"/);
  assert.match(app, /label="Email or phone"/);
  assert.match(app, /Have an Assistant setup code\?/);
  assert.doesNotMatch(app, /Your account first\. Your clinic second\./);
  assert.doesNotMatch(app, /DemoApp/);
  assert.doesNotMatch(app, /DEMO_MODE\s*\?/);
  assert.match(env, /^VITE_DEMO_MODE=false$/m);
  assert.match(env, /^VITE_DEMO_API=true$/m);
});

test("browser Phase 8 authentication accepts email or phone and has no username contract", async () => {
  localStorage.clear();

  const clinic = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    data: { name: "Parity Clinic" },
  });
  assert.equal(clinic.clinic.name, "Parity Clinic");
  assert.ok(clinic.device_token);

  const registered = await demoPhase8ApiRequest("/api/staff/register/", {
    method: "POST",
    deviceToken: clinic.device_token,
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

  assert.equal(registered.user.email, "doctor@example.com");
  assert.equal(Object.hasOwn(registered.user, "username"), false);
  assert.equal(registered.user.account_ready, false);
  assert.equal(registered.user.role, "doctor");

  const emailVerified = await verifyContact(registered.session_token, "email");
  assert.equal(emailVerified.user.email_verified, true);
  const phoneVerified = await verifyContact(registered.session_token, "phone");
  assert.equal(phoneVerified.user.phone_verified, true);
  assert.equal(phoneVerified.user.account_ready, true);

  await demoPhase8ApiRequest("/api/staff/logout/", {
    method: "POST",
    staffToken: registered.session_token,
  });

  const emailLogin = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    data: { identity: "doctor@example.com", password: "Strong-demo-password-123" },
  });
  assert.equal(emailLogin.user.email, "doctor@example.com");
  assert.equal(emailLogin.user.role, null);

  const phoneLogin = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    data: { identity: "+33123456789", password: "Strong-demo-password-123" },
  });
  assert.equal(phoneLogin.user.email, "doctor@example.com");

  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/login/", {
      method: "POST",
      data: { username: "doctor@example.com", password: "Strong-demo-password-123" },
    }),
    (error) => error?.payload?.non_field_errors?.[0] === "Email/phone or password is incorrect.",
  );

  const membership = emailLogin.user.memberships[0];
  const selected = await demoPhase8ApiRequest("/api/staff/select-clinic/", {
    method: "POST",
    staffToken: emailLogin.session_token,
    deviceToken: clinic.device_token,
    data: { clinic_id: membership.clinic.id, workspace_role: "assistant" },
  });
  assert.equal(selected.user.workspace_role, "assistant");

  const patient = await demoPhase8ApiRequest("/api/patients/", {
    method: "POST",
    staffToken: emailLogin.session_token,
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
