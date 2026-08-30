import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

const AUTH_STORE_KEY = "health-hub.demo-auth.v2";
const OPERATIONAL_STORE_KEY = "health-hub.demo-store.v1";
const STAFF_TOKEN_KEY = "health-hub.staff-token";
const ACTIVE_DEVICE_TOKEN_KEY = "health-hub.active-device-token";
const DEVICE_REGISTRY_KEY = "health-hub.trusted-device-credentials.v1";

const PASSWORD = "ClinicPass42!";
const PASSWORD_HASH = createHash("sha256").update(PASSWORD).digest("hex");

const IDS = {
  doctor: "11111111-1111-4111-8111-111111111111",
  assistant: "22222222-2222-4222-8222-222222222222",
  clinic: "33333333-3333-4333-8333-333333333333",
  doctorMembership: "44444444-4444-4444-8444-444444444444",
  assistantMembership: "55555555-5555-4555-8555-555555555555",
  doctorDevice: "66666666-6666-4666-8666-666666666666",
  assistantDevice: "77777777-7777-4777-8777-777777777777",
  task: "88888888-8888-4888-8888-888888888888",
  comment: "99999999-9999-4999-8999-999999999999",
};

const doctor = {
  id: IDS.doctor,
  role: "doctor",
  first_name: "Doctor",
  last_name: "Example",
  email: "doctor@example.test",
  phone: "+12025550101",
  password_hash: PASSWORD_HASH,
  email_verified_at: "2026-08-01T09:00:00.000Z",
  phone_verified_at: "2026-08-01T09:01:00.000Z",
  private_note: "",
  is_active: true,
  dormant_since: null,
  anonymized_at: null,
  created_at: "2026-08-01T09:00:00.000Z",
};

const assistant = {
  id: IDS.assistant,
  role: "assistant",
  first_name: "Assistant",
  last_name: "Example",
  email: "assistant@example.test",
  phone: "+12025550102",
  password_hash: PASSWORD_HASH,
  email_verified_at: "2026-08-01T09:02:00.000Z",
  phone_verified_at: "2026-08-01T09:03:00.000Z",
  private_note: "",
  is_active: true,
  dormant_since: null,
  anonymized_at: null,
  created_at: "2026-08-01T09:02:00.000Z",
};

const clinic = {
  id: IDS.clinic,
  name: "Rendered Test Clinic",
  timezone: "UTC",
  owner_doctor_id: IDS.doctor,
  working_hours: [],
  created_at: "2026-08-01T09:04:00.000Z",
};

const memberships = [
  { id: IDS.doctorMembership, user_id: IDS.doctor, clinic_id: IDS.clinic, is_active: true, joined_at: "2026-08-01T09:05:00.000Z" },
  { id: IDS.assistantMembership, user_id: IDS.assistant, clinic_id: IDS.clinic, is_active: true, joined_at: "2026-08-01T09:06:00.000Z" },
];

const devices = [
  { id: IDS.doctorDevice, user_id: IDS.doctor, token: "doctor-device-token", browser: "Chromium", operating_system: "Linux", created_at: "2026-08-01T09:07:00.000Z", last_used_at: "2026-08-01T09:07:00.000Z" },
  { id: IDS.assistantDevice, user_id: IDS.assistant, token: "assistant-device-token", browser: "Chromium", operating_system: "Linux", created_at: "2026-08-01T09:08:00.000Z", last_used_at: "2026-08-01T09:08:00.000Z" },
];

function emptyAuthStore(overrides = {}) {
  return {
    accounts: [],
    clinics: [],
    memberships: [],
    devices: [],
    sessions: {},
    challenges: {},
    setup_codes: {},
    recovery_grants: {},
    recovery_codes: {},
    clinic_data: {},
    ...overrides,
  };
}

function operationalStore({ sessionToken = null, workspaceRole = "doctor", tasks = [] } = {}) {
  return {
    clinic: { id: clinic.id, name: clinic.name, timezone: clinic.timezone, email: "", phone: "" },
    staff: [doctor, assistant].map((account) => ({
      id: account.id,
      username: account.email,
      email: account.email,
      first_name: account.first_name,
      last_name: account.last_name,
      role: account.role,
      password_hash: account.password_hash,
      private_note: "",
    })),
    sessions: sessionToken ? { [sessionToken]: { user_id: IDS.doctor, workspace_role: workspaceRole } } : {},
    patients: [],
    visits: [],
    tasks,
    room_call: null,
  };
}

function registry() {
  return {
    accounts: {
      [IDS.doctor]: { token: "doctor-device-token", role: "doctor", aliases: [doctor.email, doctor.phone] },
      [IDS.assistant]: { token: "assistant-device-token", role: "assistant", aliases: [assistant.email, assistant.phone] },
    },
  };
}

async function replaceStorage(page, entries) {
  await page.goto("./");
  await page.evaluate((values) => {
    localStorage.clear();
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, entries);
  await page.reload();
}

async function openReadyWorkspace(page, { workspaceRole = "doctor", tasks = [] } = {}) {
  const sessionToken = "ready-doctor-session";
  const authStore = emptyAuthStore({
    accounts: [doctor, assistant],
    clinics: [clinic],
    memberships,
    devices,
    sessions: {
      [sessionToken]: {
        user_id: IDS.doctor,
        clinic_id: IDS.clinic,
        workspace_role: workspaceRole,
        device_id: IDS.doctorDevice,
        reauthenticated_at: null,
        created_at: "2026-08-01T09:09:00.000Z",
      },
    },
  });
  await replaceStorage(page, {
    [AUTH_STORE_KEY]: authStore,
    [OPERATIONAL_STORE_KEY]: operationalStore({ sessionToken, workspaceRole, tasks }),
    [STAFF_TOKEN_KEY]: sessionToken,
    [ACTIVE_DEVICE_TOKEN_KEY]: "doctor-device-token",
    [DEVICE_REGISTRY_KEY]: registry(),
  });
  await expect(page.getByRole("heading", { name: workspaceRole === "doctor" ? "Doctor workspace" : "Assistant workspace" })).toBeVisible();
}

test("pending contact verification restores after a browser reload", async ({ page }) => {
  const sessionToken = "pending-verification-session";
  const createdAt = new Date();
  const unverifiedDoctor = { ...doctor, email_verified_at: null, phone_verified_at: null };
  const authStore = emptyAuthStore({
    accounts: [unverifiedDoctor],
    sessions: {
      [sessionToken]: {
        user_id: IDS.doctor,
        clinic_id: null,
        workspace_role: null,
        device_id: null,
        reauthenticated_at: null,
        created_at: createdAt.toISOString(),
      },
    },
    challenges: {
      [`${IDS.doctor}:email_verify`]: {
        code: "246810",
        channel: "email",
        pending_value: null,
        created_at: createdAt.toISOString(),
        expires_at: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
      },
    },
  });

  await replaceStorage(page, { [AUTH_STORE_KEY]: authStore, [STAFF_TOKEN_KEY]: sessionToken });
  const codeField = page.getByLabel("Email verification code");
  await expect(codeField).toBeVisible();
  await expect(page.getByText("Development code: 246810")).toBeVisible();

  await page.reload();

  await expect(codeField).toBeVisible();
  await expect(page.getByRole("button", { name: /Resend code in \d+s/ })).toBeDisabled();
  await expect(page.getByText("Development code: 246810")).toBeVisible();
});

test("alternating Doctor and Assistant sign-ins reuse separate trusted devices", async ({ page }) => {
  const authStore = emptyAuthStore({ accounts: [doctor, assistant], clinics: [clinic], memberships, devices });
  await replaceStorage(page, {
    [AUTH_STORE_KEY]: authStore,
    [OPERATIONAL_STORE_KEY]: operationalStore(),
    [DEVICE_REGISTRY_KEY]: registry(),
  });

  await page.getByRole("button").filter({ has: page.getByText("Doctor", { exact: true }) }).click();
  await page.getByRole("button").filter({ has: page.getByText("Sign in", { exact: true }) }).click();
  await page.getByLabel("Email or phone").fill(doctor.email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Doctor workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "How do you use Health Hub?" })).toBeVisible();

  await page.getByRole("button").filter({ has: page.getByText("Assistant", { exact: true }) }).click();
  await page.getByRole("button").filter({ has: page.getByText("Sign in", { exact: true }) }).click();
  await page.getByLabel("Email or phone").fill(assistant.email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Assistant workspace" })).toBeVisible();

  const state = await page.evaluate(({ authKey, activeKey, registryKey }) => ({
    auth: JSON.parse(localStorage.getItem(authKey)),
    active: localStorage.getItem(activeKey),
    registry: JSON.parse(localStorage.getItem(registryKey)),
  }), { authKey: AUTH_STORE_KEY, activeKey: ACTIVE_DEVICE_TOKEN_KEY, registryKey: DEVICE_REGISTRY_KEY });
  expect(state.auth.devices).toHaveLength(2);
  expect(Object.keys(state.registry.accounts)).toEqual(expect.arrayContaining([IDS.doctor, IDS.assistant]));
  expect(state.active).toBe("assistant-device-token");
});

test("Account menu and nested dialogs contain and restore keyboard focus", async ({ page }) => {
  await openReadyWorkspace(page);
  const accountTrigger = page.getByRole("button", { name: "Account", exact: true });

  await accountTrigger.click();
  const settingsItem = page.getByRole("menuitem", { name: "Account settings" });
  await settingsItem.focus();
  await page.keyboard.press("Escape");
  await expect(accountTrigger).toHaveAttribute("aria-expanded", "false");
  await expect(accountTrigger).toBeFocused();

  await accountTrigger.click();
  await page.getByRole("menuitem", { name: "Account settings" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "Account settings" });
  await expect(settingsDialog).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  await expect(settingsDialog.getByRole("button", { name: "Close account settings" })).toBeFocused();

  const reviewDeletion = settingsDialog.getByRole("button", { name: "Review account deletion" });
  await reviewDeletion.click();
  const dangerDialog = page.getByRole("dialog", { name: "Delete Doctor account" });
  await expect(dangerDialog).toBeVisible();
  await expect(page.locator("[data-dialog-layer='true']").first()).toHaveAttribute("inert", "");

  await dangerDialog.getByRole("button", { name: "Permanently delete account and clinics" }).focus();
  await page.keyboard.press("Tab");
  await expect(dangerDialog.getByRole("button", { name: "Close account danger zone" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dangerDialog).toHaveCount(0);
  await expect(reviewDeletion).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settingsDialog).toHaveCount(0);
  await expect(accountTrigger).toBeFocused();
});

test("Patient creation visibly rejects a future date of birth", async ({ page }) => {
  await openReadyWorkspace(page, { workspaceRole: "assistant" });
  await page.getByRole("button", { name: "Patients" }).click();
  await page.getByRole("button", { name: /^\+ Add patient$/ }).click();
  await page.getByLabel("Full name").fill("Future Patient");
  await page.getByLabel("Gender").selectOption("Man");
  await page.getByLabel("Phone number").fill("09121234567");

  const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const dateField = page.getByLabel("Date of birth (optional)");
  await dateField.evaluate((input, value) => {
    input.removeAttribute("max");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, futureDate);
  await page.getByRole("button", { name: "Create patient" }).click();

  const error = page.getByRole("alert");
  await expect(error).toHaveText("Date of birth cannot be in the future.");
  await expect(error).toBeFocused();
  await expect(page.getByRole("heading", { name: "Future Patient" })).toHaveCount(0);
});

test("rendered task, comment, and Undo controls have contextual names", async ({ page }) => {
  const tasks = [{
    id: IDS.task,
    clinic_id: IDS.clinic,
    created_by_id: IDS.doctor,
    title: "Prepare referral",
    description: "Send the referral before Friday.",
    due_date: null,
    patient_id: null,
    status: "open",
    completed_at: null,
    completed_by_id: null,
    deleted_at: null,
    created_at: "2026-08-01T10:00:00.000Z",
    updated_at: "2026-08-01T10:01:00.000Z",
    comments: [{
      id: IDS.comment,
      author_id: IDS.doctor,
      body: "Confirm insurance",
      created_at: "2026-08-01T10:02:00.000Z",
      updated_at: "2026-08-01T10:02:00.000Z",
      edited_at: null,
      deleted_at: null,
    }],
  }];
  await openReadyWorkspace(page, { tasks });
  await page.getByRole("button", { name: "Tasks" }).click();
  await page.locator(".task-card__summary").click();

  await expect(page.getByRole("button", { name: "Mark Prepare referral done" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit task Prepare referral" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete task Prepare referral" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit comment by Doctor Example: Confirm insurance" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete comment by Doctor Example: Confirm insurance" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "New comment on Prepare referral" })).toBeVisible();

  await page.getByRole("button", { name: "Mark Prepare referral done" }).click();
  await expect(page.getByRole("button", { name: "Undo: Prepare referral marked done." })).toBeVisible();
});
