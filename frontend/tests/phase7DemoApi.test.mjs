import assert from "node:assert/strict";
import test from "node:test";

import { demoApiRequest } from "../src/demoApi.js";

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
};

const password = "staff-password-123";

function staff(role) {
  return {
    role,
    username: `${role}.one`,
    email: `${role}@example.com`,
    first_name: "Test",
    last_name: role,
    password,
    password_confirm: password,
  };
}

async function sessions() {
  await demoApiRequest("/api/clinics/", {
    method: "POST",
    data: {
      name: "North Clinic",
      email: "clinic@example.com",
      phone: "+33 1 00 00 00 00",
    },
  });
  const doctor = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    data: staff("doctor"),
  });
  const assistant = await demoApiRequest("/api/staff/register/", {
    method: "POST",
    data: staff("assistant"),
  });
  const administrator = await demoApiRequest("/api/staff/login/", {
    method: "POST",
    data: { role: "assistant", username: "doctor.one", password },
  });
  return { doctor, assistant, administrator };
}

test("Phase 7 demo keeps one independent persistent scratchpad per account", async () => {
  localStorage.clear();
  const { doctor, assistant } = await sessions();
  const doctorText = "Call Suzi\nVisit the coffee shop\nMy husband called";
  const assistantText = "Prepare tomorrow's desk";

  await demoApiRequest("/api/staff/private-note/", {
    method: "PATCH",
    staffToken: doctor.session_token,
    data: { content: doctorText },
  });
  await demoApiRequest("/api/staff/private-note/", {
    method: "PATCH",
    staffToken: assistant.session_token,
    data: { content: assistantText },
  });

  assert.equal((await demoApiRequest("/api/staff/private-note/", {
    staffToken: doctor.session_token,
  })).content, doctorText);
  assert.equal((await demoApiRequest("/api/staff/private-note/", {
    staffToken: assistant.session_token,
  })).content, assistantText);

  assert.equal((await demoApiRequest("/api/staff/private-note/", {
    method: "PATCH",
    staffToken: assistant.session_token,
    data: { content: "" },
  })).content, "");
});

test("Phase 7 demo hides all private notes from Doctor administrator access", async () => {
  localStorage.clear();
  const { administrator } = await sessions();

  await assert.rejects(
    demoApiRequest("/api/staff/private-note/", {
      staffToken: administrator.session_token,
    }),
    (error) => error.status === 403,
  );
  await assert.rejects(
    demoApiRequest("/api/staff/private-note/", {
      method: "PATCH",
      staffToken: administrator.session_token,
      data: { content: "Must stay hidden" },
    }),
    (error) => error.status === 403,
  );
});
