import { demoApiRequest as demoOperationalApiRequest } from "./demoApi.js";
import { fail, hashSecret, randomToken } from "./demoApiBase.js";
import { demoTaskApiRequest } from "./demoTasks.js";

const AUTH_STORE_KEY = "health-hub.demo-auth.v2";
const LEGACY_STORE_KEY = "health-hub.demo-store.v1";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SETUP_TTL_MS = 30 * 60 * 1000;
const RECOVERY_TTL_MS = 30 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;

function emptyAuthStore() {
  return {
    accounts: [],
    clinics: [],
    memberships: [],
    devices: [],
    sessions: {},
    challenges: {},
    setup_codes: {},
    pairing_requests: {},
    recovery_grants: {},
    recovery_codes: {},
    clinic_data: {},
  };
}

function loadAuthStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORE_KEY));
    if (!parsed || typeof parsed !== "object") return emptyAuthStore();
    return {
      ...emptyAuthStore(),
      ...parsed,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      clinics: Array.isArray(parsed.clinics) ? parsed.clinics : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
      challenges: parsed.challenges && typeof parsed.challenges === "object" ? parsed.challenges : {},
      setup_codes: parsed.setup_codes && typeof parsed.setup_codes === "object" ? parsed.setup_codes : {},
      pairing_requests: parsed.pairing_requests && typeof parsed.pairing_requests === "object" ? parsed.pairing_requests : {},
      recovery_grants: parsed.recovery_grants && typeof parsed.recovery_grants === "object" ? parsed.recovery_grants : {},
      recovery_codes: parsed.recovery_codes && typeof parsed.recovery_codes === "object" ? parsed.recovery_codes : {},
      clinic_data: parsed.clinic_data && typeof parsed.clinic_data === "object" ? parsed.clinic_data : {},
    };
  } catch {
    return emptyAuthStore();
  }
}

function saveAuthStore(store) {
  localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(store));
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePhone(value) {
  let phone = clean(value).replace(/[\s().-]+/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    fail({ phone: ["Enter a valid international phone number, such as +33123456789."] });
  }
  return phone;
}

function nowIso() {
  return new Date().toISOString();
}

function expiresIn(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function sixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function recoveryCode() {
  const value = crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
  return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}`;
}

function setupCode() {
  const value = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  return `${value.slice(0, 5)}-${value.slice(5)}`;
}

function deviceInfo() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  let operatingSystem = "Unknown OS";
  if (/Mac OS X|Macintosh/.test(ua)) operatingSystem = "macOS";
  else if (/Windows/.test(ua)) operatingSystem = "Windows";
  else if (/Android/.test(ua)) operatingSystem = "Android";
  else if (/iPhone|iPad/.test(ua)) operatingSystem = "iOS";
  else if (/Linux/.test(ua)) operatingSystem = "Linux";
  return { browser, operating_system: operatingSystem };
}

function publicClinic(clinic) {
  return clinic ? { id: clinic.id, name: clinic.name } : null;
}

function membershipFor(store, userId, clinicId) {
  return store.memberships.find(
    (membership) => membership.user_id === userId
      && membership.clinic_id === clinicId
      && membership.is_active !== false,
  ) ?? null;
}

function activeMemberships(store, userId) {
  return store.memberships.filter(
    (membership) => membership.user_id === userId && membership.is_active !== false,
  );
}

function publicMembership(store, membership) {
  const clinic = store.clinics.find((candidate) => candidate.id === membership.clinic_id);
  return {
    id: membership.id,
    role: membership.role,
    is_clinic_admin: membership.role === "doctor",
    clinic: publicClinic(clinic),
    joined_at: membership.joined_at,
  };
}

function sessionFor(store, staffToken) {
  const session = staffToken ? store.sessions[staffToken] : null;
  const account = session && store.accounts.find((candidate) => candidate.id === session.user_id);
  if (!session || !account) fail({ detail: "Staff session is invalid or expired." }, 401);
  return { session, account };
}

function publicUser(store, account, session = null) {
  const membership = session?.clinic_id
    ? membershipFor(store, account.id, session.clinic_id)
    : null;
  const clinic = membership
    ? store.clinics.find((candidate) => candidate.id === membership.clinic_id)
    : null;
  const memberships = activeMemberships(store, account.id)
    .map((item) => publicMembership(store, item))
    .filter((item) => item.clinic)
    .sort((first, second) => first.clinic.name.localeCompare(second.clinic.name));
  return {
    id: account.id,
    email: account.email,
    phone: account.phone,
    first_name: account.first_name,
    last_name: account.last_name,
    display_name: `${account.first_name} ${account.last_name}`.trim() || account.email,
    email_verified: Boolean(account.email_verified_at),
    phone_verified: Boolean(account.phone_verified_at),
    account_ready: Boolean(account.email_verified_at && account.phone_verified_at),
    role: membership?.role ?? null,
    workspace_role: session?.workspace_role ?? null,
    is_clinic_admin: membership?.role === "doctor",
    clinic: publicClinic(clinic),
    memberships,
    has_doctor_membership: memberships.some((item) => item.role === "doctor"),
  };
}

function findAccountByIdentity(store, identity) {
  const raw = clean(identity);
  const email = normalizeEmail(raw);
  let phone = null;
  if (raw.startsWith("+") || raw.startsWith("00")) {
    try {
      phone = normalizePhone(raw);
    } catch {
      phone = null;
    }
  }
  return store.accounts.find(
    (account) => account.email === email || (phone && account.phone === phone),
  ) ?? null;
}

function validateIdentityFields(store, data, excludeUserId = null) {
  const firstName = clean(data.first_name);
  const lastName = clean(data.last_name);
  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  if (!firstName || !lastName) fail({ detail: "Complete all staff fields." });
  if (!email.includes("@")) fail({ email: ["Enter a valid email address."] });
  if (store.accounts.some((account) => account.id !== excludeUserId && account.email === email)) {
    fail({ email: ["This email is already in use. Sign in instead."] });
  }
  if (store.accounts.some((account) => account.id !== excludeUserId && account.phone === phone)) {
    fail({ phone: ["This phone number is already in use. Sign in instead."] });
  }
  return { first_name: firstName, last_name: lastName, email, phone };
}

function validatePassword(password, confirmation) {
  if (password !== confirmation) fail({ password_confirm: ["Passwords do not match."] });
  if (typeof password !== "string" || password.length < 8) {
    fail({ password: ["Use at least 8 characters for the password."] });
  }
}

function issueSession(store, userId, { clinicId = null, workspaceRole = null, deviceId = null } = {}) {
  const token = randomToken("demo-account");
  store.sessions[token] = {
    user_id: userId,
    clinic_id: clinicId,
    workspace_role: workspaceRole,
    device_id: deviceId,
    created_at: nowIso(),
  };
  return token;
}

function publicDevice(device, currentDeviceId = null) {
  return {
    id: device.id,
    browser: device.browser,
    operating_system: device.operating_system,
    created_at: device.created_at,
    current: device.id === currentDeviceId,
  };
}

function issueDevice(store, clinicId) {
  const token = randomToken("demo-device");
  const info = deviceInfo();
  const device = {
    id: crypto.randomUUID(),
    clinic_id: clinicId,
    token,
    browser: info.browser,
    operating_system: info.operating_system,
    created_at: nowIso(),
  };
  store.devices.push(device);
  return { token, device };
}

function deviceFromToken(store, token) {
  const device = token && store.devices.find((candidate) => candidate.token === token);
  if (!device) fail({ detail: "This browser is not trusted for that clinic." }, 403);
  return device;
}

function challengeKey(userId, purpose, clinicId = "") {
  return `${userId}:${purpose}:${clinicId || "-"}`;
}

function issueChallenge(store, account, {
  purpose,
  channel,
  clinicId = null,
  pendingValue = null,
}) {
  if (channel === "email" && !account.email) fail({ detail: "No email address is available." });
  if (channel === "sms" && !account.phone) fail({ detail: "No phone number is available." });
  if (purpose !== "email_verify" && channel === "email" && !account.email_verified_at) {
    fail({ detail: "Verify the email address first." });
  }
  if (purpose !== "phone_verify" && channel === "sms" && !account.phone_verified_at) {
    fail({ detail: "Verify the phone number first." });
  }
  const code = sixDigitCode();
  const key = challengeKey(account.id, purpose, clinicId);
  store.challenges[key] = {
    code,
    channel,
    clinic_id: clinicId,
    pending_value: pendingValue,
    expires_at: expiresIn(CHALLENGE_TTL_MS),
  };
  return store.challenges[key];
}

function consumeChallenge(store, account, purpose, code, clinicId = null) {
  const key = challengeKey(account.id, purpose, clinicId);
  const challenge = store.challenges[key];
  if (!challenge || challenge.code !== clean(code) || Date.now() > new Date(challenge.expires_at).getTime()) {
    fail({ detail: "Verification code is invalid or expired." });
  }
  delete store.challenges[key];
  return challenge;
}

function readLegacyStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function archiveLegacyStore(authStore) {
  const legacy = readLegacyStore();
  const clinicId = legacy?.clinic?.id;
  if (clinicId && authStore.clinics.some((clinic) => clinic.id === clinicId)) {
    authStore.clinic_data[clinicId] = legacy;
  }
}

function legacyStaffForClinic(authStore, clinicId, existingStaff = []) {
  return authStore.memberships
    .filter((membership) => membership.clinic_id === clinicId && membership.is_active !== false)
    .map((membership) => {
      const account = authStore.accounts.find((candidate) => candidate.id === membership.user_id);
      if (!account) return null;
      const previous = existingStaff.find((candidate) => candidate.id === account.id) ?? {};
      return {
        ...previous,
        id: account.id,
        username: account.email,
        email: account.email,
        first_name: account.first_name,
        last_name: account.last_name,
        role: membership.role,
        password_hash: account.password_hash,
        private_note: account.private_note ?? "",
      };
    })
    .filter(Boolean);
}

function buildLegacyStore(authStore, clinicId) {
  const clinic = authStore.clinics.find((candidate) => candidate.id === clinicId);
  if (!clinic) fail({ detail: "Clinic not found." }, 404);
  const current = readLegacyStore();
  const saved = authStore.clinic_data[clinicId];
  const legacy = current?.clinic?.id === clinicId
    ? current
    : saved
      ? JSON.parse(JSON.stringify(saved))
      : {
          clinic: null,
          staff: [],
          sessions: {},
          patients: [],
          visits: [],
          room_call: null,
          tasks: [],
        };
  legacy.clinic = { id: clinic.id, name: clinic.name, email: "", phone: "" };
  legacy.staff = legacyStaffForClinic(authStore, clinicId, Array.isArray(legacy.staff) ? legacy.staff : []);
  legacy.sessions = Object.fromEntries(
    Object.entries(authStore.sessions)
      .filter(([, session]) => session.clinic_id === clinicId)
      .map(([token, session]) => [
        token,
        { user_id: session.user_id, workspace_role: session.workspace_role },
      ]),
  );
  legacy.patients = Array.isArray(legacy.patients) ? legacy.patients : [];
  legacy.visits = Array.isArray(legacy.visits) ? legacy.visits : [];
  legacy.tasks = Array.isArray(legacy.tasks) ? legacy.tasks : [];
  legacy.room_call = legacy.room_call && typeof legacy.room_call === "object"
    ? legacy.room_call
    : null;
  return legacy;
}

function activateLegacyClinic(authStore, clinicId) {
  const current = readLegacyStore();
  if (current?.clinic?.id && current.clinic.id !== clinicId) archiveLegacyStore(authStore);
  const legacy = buildLegacyStore(authStore, clinicId);
  localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(legacy));
}

function syncLegacyForSession(authStore, staffToken) {
  const { session, account } = sessionFor(authStore, staffToken);
  if (!session.clinic_id || !session.workspace_role) {
    fail({ detail: "Choose a clinic and workspace first." }, 403);
  }
  if (!account.email_verified_at || !account.phone_verified_at) {
    fail({ detail: "Verify both email and phone before opening clinic data." }, 403);
  }
  activateLegacyClinic(authStore, session.clinic_id);
  saveAuthStore(authStore);
  return { session, account };
}

function requireActiveMembership(authStore, session) {
  const membership = session.clinic_id
    ? membershipFor(authStore, session.user_id, session.clinic_id)
    : null;
  if (!membership) fail({ detail: "Choose a clinic first." }, 403);
  return membership;
}

function isTaskPath(pathname) {
  return pathname.startsWith("/api/tasks/") || pathname.startsWith("/api/task-comments/");
}

function isOperationalPath(pathname) {
  return pathname.startsWith("/api/patients/") || pathname.startsWith("/api/visits/");
}

async function createPersonalAccount(authStore, data) {
  validatePassword(data.password, data.password_confirm);
  const identity = validateIdentityFields(authStore, data);
  const account = {
    id: crypto.randomUUID(),
    ...identity,
    password_hash: await hashSecret(data.password),
    email_verified_at: null,
    phone_verified_at: null,
    private_note: "",
    created_at: nowIso(),
  };
  authStore.accounts.push(account);
  return account;
}

async function registerStaff(authStore, data, deviceToken) {
  const role = data.role;
  if (!["doctor", "assistant"].includes(role)) fail({ role: ["Choose Doctor or Assistant."] });

  let clinic = null;
  let device = null;
  let setup = null;
  if (role === "assistant" && data.setup_code) {
    setup = Object.values(authStore.setup_codes).find(
      (candidate) => candidate.code === clean(data.setup_code)
        && !candidate.used_at
        && Date.now() <= new Date(candidate.expires_at).getTime(),
    ) ?? null;
    if (!setup) fail({ detail: "Assistant setup code is invalid or expired." });
    clinic = authStore.clinics.find((candidate) => candidate.id === setup.clinic_id);
    if (deviceToken) {
      const candidate = deviceFromToken(authStore, deviceToken);
      if (candidate.clinic_id === clinic.id) device = candidate;
    }
  } else {
    device = deviceFromToken(authStore, deviceToken);
    clinic = authStore.clinics.find((candidate) => candidate.id === device.clinic_id);
  }
  if (!clinic) fail({ detail: "Clinic not found." }, 404);

  if (authStore.memberships.some(
    (membership) => membership.clinic_id === clinic.id
      && membership.role === role
      && membership.is_active !== false,
  )) {
    fail({ role: ["This clinic already has an account for this role."] }, 409);
  }

  const account = await createPersonalAccount(authStore, data);
  const membership = {
    id: crypto.randomUUID(),
    user_id: account.id,
    clinic_id: clinic.id,
    role,
    is_active: true,
    joined_at: nowIso(),
  };
  authStore.memberships.push(membership);
  if (setup) {
    setup.used_at = nowIso();
    authStore.setup_codes[setup.id] = setup;
  }

  const sessionToken = issueSession(authStore, account.id, device
    ? { clinicId: clinic.id, workspaceRole: role, deviceId: device.id }
    : {});
  if (device) activateLegacyClinic(authStore, clinic.id);
  saveAuthStore(authStore);
  return {
    user: publicUser(authStore, account, authStore.sessions[sessionToken]),
    session_token: sessionToken,
    expires_at: null,
  };
}

async function loginStaff(authStore, data) {
  const account = findAccountByIdentity(authStore, data.identity);
  const passwordHash = await hashSecret(data.password ?? "");
  if (!account || account.password_hash !== passwordHash) {
    fail({ non_field_errors: ["Email/phone or password is incorrect."] });
  }
  const sessionToken = issueSession(authStore, account.id);
  saveAuthStore(authStore);
  return {
    user: publicUser(authStore, account, authStore.sessions[sessionToken]),
    session_token: sessionToken,
    expires_at: null,
  };
}

function clinicContext(authStore, deviceToken) {
  const device = deviceFromToken(authStore, deviceToken);
  const clinic = authStore.clinics.find((candidate) => candidate.id === device.clinic_id);
  if (!clinic) fail({ detail: "Clinic not found." }, 404);
  return { clinic: publicClinic(clinic) };
}

function chooseWorkspace(authStore, staffToken, deviceToken, data) {
  const { session, account } = sessionFor(authStore, staffToken);
  if (!account.email_verified_at || !account.phone_verified_at) {
    fail({ detail: "Verify both email and phone before opening clinic data." }, 403);
  }
  const membership = membershipFor(authStore, account.id, data.clinic_id);
  if (!membership) fail({ detail: "This account does not belong to that clinic." }, 403);
  if (
    data.workspace_role !== membership.role
      && !(membership.role === "doctor" && data.workspace_role === "assistant")
  ) {
    fail({ detail: "This account cannot open that workspace." }, 403);
  }
  const device = deviceFromToken(authStore, deviceToken);
  if (device.clinic_id !== membership.clinic_id) {
    fail({ detail: "This browser is not trusted for that clinic." }, 403);
  }
  archiveLegacyStore(authStore);
  session.clinic_id = membership.clinic_id;
  session.workspace_role = data.workspace_role;
  session.device_id = device.id;
  activateLegacyClinic(authStore, membership.clinic_id);
  saveAuthStore(authStore);
  return { user: publicUser(authStore, account, session) };
}

function clearWorkspace(authStore, staffToken) {
  const { session, account } = sessionFor(authStore, staffToken);
  archiveLegacyStore(authStore);
  session.clinic_id = null;
  session.workspace_role = null;
  session.device_id = null;
  saveAuthStore(authStore);
  return { user: publicUser(authStore, account, session) };
}

async function profileUpdate(authStore, staffToken, data) {
  const { session, account } = sessionFor(authStore, staffToken);
  if (Object.hasOwn(data, "first_name")) {
    const firstName = clean(data.first_name);
    if (!firstName) fail({ first_name: ["This field may not be blank."] });
    account.first_name = firstName;
  }
  if (Object.hasOwn(data, "last_name")) {
    const lastName = clean(data.last_name);
    if (!lastName) fail({ last_name: ["This field may not be blank."] });
    account.last_name = lastName;
  }
  if (Object.hasOwn(data, "phone")) {
    if (account.phone) fail({ phone: ["Use the verified phone-change flow to change your phone number."] });
    const phone = normalizePhone(data.phone);
    if (authStore.accounts.some((candidate) => candidate.id !== account.id && candidate.phone === phone)) {
      fail({ phone: ["This phone number is already in use."] });
    }
    account.phone = phone;
  }
  saveAuthStore(authStore);
  return { user: publicUser(authStore, account, session) };
}

function initialVerificationRequest(authStore, staffToken, kind) {
  const { account } = sessionFor(authStore, staffToken);
  const alreadyVerified = kind === "email" ? account.email_verified_at : account.phone_verified_at;
  if (alreadyVerified) return { detail: `${kind === "email" ? "Email" : "Phone"} is already verified.` };
  if (kind === "phone" && !account.phone) fail({ detail: "Add a phone number first." });
  const challenge = issueChallenge(authStore, account, {
    purpose: kind === "email" ? "email_verify" : "phone_verify",
    channel: kind === "email" ? "email" : "sms",
  });
  saveAuthStore(authStore);
  return {
    detail: "Verification code sent.",
    expires_at: challenge.expires_at,
    development_code: challenge.code,
  };
}

function initialVerificationConfirm(authStore, staffToken, kind, code) {
  const { session, account } = sessionFor(authStore, staffToken);
  consumeChallenge(
    authStore,
    account,
    kind === "email" ? "email_verify" : "phone_verify",
    code,
  );
  if (kind === "email") account.email_verified_at = nowIso();
  else account.phone_verified_at = nowIso();
  saveAuthStore(authStore);
  return { user: publicUser(authStore, account, session) };
}

async function contactChangeRequest(authStore, staffToken, kind, data) {
  const { account } = sessionFor(authStore, staffToken);
  if (data.current_password) {
    const passwordHash = await hashSecret(data.current_password);
    if (passwordHash !== account.password_hash) fail({ detail: "Current password is incorrect." }, 403);
  }
  let value;
  if (kind === "email") {
    value = normalizeEmail(data.value);
    if (!value.includes("@")) fail({ value: ["Enter a valid email address."] });
    if (authStore.accounts.some((candidate) => candidate.id !== account.id && candidate.email === value)) {
      fail({ value: ["This email is already in use."] });
    }
  } else {
    value = normalizePhone(data.value);
    if (authStore.accounts.some((candidate) => candidate.id !== account.id && candidate.phone === value)) {
      fail({ value: ["This phone number is already in use."] });
    }
  }
  const challenge = issueChallenge(authStore, account, {
    purpose: kind === "email" ? "email_change" : "phone_change",
    channel: kind === "email" ? "email" : "sms",
    pendingValue: value,
  });
  saveAuthStore(authStore);
  return {
    detail: "Verification code sent.",
    expires_at: challenge.expires_at,
    development_code: challenge.code,
  };
}

function contactChangeConfirm(authStore, staffToken, kind, code) {
  const { session, account } = sessionFor(authStore, staffToken);
  const challenge = consumeChallenge(
    authStore,
    account,
    kind === "email" ? "email_change" : "phone_change",
    code,
  );
  if (kind === "email") {
    account.email = challenge.pending_value;
    account.email_verified_at = nowIso();
  } else {
    account.phone = challenge.pending_value;
    account.phone_verified_at = nowIso();
  }
  saveAuthStore(authStore);
  return { user: publicUser(authStore, account, session) };
}

function passwordChangeRequest(authStore, staffToken, data) {
  const { account } = sessionFor(authStore, staffToken);
  const challenge = issueChallenge(authStore, account, {
    purpose: "password_change",
    channel: data.channel,
  });
  saveAuthStore(authStore);
  return {
    detail: "Verification code sent.",
    expires_at: challenge.expires_at,
    development_code: challenge.code,
  };
}

async function passwordChangeConfirm(authStore, staffToken, data) {
  const { account } = sessionFor(authStore, staffToken);
  validatePassword(data.password, data.password_confirm);
  consumeChallenge(authStore, account, "password_change", data.code);
  account.password_hash = await hashSecret(data.password);
  for (const [token, session] of Object.entries(authStore.sessions)) {
    if (session.user_id === account.id && token !== staffToken) delete authStore.sessions[token];
  }
  saveAuthStore(authStore);
  return { detail: "Password changed. Other sessions were signed out." };
}

function recoveryRequest(authStore, data) {
  const account = findAccountByIdentity(authStore, data.identity);
  let challenge = null;
  if (account) {
    try {
      challenge = issueChallenge(authStore, account, {
        purpose: "password_recovery",
        channel: data.channel,
      });
    } catch {
      challenge = null;
    }
  }
  saveAuthStore(authStore);
  return {
    detail: "If the account and verified channel exist, a recovery code was sent.",
    ...(challenge ? { development_code: challenge.code } : {}),
  };
}

function recoveryConfirm(authStore, data) {
  const account = findAccountByIdentity(authStore, data.identity);
  if (!account) fail({ detail: "Recovery code is invalid or expired." });
  try {
    consumeChallenge(authStore, account, "password_recovery", data.code);
  } catch {
    fail({ detail: "Recovery code is invalid or expired." });
  }
  const token = randomToken("demo-recovery");
  authStore.recovery_grants[token] = {
    user_id: account.id,
    expires_at: expiresIn(RECOVERY_TTL_MS),
  };
  saveAuthStore(authStore);
  return { recovery_token: token, expires_at: authStore.recovery_grants[token].expires_at };
}

function offlineRecoveryConfirm(authStore, data) {
  const account = findAccountByIdentity(authStore, data.identity);
  const codes = account ? authStore.recovery_codes[account.id] ?? [] : [];
  const entry = codes.find((candidate) => !candidate.used_at && candidate.code === clean(data.code));
  if (!account || !entry) fail({ detail: "Recovery code is invalid or already used." });
  entry.used_at = nowIso();
  const token = randomToken("demo-recovery");
  authStore.recovery_grants[token] = {
    user_id: account.id,
    expires_at: expiresIn(RECOVERY_TTL_MS),
  };
  saveAuthStore(authStore);
  return { recovery_token: token, expires_at: authStore.recovery_grants[token].expires_at };
}

async function recoveryReset(authStore, data) {
  const grant = authStore.recovery_grants[data.recovery_token];
  if (!grant || Date.now() > new Date(grant.expires_at).getTime()) {
    fail({ detail: "Recovery authorization is invalid or expired." });
  }
  validatePassword(data.password, data.password_confirm);
  const account = authStore.accounts.find((candidate) => candidate.id === grant.user_id);
  if (!account) fail({ detail: "Recovery authorization is invalid or expired." });
  account.password_hash = await hashSecret(data.password);
  for (const [token, session] of Object.entries(authStore.sessions)) {
    if (session.user_id === account.id) delete authStore.sessions[token];
  }
  delete authStore.recovery_grants[data.recovery_token];
  saveAuthStore(authStore);
  return { detail: "Password reset complete. Sign in again." };
}

function recoveryCodes(authStore, staffToken, method) {
  const { account } = sessionFor(authStore, staffToken);
  if (!activeMemberships(authStore, account.id).some((membership) => membership.role === "doctor")) {
    fail({ detail: "Offline recovery codes are available only to Doctors." }, 403);
  }
  if (method === "GET") {
    const current = authStore.recovery_codes[account.id] ?? [];
    return { remaining: current.filter((code) => !code.used_at).length };
  }
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => recoveryCode());
  authStore.recovery_codes[account.id] = codes.map((code) => ({ code, used_at: null }));
  saveAuthStore(authStore);
  return { codes, remaining: codes.length };
}

function createClinic(authStore, data) {
  const name = clean(data.name);
  if (!name) fail({ name: ["This field may not be blank."] });
  const clinic = { id: crypto.randomUUID(), name, created_at: nowIso() };
  authStore.clinics.push(clinic);
  const { token, device } = issueDevice(authStore, clinic.id);
  saveAuthStore(authStore);
  return {
    clinic: publicClinic(clinic),
    device_token: token,
    trusted_device: publicDevice(device, device.id),
  };
}

function claimDoctor(authStore, staffToken, deviceToken, clinicId) {
  const { account } = sessionFor(authStore, staffToken);
  const device = deviceFromToken(authStore, deviceToken);
  if (device.clinic_id !== clinicId) fail({ detail: "This device is not trusted for that clinic." }, 403);
  if (authStore.memberships.some(
    (membership) => membership.clinic_id === clinicId
      && membership.role === "doctor"
      && membership.is_active !== false,
  )) {
    fail({ detail: "This clinic already has a Doctor." }, 409);
  }
  if (membershipFor(authStore, account.id, clinicId)) {
    fail({ detail: "This account already belongs to this clinic." }, 409);
  }
  const membership = {
    id: crypto.randomUUID(),
    user_id: account.id,
    clinic_id: clinicId,
    role: "doctor",
    is_active: true,
    joined_at: nowIso(),
  };
  authStore.memberships.push(membership);
  saveAuthStore(authStore);
  return publicMembership(authStore, membership);
}

function deviceAuthorizationRequest(authStore, staffToken, data) {
  const { account } = sessionFor(authStore, staffToken);
  const membership = membershipFor(authStore, account.id, data.clinic_id);
  if (!membership) fail({ detail: "This account does not belong to that clinic." }, 403);
  const challenge = issueChallenge(authStore, account, {
    purpose: "device_authorize",
    channel: data.channel,
    clinicId: membership.clinic_id,
  });
  saveAuthStore(authStore);
  return {
    detail: "Verification code sent.",
    expires_at: challenge.expires_at,
    development_code: challenge.code,
  };
}

function deviceAuthorizationConfirm(authStore, staffToken, data) {
  const { account } = sessionFor(authStore, staffToken);
  const membership = membershipFor(authStore, account.id, data.clinic_id);
  if (!membership) fail({ detail: "This account does not belong to that clinic." }, 403);
  consumeChallenge(authStore, account, "device_authorize", data.code, membership.clinic_id);
  const { token, device } = issueDevice(authStore, membership.clinic_id);
  saveAuthStore(authStore);
  return {
    device_token: token,
    trusted_device: publicDevice(device, device.id),
  };
}

function pairingStart(authStore, staffToken, data) {
  const { account } = sessionFor(authStore, staffToken);
  const membership = membershipFor(authStore, account.id, data.clinic_id);
  if (!membership) fail({ detail: "This account does not belong to that clinic." }, 403);
  const id = crypto.randomUUID();
  const requestToken = randomToken("demo-pairing");
  const info = deviceInfo();
  authStore.pairing_requests[id] = {
    id,
    clinic_id: membership.clinic_id,
    request_token: requestToken,
    code: sixDigitCode(),
    browser: info.browser,
    operating_system: info.operating_system,
    approved_at: null,
    device_token: null,
    device_id: null,
    expires_at: expiresIn(CHALLENGE_TTL_MS),
  };
  saveAuthStore(authStore);
  return {
    pairing_code: authStore.pairing_requests[id].code,
    request_token: requestToken,
    expires_at: authStore.pairing_requests[id].expires_at,
  };
}

function pairingStatus(authStore, staffToken, data) {
  const { account } = sessionFor(authStore, staffToken);
  const pairing = Object.values(authStore.pairing_requests).find(
    (candidate) => candidate.request_token === data.request_token,
  );
  if (!pairing || Date.now() > new Date(pairing.expires_at).getTime()) {
    fail({ detail: "Pairing request is invalid or expired." });
  }
  if (!membershipFor(authStore, account.id, pairing.clinic_id)) {
    fail({ detail: "This account no longer belongs to that clinic." }, 403);
  }
  if (!pairing.approved_at) {
    return { status: "pending", expires_at: pairing.expires_at };
  }
  const device = authStore.devices.find((candidate) => candidate.id === pairing.device_id);
  const clinic = authStore.clinics.find((candidate) => candidate.id === pairing.clinic_id);
  return {
    status: "approved",
    device_token: pairing.device_token,
    trusted_device: publicDevice(device, device?.id),
    clinic: publicClinic(clinic),
  };
}

function pairingApprove(authStore, staffToken, data) {
  const { session } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  const normalized = clean(data.code).replace(/\D/g, "");
  const pairing = Object.values(authStore.pairing_requests).find(
    (candidate) => candidate.clinic_id === membership.clinic_id
      && candidate.code === normalized
      && !candidate.approved_at
      && Date.now() <= new Date(candidate.expires_at).getTime(),
  );
  if (!pairing) fail({ detail: "Pairing code is invalid or expired." });
  const { token, device } = issueDevice(authStore, pairing.clinic_id);
  pairing.approved_at = nowIso();
  pairing.device_token = token;
  pairing.device_id = device.id;
  saveAuthStore(authStore);
  return {
    status: "approved",
    browser: pairing.browser,
    operating_system: pairing.operating_system,
  };
}

function deviceList(authStore, staffToken) {
  const { session } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  return {
    devices: authStore.devices
      .filter((device) => device.clinic_id === membership.clinic_id)
      .map((device) => publicDevice(device, session.device_id)),
  };
}

function deviceDelete(authStore, staffToken, deviceId) {
  const { session } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  const device = authStore.devices.find(
    (candidate) => candidate.id === deviceId && candidate.clinic_id === membership.clinic_id,
  );
  if (!device) fail({ detail: "Trusted device not found." }, 404);
  authStore.devices = authStore.devices.filter((candidate) => candidate.id !== device.id);
  for (const [token, otherSession] of Object.entries(authStore.sessions)) {
    if (otherSession.device_id === device.id) delete authStore.sessions[token];
  }
  saveAuthStore(authStore);
  return null;
}

function clinicAssistant(authStore, staffToken) {
  const { session } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  if (membership.role !== "doctor") fail({ detail: "Only the Doctor can manage the clinic Assistant slot." }, 403);
  const assistantMembership = authStore.memberships.find(
    (candidate) => candidate.clinic_id === membership.clinic_id
      && candidate.role === "assistant"
      && candidate.is_active !== false,
  );
  const assistant = assistantMembership
    ? authStore.accounts.find((candidate) => candidate.id === assistantMembership.user_id)
    : null;
  return {
    assistant: assistant
      ? {
          id: assistant.id,
          display_name: `${assistant.first_name} ${assistant.last_name}`.trim() || assistant.email,
          email: assistant.email,
          phone: assistant.phone,
        }
      : null,
  };
}

function assistantSetup(authStore, staffToken, data) {
  const { session, account } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  if (membership.role !== "doctor") fail({ detail: "Only the Doctor can manage the clinic Assistant slot." }, 403);
  const existing = authStore.memberships.find(
    (candidate) => candidate.clinic_id === membership.clinic_id
      && candidate.role === "assistant"
      && candidate.is_active !== false,
  );
  if (existing && !data.replace_existing) {
    fail({ detail: "This clinic already has an Assistant. Choose replacement explicitly." }, 409);
  }
  if (existing) {
    existing.is_active = false;
    for (const [token, candidate] of Object.entries(authStore.sessions)) {
      if (candidate.user_id === existing.user_id && candidate.clinic_id === membership.clinic_id) {
        delete authStore.sessions[token];
      }
    }
  }
  const id = crypto.randomUUID();
  const code = setupCode();
  authStore.setup_codes[id] = {
    id,
    clinic_id: membership.clinic_id,
    created_by_id: account.id,
    code,
    used_at: null,
    expires_at: expiresIn(SETUP_TTL_MS),
  };
  saveAuthStore(authStore);
  return { setup_code: code, expires_at: authStore.setup_codes[id].expires_at };
}

function assistantSetupClaim(authStore, staffToken, deviceToken, data) {
  const { session, account } = sessionFor(authStore, staffToken);
  const setup = Object.values(authStore.setup_codes).find(
    (candidate) => candidate.code === clean(data.code)
      && !candidate.used_at
      && Date.now() <= new Date(candidate.expires_at).getTime(),
  );
  if (!setup) fail({ detail: "Assistant setup code is invalid or expired." });
  if (authStore.memberships.some(
    (membership) => membership.clinic_id === setup.clinic_id
      && membership.role === "assistant"
      && membership.is_active !== false,
  )) {
    fail({ detail: "The Assistant slot is already filled." }, 409);
  }
  let membership = authStore.memberships.find(
    (candidate) => candidate.user_id === account.id && candidate.clinic_id === setup.clinic_id,
  );
  if (membership?.is_active !== false) {
    fail({ detail: "This account already belongs to this clinic." }, 409);
  }
  if (membership) {
    membership.role = "assistant";
    membership.is_active = true;
  } else {
    membership = {
      id: crypto.randomUUID(),
      user_id: account.id,
      clinic_id: setup.clinic_id,
      role: "assistant",
      is_active: true,
      joined_at: nowIso(),
    };
    authStore.memberships.push(membership);
  }
  setup.used_at = nowIso();
  if (deviceToken && account.email_verified_at && account.phone_verified_at) {
    try {
      const device = deviceFromToken(authStore, deviceToken);
      if (device.clinic_id === setup.clinic_id) {
        session.clinic_id = setup.clinic_id;
        session.workspace_role = "assistant";
        session.device_id = device.id;
        activateLegacyClinic(authStore, setup.clinic_id);
      }
    } catch {
      session.clinic_id = null;
      session.workspace_role = null;
      session.device_id = null;
    }
  } else {
    session.clinic_id = null;
    session.workspace_role = null;
    session.device_id = null;
  }
  saveAuthStore(authStore);
  return {
    membership: publicMembership(authStore, membership),
    user: publicUser(authStore, account, session),
  };
}

function assistantRecovery(authStore, staffToken, data) {
  const { session } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  if (membership.role !== "doctor") fail({ detail: "Only the Doctor can initiate Assistant recovery." }, 403);
  const assistantMembership = authStore.memberships.find(
    (candidate) => candidate.clinic_id === membership.clinic_id
      && candidate.role === "assistant"
      && candidate.is_active !== false,
  );
  const assistant = assistantMembership
    ? authStore.accounts.find((candidate) => candidate.id === assistantMembership.user_id)
    : null;
  if (!assistant) fail({ detail: "This clinic has no Assistant." }, 404);
  const challenge = issueChallenge(authStore, assistant, {
    purpose: "password_recovery",
    channel: data.channel,
  });
  saveAuthStore(authStore);
  return {
    detail: "Recovery instructions were sent directly to the Assistant.",
    development_code: challenge.code,
  };
}

function privateNote(authStore, staffToken, method, data) {
  const { session, account } = sessionFor(authStore, staffToken);
  const membership = requireActiveMembership(authStore, session);
  if (session.workspace_role !== membership.role) {
    fail({ detail: "Private notes are available only in your own workspace." }, 403);
  }
  if (method === "GET") return { content: account.private_note ?? "" };
  if (typeof data.content !== "string") fail({ content: ["Not a valid string."] });
  account.private_note = data.content;
  saveAuthStore(authStore);
  return { content: account.private_note };
}

function passkeyUnavailable(pathname, method) {
  if (pathname === "/api/passkeys/" && method === "GET") return { passkeys: [] };
  fail({
    detail: "Passkeys are not simulated in the browser-only demo. Use email or phone with a password.",
  }, 400);
}

export async function demoPhase8ApiRequest(
  path,
  {
    method = "GET",
    data = {},
    staffToken,
    deviceToken,
  } = {},
) {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  const url = new URL(path, "https://health-hub.demo");
  const pathname = url.pathname;
  const authStore = loadAuthStore();

  if (pathname === "/api/health/" && method === "GET") {
    return { status: "ok", service: "Health Hub browser demo API" };
  }

  if (pathname === "/api/clinics/" && method === "POST") {
    return createClinic(authStore, data);
  }
  if (pathname === "/api/clinic/context/" && method === "GET") {
    return clinicContext(authStore, deviceToken);
  }

  if (pathname === "/api/staff/register/" && method === "POST") {
    return registerStaff(authStore, data, deviceToken);
  }
  if (pathname === "/api/staff/login/" && method === "POST") {
    return loginStaff(authStore, data);
  }
  if (pathname === "/api/staff/me/" && method === "GET") {
    const { session, account } = sessionFor(authStore, staffToken);
    return { user: publicUser(authStore, account, session) };
  }
  if (pathname === "/api/staff/logout/" && method === "POST") {
    archiveLegacyStore(authStore);
    if (staffToken) delete authStore.sessions[staffToken];
    saveAuthStore(authStore);
    return null;
  }
  if (pathname === "/api/staff/profile/" && method === "PATCH") {
    return profileUpdate(authStore, staffToken, data);
  }
  if (pathname === "/api/staff/select-clinic/" && method === "POST") {
    return chooseWorkspace(authStore, staffToken, deviceToken, data);
  }
  if (pathname === "/api/staff/leave-clinic/" && method === "POST") {
    return clearWorkspace(authStore, staffToken);
  }

  if (pathname === "/api/staff/verify/email/request/" && method === "POST") {
    return initialVerificationRequest(authStore, staffToken, "email");
  }
  if (pathname === "/api/staff/verify/email/confirm/" && method === "POST") {
    return initialVerificationConfirm(authStore, staffToken, "email", data.code);
  }
  if (pathname === "/api/staff/verify/phone/request/" && method === "POST") {
    return initialVerificationRequest(authStore, staffToken, "phone");
  }
  if (pathname === "/api/staff/verify/phone/confirm/" && method === "POST") {
    return initialVerificationConfirm(authStore, staffToken, "phone", data.code);
  }

  if (pathname === "/api/staff/email/change/request/" && method === "POST") {
    return contactChangeRequest(authStore, staffToken, "email", data);
  }
  if (pathname === "/api/staff/email/change/confirm/" && method === "POST") {
    return contactChangeConfirm(authStore, staffToken, "email", data.code);
  }
  if (pathname === "/api/staff/phone/change/request/" && method === "POST") {
    return contactChangeRequest(authStore, staffToken, "phone", data);
  }
  if (pathname === "/api/staff/phone/change/confirm/" && method === "POST") {
    return contactChangeConfirm(authStore, staffToken, "phone", data.code);
  }
  if (pathname === "/api/staff/password/change/request/" && method === "POST") {
    return passwordChangeRequest(authStore, staffToken, data);
  }
  if (pathname === "/api/staff/password/change/confirm/" && method === "POST") {
    return passwordChangeConfirm(authStore, staffToken, data);
  }

  if (pathname === "/api/recovery/request/" && method === "POST") {
    return recoveryRequest(authStore, data);
  }
  if (pathname === "/api/recovery/confirm/" && method === "POST") {
    return recoveryConfirm(authStore, data);
  }
  if (pathname === "/api/recovery/code/confirm/" && method === "POST") {
    return offlineRecoveryConfirm(authStore, data);
  }
  if (pathname === "/api/recovery/reset/" && method === "POST") {
    return recoveryReset(authStore, data);
  }
  if (pathname === "/api/staff/recovery-codes/" && ["GET", "POST"].includes(method)) {
    return recoveryCodes(authStore, staffToken, method);
  }

  if (pathname.startsWith("/api/passkeys/")) {
    return passkeyUnavailable(pathname, method);
  }

  const claimDoctorMatch = pathname.match(/^\/api\/clinics\/([0-9a-f-]+)\/claim-doctor\/$/i);
  if (claimDoctorMatch && method === "POST") {
    return claimDoctor(authStore, staffToken, deviceToken, claimDoctorMatch[1]);
  }

  if (pathname === "/api/devices/contact/request/" && method === "POST") {
    return deviceAuthorizationRequest(authStore, staffToken, data);
  }
  if (pathname === "/api/devices/contact/confirm/" && method === "POST") {
    return deviceAuthorizationConfirm(authStore, staffToken, data);
  }
  if (pathname === "/api/devices/pairing/" && method === "POST") {
    return pairingStart(authStore, staffToken, data);
  }
  if (pathname === "/api/devices/pairing/status/" && method === "POST") {
    return pairingStatus(authStore, staffToken, data);
  }
  if (pathname === "/api/devices/pairing/approve/" && method === "POST") {
    return pairingApprove(authStore, staffToken, data);
  }
  if (pathname === "/api/devices/" && method === "GET") {
    return deviceList(authStore, staffToken);
  }
  const deviceDeleteMatch = pathname.match(/^\/api\/devices\/([0-9a-f-]+)\/$/i);
  if (deviceDeleteMatch && method === "DELETE") {
    return deviceDelete(authStore, staffToken, deviceDeleteMatch[1]);
  }

  if (pathname === "/api/clinic/assistant/" && method === "GET") {
    return clinicAssistant(authStore, staffToken);
  }
  if (pathname === "/api/clinic/assistant/setup/" && method === "POST") {
    return assistantSetup(authStore, staffToken, data);
  }
  if (pathname === "/api/clinic/assistant/setup/claim/" && method === "POST") {
    return assistantSetupClaim(authStore, staffToken, deviceToken, data);
  }
  if (pathname === "/api/clinic/assistant/recovery/" && method === "POST") {
    return assistantRecovery(authStore, staffToken, data);
  }

  if (pathname === "/api/staff/private-note/" && ["GET", "PATCH"].includes(method)) {
    return privateNote(authStore, staffToken, method, data);
  }

  if (isTaskPath(pathname)) {
    syncLegacyForSession(authStore, staffToken);
    return demoTaskApiRequest(path, { method, data, staffToken });
  }
  if (isOperationalPath(pathname)) {
    syncLegacyForSession(authStore, staffToken);
    return demoOperationalApiRequest(path, { method, data, staffToken });
  }

  fail({ detail: "This API route is not available in the browser demo." }, 404);
}
