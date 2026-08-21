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
const { clearActiveTrustedDevice, rememberTrustedDevice, trustedDeviceTokenForIdentity } = await import("../src/deviceCredentials.js");

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
      password: "Strong-clinic-password-123",
      password_confirm: "Strong-clinic-password-123",
    },
  });
  await verifyContact(registered.session_token, "email");
  const verified = await verifyContact(registered.session_token, "phone");
  return { registered, verified };
}

async function createVerifiedAssistant({
  email = "assistant@example.com",
  phone = "+33987654321",
} = {}) {
  const registered = await demoPhase8ApiRequest("/api/staff/register/", {
    method: "POST",
    data: {
      role: "assistant",
      first_name: "Demo",
      last_name: "Assistant",
      email,
      phone,
      password: "Strong-clinic-password-123",
      password_confirm: "Strong-clinic-password-123",
    },
  });
  await verifyContact(registered.session_token, "email");
  await verifyContact(registered.session_token, "phone");
  return registered;
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

test("browser onboarding contact correction preserves the other verification state and enforces resend timing", async () => {
  localStorage.clear();
  const registered = await demoPhase8ApiRequest("/api/staff/register/", {
    method: "POST",
    data: {
      role: "assistant",
      first_name: "Demo",
      last_name: "Assistant",
      email: "mistyped@example.com",
      phone: "+33123456789",
      password: "Strong-clinic-password-123",
      password_confirm: "Strong-clinic-password-123",
    },
  });
  const token = registered.session_token;
  const firstRequest = await demoPhase8ApiRequest("/api/staff/verify/email/request/", { method: "POST", staffToken: token });
  assert.equal(firstRequest.resend_after_seconds, 60);
  assert.match(firstRequest.resend_available_at, /^\d{4}-\d{2}-\d{2}T/);
  const restored = await demoPhase8ApiRequest("/api/staff/verification-state/", { staffToken: token });
  assert.equal(restored.email.development_code, firstRequest.development_code);
  assert.equal(restored.email.channel, "email");
  assert.ok(restored.email.resend_after_seconds > 0);
  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/verify/email/confirm/", {
      method: "POST",
      staffToken: token,
      data: { code: firstRequest.development_code.slice(0, 5) },
    }),
    (error) => error?.payload?.detail === "Verification code is invalid or expired.",
  );
  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/verify/email/request/", { method: "POST", staffToken: token }),
    (error) => error?.payload?.detail === "Wait before requesting another verification code.",
  );
  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/verification-contact/", {
      method: "PATCH",
      staffToken: token,
      data: { kind: "email", value: "corrected@example.com", current_password: "wrong" },
    }),
    (error) => error.status === 403,
  );
  const corrected = await demoPhase8ApiRequest("/api/staff/verification-contact/", {
    method: "PATCH",
    staffToken: token,
    data: { kind: "email", value: "corrected@example.com", current_password: "Strong-clinic-password-123" },
  });
  assert.equal(corrected.user.email, "corrected@example.com");
  assert.equal(corrected.user.email_verified, false);
  assert.equal(corrected.user.phone_verified, false);
  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/verify/email/confirm/", {
      method: "POST",
      staffToken: token,
      data: { code: firstRequest.development_code },
    }),
    (error) => error?.payload?.detail === "Verification code is invalid or expired.",
  );

  const newEmailRequest = await demoPhase8ApiRequest("/api/staff/verify/email/request/", { method: "POST", staffToken: token });
  const emailVerified = await demoPhase8ApiRequest("/api/staff/verify/email/confirm/", { method: "POST", staffToken: token, data: { code: newEmailRequest.development_code } });
  assert.equal(emailVerified.user.email_verified, true);
  const phoneCorrected = await demoPhase8ApiRequest("/api/staff/verification-contact/", {
    method: "PATCH",
    staffToken: token,
    data: { kind: "phone", value: "+33987654321", current_password: "Strong-clinic-password-123" },
  });
  assert.equal(phoneCorrected.user.email_verified, true);
  assert.equal(phoneCorrected.user.phone_verified, false);
});

test("browser pending contact replacement restores and cancellation consumes its code", async () => {
  localStorage.clear();
  const { registered } = await createVerifiedDoctor();
  const requested = await demoPhase8ApiRequest("/api/staff/email/change/request/", {
    method: "POST",
    staffToken: registered.session_token,
    data: { value: "replacement@example.com", current_password: "Strong-clinic-password-123" },
  });
  const restored = await demoPhase8ApiRequest("/api/staff/verification-state/", {
    staffToken: registered.session_token,
  });
  assert.equal(restored.email_change.pending_value, "replacement@example.com");
  assert.equal(restored.email_change.development_code, requested.development_code);

  const cancelled = await demoPhase8ApiRequest("/api/staff/email/change/cancel/", {
    method: "POST",
    staffToken: registered.session_token,
  });
  assert.equal(cancelled.user.email, "doctor@example.com");
  const cleared = await demoPhase8ApiRequest("/api/staff/verification-state/", {
    staffToken: registered.session_token,
  });
  assert.equal(cleared.email_change, null);
  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/email/change/confirm/", {
      method: "POST",
      staffToken: registered.session_token,
      data: { code: requested.development_code },
    }),
    (error) => error?.payload?.detail === "Verification code is invalid or expired.",
  );
});

test("browser registration enforces the displayed personal-information password rule", async () => {
  localStorage.clear();
  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/register/", {
      method: "POST",
      data: {
        role: "doctor",
        first_name: "Demo",
        last_name: "Doctor",
        email: "personal-password@example.com",
        phone: "+33111111111",
        password: "Strong-demo-password-123",
        password_confirm: "Strong-demo-password-123",
      },
    }),
    (error) => error?.payload?.password?.[0] === "The password is too similar to your personal information.",
  );
});

test("browser password change and recovery reuse exact-code and personal-information rules", async () => {
  localStorage.clear();
  const { registered } = await createVerifiedDoctor();
  const requested = await demoPhase8ApiRequest("/api/staff/password/change/request/", {
    method: "POST",
    staffToken: registered.session_token,
    data: { channel: "email" },
  });
  const restored = await demoPhase8ApiRequest("/api/staff/verification-state/", {
    staffToken: registered.session_token,
  });
  assert.equal(restored.password_change.development_code, requested.development_code);

  await assert.rejects(
    demoPhase8ApiRequest("/api/staff/password/change/confirm/", {
      method: "POST",
      staffToken: registered.session_token,
      data: {
        code: requested.development_code,
        password: "Strong-doctor-password-456",
        password_confirm: "Strong-doctor-password-456",
      },
    }),
    (error) => error?.payload?.password?.[0] === "The password is too similar to your personal information.",
  );
  await demoPhase8ApiRequest("/api/staff/password/change/confirm/", {
    method: "POST",
    staffToken: registered.session_token,
    data: {
      code: requested.development_code,
      password: "Strong-clinic-password-456",
      password_confirm: "Strong-clinic-password-456",
    },
  });

  const recoveryRequested = await demoPhase8ApiRequest("/api/recovery/request/", {
    method: "POST",
    data: { identity: "doctor@example.com", channel: "email" },
  });
  const recoveryConfirmed = await demoPhase8ApiRequest("/api/recovery/confirm/", {
    method: "POST",
    data: { identity: "doctor@example.com", code: recoveryRequested.development_code },
  });
  await assert.rejects(
    demoPhase8ApiRequest("/api/recovery/reset/", {
      method: "POST",
      data: {
        recovery_token: recoveryConfirmed.recovery_token,
        password: "Strong-doctor-password-789",
        password_confirm: "Strong-doctor-password-789",
      },
    }),
    (error) => error?.payload?.password?.[0] === "The password is too similar to your personal information.",
  );
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
      password: "Strong-clinic-password-123",
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
        password: "Strong-clinic-password-123",
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
        password: "Strong-clinic-password-123",
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

test("browser Assistant setup claim is idempotent and enters the workspace", async () => {
  localStorage.clear();
  const { registered: doctor } = await createVerifiedDoctor();
  const clinic = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { name: "Assistant Clinic", timezone: "Europe/Paris" },
  });
  const setup = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { replace_existing: false },
  });
  const assistant = await createVerifiedAssistant();

  const first = await demoPhase8ApiRequest("/api/clinic/assistant/setup/claim/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: { code: setup.setup_code },
  });
  const retry = await demoPhase8ApiRequest("/api/clinic/assistant/setup/claim/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: { code: setup.setup_code },
  });

  assert.equal(first.user.workspace_role, "assistant");
  assert.equal(first.user.clinic.id, clinic.clinic.id);
  assert.equal(retry.membership.id, first.membership.id);
  assert.equal(retry.user.workspace_role, "assistant");
  assert.equal(retry.user.memberships.length, 1);

  const otherAssistant = await createVerifiedAssistant({
    email: "other-assistant@example.com",
    phone: "+33987654320",
  });
  await assert.rejects(
    demoPhase8ApiRequest("/api/clinic/assistant/setup/claim/", {
      method: "POST",
      staffToken: otherAssistant.session_token,
      data: { code: setup.setup_code },
    }),
    (error) => error.status === 409
      && error.payload?.detail === "The Assistant slot is already filled.",
  );
});

test("browser Assistant setup status hides plaintext and rotation invalidates the previous code", async () => {
  localStorage.clear();
  const { registered: doctor } = await createVerifiedDoctor();
  await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { name: "Rotation Clinic", timezone: "Europe/Paris" },
  });

  const first = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { replace_existing: false },
  });
  const statusBeforeRotation = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    staffToken: doctor.session_token,
  });
  assert.equal(statusBeforeRotation.active_setup.expires_at, first.active_setup.expires_at);
  assert.equal(Object.hasOwn(statusBeforeRotation, "setup_code"), false);

  const replacement = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { replace_existing: false },
  });
  await assert.rejects(
    demoPhase8ApiRequest("/api/clinic/assistant/setup/info/", {
      method: "POST",
      data: { code: first.setup_code },
    }),
    (error) => error.status === 400,
  );

  const assistant = await createVerifiedAssistant();
  await demoPhase8ApiRequest("/api/clinic/assistant/setup/claim/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: { code: replacement.setup_code.toLowerCase() },
  });
  const statusAfterClaim = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    staffToken: doctor.session_token,
  });
  assert.equal(statusAfterClaim.active_setup, null);
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
    data: { role: "doctor", identity: "doctor@example.com", password: "Strong-clinic-password-123" },
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

test("alternating Doctor and Assistant accounts reuses each account device without duplicates", async () => {
  localStorage.clear();
  const { registered: doctor } = await createVerifiedDoctor();
  const clinic = await demoPhase8ApiRequest("/api/clinics/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { name: "Shared Browser Clinic", timezone: "Europe/Paris" },
  });
  rememberTrustedDevice(clinic.user, clinic.device_token);

  const setup = await demoPhase8ApiRequest("/api/clinic/assistant/setup/", {
    method: "POST",
    staffToken: doctor.session_token,
    data: { replace_existing: false },
  });
  const assistant = await createVerifiedAssistant();
  const joined = await demoPhase8ApiRequest("/api/clinic/assistant/setup/claim/", {
    method: "POST",
    staffToken: assistant.session_token,
    data: { code: setup.setup_code },
  });
  rememberTrustedDevice(joined.user, joined.device_token);
  clearActiveTrustedDevice();

  const doctorLogin = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    deviceToken: trustedDeviceTokenForIdentity("doctor", "doctor@example.com"),
    data: { role: "doctor", identity: "doctor@example.com", password: "Strong-clinic-password-123" },
  });
  assert.equal(doctorLogin.user.device_trusted, true);
  const assistantLogin = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    deviceToken: trustedDeviceTokenForIdentity("assistant", "+33987654321"),
    data: { role: "assistant", identity: "+33987654321", password: "Strong-clinic-password-123" },
  });
  assert.equal(assistantLogin.user.device_trusted, true);

  const doctorAgain = await demoPhase8ApiRequest("/api/staff/login/", {
    method: "POST",
    deviceToken: trustedDeviceTokenForIdentity("doctor", "doctor@example.com"),
    data: { role: "doctor", identity: "doctor@example.com", password: "Strong-clinic-password-123" },
  });
  assert.equal(doctorAgain.user.device_trusted, true);
  const authStore = JSON.parse(localStorage.getItem("health-hub.demo-auth.v2"));
  assert.equal(authStore.devices.filter((device) => device.user_id === doctor.user.id).length, 1);
  assert.equal(authStore.devices.filter((device) => device.user_id === assistant.user.id).length, 1);
});
