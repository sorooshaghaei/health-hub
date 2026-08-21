import assert from "node:assert/strict";
import test from "node:test";

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

globalThis.localStorage = new MemoryStorage();

const {
  ACTIVE_DEVICE_TOKEN_KEY,
  clearActiveTrustedDevice,
  forgetTrustedDevice,
  refreshTrustedDeviceIdentity,
  rememberTrustedDevice,
  trustedDeviceTokenForIdentity,
} = await import("../src/deviceCredentials.js");

test("trusted browser credentials remain separate for Doctor and Assistant accounts", () => {
  localStorage.clear();
  const doctor = { id: "doctor-id", role: "doctor", email: "doctor@example.com", phone: "+33123456789" };
  const assistant = { id: "assistant-id", role: "assistant", email: "assistant@example.com", phone: "+33987654321" };

  rememberTrustedDevice(doctor, "doctor-device-token");
  clearActiveTrustedDevice();
  rememberTrustedDevice(assistant, "assistant-device-token");
  clearActiveTrustedDevice();

  assert.equal(trustedDeviceTokenForIdentity("doctor", "DOCTOR@example.com"), "doctor-device-token");
  assert.equal(trustedDeviceTokenForIdentity("doctor", "+33 1 23 45 67 89"), "doctor-device-token");
  assert.equal(trustedDeviceTokenForIdentity("assistant", "assistant@example.com"), "assistant-device-token");

  rememberTrustedDevice(doctor, trustedDeviceTokenForIdentity("doctor", doctor.email));
  assert.equal(localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY), "doctor-device-token");
  forgetTrustedDevice(assistant.id);
  assert.equal(localStorage.getItem(ACTIVE_DEVICE_TOKEN_KEY), "doctor-device-token");
});

test("contact updates refresh the account aliases without replacing its credential", () => {
  localStorage.clear();
  const account = { id: "doctor-id", role: "doctor", email: "old@example.com", phone: "+33123456789" };
  rememberTrustedDevice(account, "doctor-device-token");
  refreshTrustedDeviceIdentity({ ...account, email: "new@example.com" });

  assert.equal(trustedDeviceTokenForIdentity("doctor", "old@example.com"), null);
  assert.equal(trustedDeviceTokenForIdentity("doctor", "new@example.com"), "doctor-device-token");
});
