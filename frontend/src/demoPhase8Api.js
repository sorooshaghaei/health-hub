import { demoApiRequest as demoOperationalApiRequest } from "./demoApi.js";
import { fail, hashSecret, randomToken } from "./demoApiBase.js";
import { demoTaskApiRequest } from "./demoTasks.js";

const AUTH_STORE_KEY = "health-hub.demo-auth.v2";
const LEGACY_STORE_KEY = "health-hub.demo-store.v1";
const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SETUP_TTL_MS = 24 * 60 * 60 * 1000;
const RECOVERY_TTL_MS = 30 * 60 * 1000;
const REAUTH_TTL_MS = 10 * 60 * 1000;
const RECOVERY_CODE_COUNT = 10;

function emptyAuthStore() {
  return {
    accounts: [], clinics: [], memberships: [], devices: [], sessions: {},
    challenges: {}, setup_codes: {}, recovery_grants: {}, recovery_codes: {},
    clinic_data: {},
  };
}

function loadAuthStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORE_KEY));
    if (!parsed || typeof parsed !== "object") return emptyAuthStore();
    return {
      ...emptyAuthStore(), ...parsed,
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      clinics: Array.isArray(parsed.clinics) ? parsed.clinics : [],
      memberships: Array.isArray(parsed.memberships) ? parsed.memberships : [],
      devices: Array.isArray(parsed.devices) ? parsed.devices : [],
      sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
      challenges: parsed.challenges && typeof parsed.challenges === "object" ? parsed.challenges : {},
      setup_codes: parsed.setup_codes && typeof parsed.setup_codes === "object" ? parsed.setup_codes : {},
      recovery_grants: parsed.recovery_grants && typeof parsed.recovery_grants === "object" ? parsed.recovery_grants : {},
      recovery_codes: parsed.recovery_codes && typeof parsed.recovery_codes === "object" ? parsed.recovery_codes : {},
      clinic_data: parsed.clinic_data && typeof parsed.clinic_data === "object" ? parsed.clinic_data : {},
    };
  } catch { return emptyAuthStore(); }
}

function saveAuthStore(store) { localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(store)); }
function clean(value) { return typeof value === "string" ? value.trim() : ""; }
function normalizeEmail(value) { return clean(value).toLowerCase(); }
function normalizePhone(value) {
  let phone = clean(value).replace(/[\s().-]+/g, "");
  if (phone.startsWith("00")) phone = `+${phone.slice(2)}`;
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) fail({ phone: ["Enter a valid international phone number, such as +33123456789."] });
  return phone;
}
function nowIso() { return new Date().toISOString(); }
function expiresIn(milliseconds) { return new Date(Date.now() + milliseconds).toISOString(); }
function sixDigitCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
function setupCode() { const value = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase(); return `${value.slice(0, 5)}-${value.slice(5)}`; }
function recoveryCode() { const value = crypto.randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase(); return `${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`; }

function deviceInfo() {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge"; else if (/Chrome\//.test(ua)) browser = "Chrome"; else if (/Firefox\//.test(ua)) browser = "Firefox"; else if (/Safari\//.test(ua)) browser = "Safari";
  let operatingSystem = "Unknown OS";
  if (/Mac OS X|Macintosh/.test(ua)) operatingSystem = "macOS"; else if (/Windows/.test(ua)) operatingSystem = "Windows"; else if (/Android/.test(ua)) operatingSystem = "Android"; else if (/iPhone|iPad/.test(ua)) operatingSystem = "iOS"; else if (/Linux/.test(ua)) operatingSystem = "Linux";
  return { browser, operating_system: operatingSystem };
}

function publicClinic(clinic) { return clinic ? { id: clinic.id, name: clinic.name, timezone: clinic.timezone || "UTC" } : null; }
function accountFor(store, userId) { return store.accounts.find((item) => item.id === userId) ?? null; }
function membershipFor(store, userId, clinicId, includeInactive = false) {
  return store.memberships.find((item) => item.user_id === userId && item.clinic_id === clinicId && (includeInactive || item.is_active !== false)) ?? null;
}
function activeMemberships(store, userId) { return store.memberships.filter((item) => item.user_id === userId && item.is_active !== false); }
function publicMembership(store, membership) {
  const clinic = store.clinics.find((item) => item.id === membership.clinic_id);
  const account = accountFor(store, membership.user_id);
  return { id: membership.id, role: account?.role ?? null, is_clinic_admin: Boolean(account?.role === "doctor" && clinic?.owner_doctor_id === account.id), clinic: publicClinic(clinic), joined_at: membership.joined_at };
}
function deviceForSession(store, session) { return session?.device_id ? store.devices.find((item) => item.id === session.device_id) ?? null : null; }
function sessionFor(store, token) {
  const session = token ? store.sessions[token] : null;
  const account = session ? accountFor(store, session.user_id) : null;
  if (!session || !account || account.is_active === false) fail({ detail: "Staff session is invalid or expired." }, 401);
  return { session, account };
}
function publicUser(store, account, session = null) {
  const membership = session?.clinic_id ? membershipFor(store, account.id, session.clinic_id) : null;
  const clinic = membership ? store.clinics.find((item) => item.id === membership.clinic_id) : null;
  const memberships = activeMemberships(store, account.id).map((item) => publicMembership(store, item)).filter((item) => item.clinic).sort((a, b) => a.clinic.name.localeCompare(b.clinic.name));
  const device = deviceForSession(store, session);
  return {
    id: account.id, role: account.role, email: account.email, phone: account.phone,
    first_name: account.first_name, last_name: account.last_name,
    display_name: account.anonymized_at ? "Former Assistant" : `${account.first_name} ${account.last_name}`.trim() || account.email,
    email_verified: Boolean(account.email_verified_at), phone_verified: Boolean(account.phone_verified_at),
    account_ready: Boolean(account.email_verified_at && account.phone_verified_at),
    workspace_role: session?.workspace_role ?? null,
    is_clinic_admin: Boolean(membership && account.role === "doctor" && clinic?.owner_doctor_id === account.id),
    clinic: publicClinic(clinic), memberships,
    has_doctor_membership: account.role === "doctor" && memberships.length > 0,
    device_trusted: Boolean(device && device.user_id === account.id),
  };
}
function findAccountByIdentity(store, identity) {
  const raw = clean(identity), email = normalizeEmail(raw); let phone = null;
  if (raw.startsWith("+") || raw.startsWith("00")) { try { phone = normalizePhone(raw); } catch { phone = null; } }
  return store.accounts.find((account) => account.is_active !== false && !account.anonymized_at && (account.email === email || (phone && account.phone === phone))) ?? null;
}
function validateIdentityFields(store, data, excludeUserId = null) {
  const first_name = clean(data.first_name), last_name = clean(data.last_name), email = normalizeEmail(data.email), phone = normalizePhone(data.phone);
  if (!first_name || !last_name) fail({ detail: "Complete all staff fields." });
  if (!email.includes("@")) fail({ email: ["Enter a valid email address."] });
  if (store.accounts.some((a) => a.id !== excludeUserId && a.email === email)) fail({ email: ["This email is already in use. Sign in instead."] });
  if (store.accounts.some((a) => a.id !== excludeUserId && a.phone === phone)) fail({ phone: ["This phone number is already in use. Sign in instead."] });
  return { first_name, last_name, email, phone };
}
function validatePassword(password, confirmation) { if (password !== confirmation) fail({ password_confirm: ["Passwords do not match."] }); if (typeof password !== "string" || password.length < 8) fail({ password: ["Use at least 8 characters for the password."] }); }
function issueSession(store, userId, { clinicId = null, workspaceRole = null, deviceId = null } = {}) {
  const token = randomToken("demo-account");
  store.sessions[token] = { user_id: userId, clinic_id: clinicId, workspace_role: workspaceRole, device_id: deviceId, reauthenticated_at: null, created_at: nowIso() };
  return token;
}
function publicDevice(device, currentId = null) { return { id: device.id, browser: device.browser, operating_system: device.operating_system, created_at: device.created_at, current: device.id === currentId }; }
function issueDevice(store, userId) {
  const token = randomToken("demo-device"), info = deviceInfo();
  const device = { id: crypto.randomUUID(), user_id: userId, token, browser: info.browser, operating_system: info.operating_system, created_at: nowIso() };
  store.devices.push(device); return { token, device };
}
function deviceFromToken(store, token, userId = null) {
  const device = token ? store.devices.find((item) => item.token === token) : null;
  if (!device || (userId && device.user_id !== userId)) fail({ detail: "This browser is not trusted for this account." }, 403);
  return device;
}
function recentReauth(session) { return Boolean(session.reauthenticated_at && Date.now() - new Date(session.reauthenticated_at).getTime() <= REAUTH_TTL_MS); }

function challengeKey(userId, purpose) { return `${userId}:${purpose}`; }
function issueChallenge(store, account, { purpose, channel, pendingValue = null }) {
  if (channel === "email" && !account.email) fail({ detail: "No email address is available." });
  if (channel === "sms" && !account.phone) fail({ detail: "No phone number is available." });
  if (purpose !== "email_verify" && channel === "email" && !account.email_verified_at) fail({ detail: "Verify the email address first." });
  if (purpose !== "phone_verify" && channel === "sms" && !account.phone_verified_at) fail({ detail: "Verify the phone number first." });
  const challenge = { code: sixDigitCode(), channel, pending_value: pendingValue, expires_at: expiresIn(CHALLENGE_TTL_MS) };
  store.challenges[challengeKey(account.id, purpose)] = challenge; return challenge;
}
function consumeChallenge(store, account, purpose, code) {
  const key = challengeKey(account.id, purpose), challenge = store.challenges[key];
  if (!challenge || challenge.code !== clean(code) || Date.now() > new Date(challenge.expires_at).getTime()) fail({ detail: "Verification code is invalid or expired." });
  delete store.challenges[key]; return challenge;
}

function readLegacyStore() { try { const parsed = JSON.parse(localStorage.getItem(LEGACY_STORE_KEY)); return parsed && typeof parsed === "object" ? parsed : null; } catch { return null; } }
function archiveLegacyStore(store) { const legacy = readLegacyStore(), clinicId = legacy?.clinic?.id; if (clinicId && store.clinics.some((clinic) => clinic.id === clinicId)) store.clinic_data[clinicId] = legacy; }
function legacyStaffForClinic(store, clinicId, existing = []) {
  return store.memberships.filter((m) => m.clinic_id === clinicId && m.is_active !== false).map((m) => {
    const account = accountFor(store, m.user_id); if (!account) return null; const previous = existing.find((item) => item.id === account.id) ?? {};
    return { ...previous, id: account.id, username: account.email, email: account.email, first_name: account.first_name, last_name: account.last_name, role: account.role, password_hash: account.password_hash, private_note: account.private_note ?? "" };
  }).filter(Boolean);
}
function buildLegacyStore(store, clinicId) {
  const clinic = store.clinics.find((item) => item.id === clinicId); if (!clinic) fail({ detail: "Clinic not found." }, 404);
  const current = readLegacyStore(), saved = store.clinic_data[clinicId];
  const legacy = current?.clinic?.id === clinicId ? current : saved ? JSON.parse(JSON.stringify(saved)) : { clinic: null, staff: [], sessions: {}, patients: [], visits: [], room_call: null, tasks: [] };
  legacy.clinic = { id: clinic.id, name: clinic.name, timezone: clinic.timezone || "UTC", email: "", phone: "" };
  legacy.staff = legacyStaffForClinic(store, clinicId, Array.isArray(legacy.staff) ? legacy.staff : []);
  legacy.sessions = Object.fromEntries(Object.entries(store.sessions).filter(([, s]) => s.clinic_id === clinicId).map(([token, s]) => [token, { user_id: s.user_id, workspace_role: s.workspace_role }]));
  legacy.patients = Array.isArray(legacy.patients) ? legacy.patients : []; legacy.visits = Array.isArray(legacy.visits) ? legacy.visits : []; legacy.tasks = Array.isArray(legacy.tasks) ? legacy.tasks : []; legacy.room_call = legacy.room_call && typeof legacy.room_call === "object" ? legacy.room_call : null;
  return legacy;
}
function activateLegacyClinic(store, clinicId) { const current = readLegacyStore(); if (current?.clinic?.id && current.clinic.id !== clinicId) archiveLegacyStore(store); localStorage.setItem(LEGACY_STORE_KEY, JSON.stringify(buildLegacyStore(store, clinicId))); }
function syncLegacyForSession(store, staffToken) {
  const { session, account } = sessionFor(store, staffToken);
  if (!session.clinic_id || !session.workspace_role) fail({ detail: "Choose a clinic and workspace first." }, 403);
  if (!account.email_verified_at || !account.phone_verified_at) fail({ detail: "Verify both email and phone before opening clinic data." }, 403);
  if (!membershipFor(store, account.id, session.clinic_id)) fail({ detail: "Choose a clinic first." }, 403);
  activateLegacyClinic(store, session.clinic_id); saveAuthStore(store); return { session, account };
}
function isTaskPath(pathname) { return pathname.startsWith("/api/tasks/") || pathname.startsWith("/api/task-comments/"); }
function isOperationalPath(pathname) { return pathname.startsWith("/api/patients/") || pathname.startsWith("/api/visits/"); }

async function registerStaff(store, data) {
  if (!["doctor", "assistant"].includes(data.role)) fail({ role: ["Choose Doctor or Assistant."] });
  validatePassword(data.password, data.password_confirm); const identity = validateIdentityFields(store, data);
  const account = { id: crypto.randomUUID(), role: data.role, ...identity, password_hash: await hashSecret(data.password), email_verified_at: null, phone_verified_at: null, private_note: "", is_active: true, dormant_since: null, anonymized_at: null, created_at: nowIso() };
  store.accounts.push(account); const token = issueSession(store, account.id); saveAuthStore(store);
  return { user: publicUser(store, account, store.sessions[token]), session_token: token, expires_at: null };
}
async function loginStaff(store, data, deviceToken) {
  const account = findAccountByIdentity(store, data.identity), passwordHash = await hashSecret(data.password ?? "");
  if (!account || account.role !== data.role || account.password_hash !== passwordHash) fail({ non_field_errors: ["Role, email/phone, or password is incorrect."] });
  let device = null; if (deviceToken) { try { device = deviceFromToken(store, deviceToken, account.id); } catch { device = null; } }
  const token = issueSession(store, account.id, { deviceId: device?.id ?? null }); saveAuthStore(store);
  return { user: publicUser(store, account, store.sessions[token]), session_token: token, expires_at: null };
}
function profileUpdate(store, staffToken, data) {
  const { session, account } = sessionFor(store, staffToken);
  if (Object.hasOwn(data, "first_name")) { const value = clean(data.first_name); if (!value) fail({ first_name: ["This field may not be blank."] }); account.first_name = value; }
  if (Object.hasOwn(data, "last_name")) { const value = clean(data.last_name); if (!value) fail({ last_name: ["This field may not be blank."] }); account.last_name = value; }
  saveAuthStore(store); return { user: publicUser(store, account, session) };
}
function initialVerificationRequest(store, staffToken, kind) {
  const { account } = sessionFor(store, staffToken), field = kind === "email" ? account.email_verified_at : account.phone_verified_at;
  if (field) return { detail: `${kind === "email" ? "Email" : "Phone"} is already verified.` };
  const challenge = issueChallenge(store, account, { purpose: kind === "email" ? "email_verify" : "phone_verify", channel: kind === "email" ? "email" : "sms" }); saveAuthStore(store);
  return { detail: "Verification code sent.", expires_at: challenge.expires_at, development_code: challenge.code };
}
function initialVerificationConfirm(store, staffToken, kind, code) {
  const { session, account } = sessionFor(store, staffToken); consumeChallenge(store, account, kind === "email" ? "email_verify" : "phone_verify", code);
  if (kind === "email") account.email_verified_at = nowIso(); else account.phone_verified_at = nowIso(); saveAuthStore(store); return { user: publicUser(store, account, session) };
}

function createClinic(store, staffToken, data) {
  const { session, account } = sessionFor(store, staffToken); if (account.role !== "doctor") fail({ detail: "Only Doctor accounts can create clinics." }, 403);
  if (!account.email_verified_at || !account.phone_verified_at) fail({ detail: "Verify both email and phone before creating a clinic." }, 403);
  const name = clean(data.name); if (!name) fail({ name: ["This field may not be blank."] });
  let device = deviceForSession(store, session), rawDevice = null;
  if (!device) {
    if (store.devices.some((item) => item.user_id === account.id)) fail({ detail: "Authorize this browser before creating another clinic." }, 403);
    const issued = issueDevice(store, account.id); device = issued.device; rawDevice = issued.token; session.device_id = device.id;
  }
  const clinic = { id: crypto.randomUUID(), name, timezone: clean(data.timezone) || "UTC", owner_doctor_id: account.id, created_at: nowIso() }; store.clinics.push(clinic);
  const membership = { id: crypto.randomUUID(), user_id: account.id, clinic_id: clinic.id, is_active: true, joined_at: nowIso() }; store.memberships.push(membership);
  session.clinic_id = clinic.id; session.workspace_role = "doctor"; activateLegacyClinic(store, clinic.id); saveAuthStore(store);
  return { clinic: publicClinic(clinic), roles: { doctor: { exists: true, is_administrator: true }, assistant: { exists: false, is_administrator: false } }, membership: publicMembership(store, membership), user: publicUser(store, account, session), trusted_device: publicDevice(device, device.id), ...(rawDevice ? { device_token: rawDevice } : {}) };
}
function chooseWorkspace(store, staffToken, data) {
  const { session, account } = sessionFor(store, staffToken); if (!account.email_verified_at || !account.phone_verified_at) fail({ detail: "Verify both email and phone before opening clinic data." }, 403);
  const device = deviceForSession(store, session); if (!device || device.user_id !== account.id) fail({ detail: "Authorize this browser before opening clinic data." }, 403);
  const membership = membershipFor(store, account.id, data.clinic_id); if (!membership) fail({ detail: "This account does not belong to that clinic." }, 403);
  if (data.workspace_role !== account.role && !(account.role === "doctor" && data.workspace_role === "assistant")) fail({ detail: "This account cannot open that workspace." }, 403);
  archiveLegacyStore(store); session.clinic_id = membership.clinic_id; session.workspace_role = data.workspace_role; activateLegacyClinic(store, membership.clinic_id); saveAuthStore(store); return { user: publicUser(store, account, session) };
}
function clearWorkspace(store, staffToken) { const { session, account } = sessionFor(store, staffToken); archiveLegacyStore(store); session.clinic_id = null; session.workspace_role = null; saveAuthStore(store); return { user: publicUser(store, account, session) }; }

function deviceAuthorizationRequest(store, staffToken, data) {
  const { account } = sessionFor(store, staffToken); if (!account.email_verified_at || !account.phone_verified_at) fail({ detail: "Verify both email and phone before trusting a browser." }, 403);
  const challenge = issueChallenge(store, account, { purpose: "device_authorize", channel: data.channel }); saveAuthStore(store); return { detail: "Verification code sent.", expires_at: challenge.expires_at, development_code: challenge.code };
}
function deviceAuthorizationConfirm(store, staffToken, data) {
  const { session, account } = sessionFor(store, staffToken); consumeChallenge(store, account, "device_authorize", data.code); const issued = issueDevice(store, account.id); session.device_id = issued.device.id; saveAuthStore(store);
  return { device_token: issued.token, trusted_device: publicDevice(issued.device, issued.device.id), user: publicUser(store, account, session) };
}
function deviceList(store, staffToken) { const { session, account } = sessionFor(store, staffToken); return { devices: store.devices.filter((item) => item.user_id === account.id).map((item) => publicDevice(item, session.device_id)) }; }
function deviceDelete(store, staffToken, id) {
  const { session, account } = sessionFor(store, staffToken); const device = store.devices.find((item) => item.id === id && item.user_id === account.id); if (!device) fail({ detail: "Trusted device not found." }, 404); if (session.device_id === id) fail({ detail: "The current trusted device cannot be removed." }, 400);
  store.devices = store.devices.filter((item) => item.id !== id); for (const [token, other] of Object.entries(store.sessions)) if (other.device_id === id) delete store.sessions[token]; saveAuthStore(store); return null;
}

async function reauthenticatePassword(store, staffToken, password) { const { session, account } = sessionFor(store, staffToken); if (await hashSecret(password ?? "") !== account.password_hash) fail({ detail: "Current password is incorrect." }, 403); session.reauthenticated_at = nowIso(); saveAuthStore(store); return { detail: "Reauthenticated." }; }
async function contactChangeRequest(store, staffToken, kind, data) {
  const { session, account } = sessionFor(store, staffToken);
  if (data.current_password) await reauthenticatePassword(store, staffToken, data.current_password); else if (!recentReauth(session)) fail({ detail: "Reauthenticate with your password or a passkey first." }, 403);
  let value; if (kind === "email") { value = normalizeEmail(data.value); if (!value.includes("@")) fail({ value: ["Enter a valid email address."] }); if (store.accounts.some((a) => a.id !== account.id && a.email === value)) fail({ value: ["This email is already in use."] }); } else { value = normalizePhone(data.value); if (store.accounts.some((a) => a.id !== account.id && a.phone === value)) fail({ value: ["This phone number is already in use."] }); }
  const challenge = issueChallenge(store, account, { purpose: kind === "email" ? "email_change" : "phone_change", channel: kind === "email" ? "email" : "sms", pendingValue: value }); saveAuthStore(store); return { detail: "Verification code sent.", expires_at: challenge.expires_at, development_code: challenge.code };
}
function contactChangeConfirm(store, staffToken, kind, code) {
  const { session, account } = sessionFor(store, staffToken); if (!recentReauth(session)) fail({ detail: "Reauthenticate with your password or a passkey first." }, 403); const challenge = consumeChallenge(store, account, kind === "email" ? "email_change" : "phone_change", code);
  if (kind === "email") { account.email = challenge.pending_value; account.email_verified_at = nowIso(); } else { account.phone = challenge.pending_value; account.phone_verified_at = nowIso(); } saveAuthStore(store); return { user: publicUser(store, account, session) };
}
function passwordChangeRequest(store, staffToken, data) { const { account } = sessionFor(store, staffToken); const challenge = issueChallenge(store, account, { purpose: "password_change", channel: data.channel }); saveAuthStore(store); return { detail: "Verification code sent.", expires_at: challenge.expires_at, development_code: challenge.code }; }
async function passwordChangeConfirm(store, staffToken, data) { const { account } = sessionFor(store, staffToken); validatePassword(data.password, data.password_confirm); consumeChallenge(store, account, "password_change", data.code); account.password_hash = await hashSecret(data.password); for (const [token, s] of Object.entries(store.sessions)) if (s.user_id === account.id && token !== staffToken) delete store.sessions[token]; saveAuthStore(store); return { detail: "Password changed. Other sessions were signed out." }; }

function recoveryRequest(store, data) { const account = findAccountByIdentity(store, data.identity); let challenge = null; if (account) { try { challenge = issueChallenge(store, account, { purpose: "password_recovery", channel: data.channel }); } catch { challenge = null; } } saveAuthStore(store); return { detail: "If the account and verified channel exist, a recovery code was sent.", ...(challenge ? { development_code: challenge.code } : {}) }; }
function recoveryConfirm(store, data) { const account = findAccountByIdentity(store, data.identity); if (!account) fail({ detail: "Recovery code is invalid or expired." }); try { consumeChallenge(store, account, "password_recovery", data.code); } catch { fail({ detail: "Recovery code is invalid or expired." }); } const token = randomToken("demo-recovery"); store.recovery_grants[token] = { user_id: account.id, expires_at: expiresIn(RECOVERY_TTL_MS) }; saveAuthStore(store); return { recovery_token: token, expires_at: store.recovery_grants[token].expires_at }; }
function offlineRecoveryConfirm(store, data) { const account = findAccountByIdentity(store, data.identity), codes = account ? store.recovery_codes[account.id] ?? [] : [], entry = codes.find((item) => !item.used_at && item.code === clean(data.code)); if (!account || account.role !== "doctor" || !entry) fail({ detail: "Recovery code is invalid or already used." }); entry.used_at = nowIso(); const token = randomToken("demo-recovery"); store.recovery_grants[token] = { user_id: account.id, expires_at: expiresIn(RECOVERY_TTL_MS) }; saveAuthStore(store); return { recovery_token: token, expires_at: store.recovery_grants[token].expires_at }; }
async function recoveryReset(store, data) { const grant = store.recovery_grants[data.recovery_token]; if (!grant || Date.now() > new Date(grant.expires_at).getTime()) fail({ detail: "Recovery authorization is invalid or expired." }); validatePassword(data.password, data.password_confirm); const account = accountFor(store, grant.user_id); if (!account) fail({ detail: "Recovery authorization is invalid or expired." }); account.password_hash = await hashSecret(data.password); for (const [token, s] of Object.entries(store.sessions)) if (s.user_id === account.id) delete store.sessions[token]; delete store.recovery_grants[data.recovery_token]; saveAuthStore(store); return { detail: "Password reset complete. Sign in again." }; }
function recoveryCodes(store, staffToken, method) { const { account } = sessionFor(store, staffToken); if (account.role !== "doctor") fail({ detail: "Offline recovery codes are available only to Doctors." }, 403); if (method === "GET") { const current = store.recovery_codes[account.id] ?? []; return { remaining: current.filter((item) => !item.used_at).length }; } const codes = Array.from({ length: RECOVERY_CODE_COUNT }, () => recoveryCode()); store.recovery_codes[account.id] = codes.map((code) => ({ code, used_at: null })); saveAuthStore(store); return { codes, remaining: codes.length }; }

function currentAssistantMembership(store, clinicId) { return store.memberships.find((m) => m.clinic_id === clinicId && m.is_active !== false && accountFor(store, m.user_id)?.role === "assistant") ?? null; }
function markDormantIfNeeded(store, userId) { const account = accountFor(store, userId); if (account?.role === "assistant" && activeMemberships(store, userId).length === 0) account.dormant_since = nowIso(); }
function clinicAssistant(store, staffToken) { const { session, account } = sessionFor(store, staffToken); const clinic = store.clinics.find((c) => c.id === session.clinic_id); if (!clinic || account.role !== "doctor" || clinic.owner_doctor_id !== account.id) fail({ detail: "Only the clinic Doctor can manage the Assistant slot." }, 403); const m = currentAssistantMembership(store, clinic.id), assistant = m ? accountFor(store, m.user_id) : null; return { assistant: assistant ? { id: assistant.id, membership_id: m.id, display_name: `${assistant.first_name} ${assistant.last_name}`.trim() || assistant.email, email: assistant.email, phone: assistant.phone } : null }; }
function removeAssistant(store, staffToken) { const { session, account } = sessionFor(store, staffToken); const clinic = store.clinics.find((c) => c.id === session.clinic_id); if (!clinic || account.role !== "doctor" || clinic.owner_doctor_id !== account.id) fail({ detail: "Only the clinic Doctor can manage the Assistant slot." }, 403); const m = currentAssistantMembership(store, clinic.id); if (!m) fail({ detail: "This clinic has no Assistant." }, 404); m.is_active = false; for (const [token, s] of Object.entries(store.sessions)) if (s.user_id === m.user_id && s.clinic_id === clinic.id) delete store.sessions[token]; markDormantIfNeeded(store, m.user_id); saveAuthStore(store); return null; }
function assistantSetup(store, staffToken, data) { const { session, account } = sessionFor(store, staffToken); const clinic = store.clinics.find((c) => c.id === session.clinic_id); if (!clinic || account.role !== "doctor" || clinic.owner_doctor_id !== account.id) fail({ detail: "Only the clinic Doctor can manage the Assistant slot." }, 403); const existing = currentAssistantMembership(store, clinic.id); if (existing && !data.replace_existing) fail({ detail: "This clinic already has an Assistant. Choose replacement explicitly." }, 409); if (existing) { existing.is_active = false; for (const [token, s] of Object.entries(store.sessions)) if (s.user_id === existing.user_id && s.clinic_id === clinic.id) delete store.sessions[token]; markDormantIfNeeded(store, existing.user_id); } const id = crypto.randomUUID(), code = setupCode(); store.setup_codes[id] = { id, clinic_id: clinic.id, created_by_id: account.id, code, used_at: null, expires_at: expiresIn(SETUP_TTL_MS) }; saveAuthStore(store); return { setup_code: code, expires_at: store.setup_codes[id].expires_at }; }
function findSetup(store, code) { return Object.values(store.setup_codes).find((item) => item.code === clean(code) && !item.used_at && Date.now() <= new Date(item.expires_at).getTime()) ?? null; }
function assistantSetupInfo(store, data) { const setup = findSetup(store, data.code); if (!setup) fail({ detail: "Assistant setup code is invalid or expired." }); return { clinic: publicClinic(store.clinics.find((c) => c.id === setup.clinic_id)) }; }
function assistantSetupClaim(store, staffToken, data) {
  const { session, account } = sessionFor(store, staffToken); if (account.role !== "assistant") fail({ detail: "Only an Assistant account can use an Assistant setup code." }, 403); if (!account.email_verified_at || !account.phone_verified_at) fail({ detail: "Verify both email and phone before joining a clinic." }, 403);
  const setup = findSetup(store, data.code); if (!setup) fail({ detail: "Assistant setup code is invalid or expired." }); if (currentAssistantMembership(store, setup.clinic_id)) fail({ detail: "The Assistant slot is already filled." }, 409);
  let device = deviceForSession(store, session), rawDevice = null; if (!device) { if (store.devices.some((item) => item.user_id === account.id)) fail({ detail: "Authorize this browser before joining another clinic." }, 403); const issued = issueDevice(store, account.id); device = issued.device; rawDevice = issued.token; session.device_id = device.id; }
  let membership = membershipFor(store, account.id, setup.clinic_id, true); if (membership?.is_active !== false) fail({ detail: "This account already belongs to this clinic." }, 409); if (membership) membership.is_active = true; else { membership = { id: crypto.randomUUID(), user_id: account.id, clinic_id: setup.clinic_id, is_active: true, joined_at: nowIso() }; store.memberships.push(membership); }
  account.dormant_since = null; setup.used_at = nowIso(); session.clinic_id = setup.clinic_id; session.workspace_role = "assistant"; activateLegacyClinic(store, setup.clinic_id); saveAuthStore(store);
  return { membership: publicMembership(store, membership), user: publicUser(store, account, session), trusted_device: publicDevice(device, device.id), ...(rawDevice ? { device_token: rawDevice } : {}) };
}
function assistantRecovery(store, staffToken, data) { const current = clinicAssistant(store, staffToken); if (!current.assistant) fail({ detail: "This clinic has no Assistant." }, 404); const assistant = accountFor(store, current.assistant.id); const challenge = issueChallenge(store, assistant, { purpose: "password_recovery", channel: data.channel }); saveAuthStore(store); return { detail: "Recovery instructions were sent directly to the Assistant.", development_code: challenge.code }; }

function privateNote(store, staffToken, method, data) { const { session, account } = sessionFor(store, staffToken); if (!session.clinic_id || !membershipFor(store, account.id, session.clinic_id)) fail({ detail: "Choose a clinic first." }, 403); if (session.workspace_role !== account.role) fail({ detail: "Private notes are available only in your own workspace." }, 403); if (method === "GET") return { content: account.private_note ?? "" }; if (typeof data.content !== "string") fail({ content: ["Not a valid string."] }); account.private_note = data.content; saveAuthStore(store); return { content: account.private_note }; }
function passkeyUnavailable(pathname, method) { if (pathname === "/api/passkeys/" && method === "GET") return { passkeys: [] }; fail({ detail: "Passkeys are not simulated as real WebAuthn security in the browser demo. Use email or phone with a password." }, 400); }

function accountDeletePreview(store, staffToken) { const { account } = sessionFor(store, staffToken); if (account.role !== "doctor") fail({ detail: "Assistant accounts are managed through clinic memberships." }, 403); return { clinics: store.clinics.filter((c) => c.owner_doctor_id === account.id).map(publicClinic) }; }
async function deleteDoctorAccount(store, staffToken, data) {
  const { session, account } = sessionFor(store, staffToken); if (account.role !== "doctor") fail({ detail: "Assistant accounts cannot be deleted from account settings." }, 403); if (clean(data.confirmation).toUpperCase() !== "DELETE") fail({ confirmation: ["Type DELETE to confirm permanent account deletion."] });
  if (data.current_password) await reauthenticatePassword(store, staffToken, data.current_password); else if (!recentReauth(session)) fail({ detail: "Reauthenticate with your password or a passkey first." }, 403);
  const clinicIds = store.clinics.filter((c) => c.owner_doctor_id === account.id).map((c) => c.id); archiveLegacyStore(store); store.clinics = store.clinics.filter((c) => !clinicIds.includes(c.id)); const removedMemberships = store.memberships.filter((m) => clinicIds.includes(m.clinic_id)); store.memberships = store.memberships.filter((m) => !clinicIds.includes(m.clinic_id)); for (const m of removedMemberships) if (accountFor(store, m.user_id)?.role === "assistant") markDormantIfNeeded(store, m.user_id); for (const clinicId of clinicIds) delete store.clinic_data[clinicId]; store.devices = store.devices.filter((d) => d.user_id !== account.id); for (const [token, s] of Object.entries(store.sessions)) if (s.user_id === account.id) delete store.sessions[token]; store.accounts = store.accounts.filter((a) => a.id !== account.id); saveAuthStore(store); return null;
}

export async function demoPhase8ApiRequest(path, { method = "GET", data = {}, staffToken, deviceToken } = {}) {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20)); const url = new URL(path, "https://health-hub.demo"), pathname = url.pathname, store = loadAuthStore();
  if (pathname === "/api/health/" && method === "GET") return { status: "ok", service: "Health Hub browser demo API" };
  if (pathname === "/api/staff/register/" && method === "POST") return registerStaff(store, data);
  if (pathname === "/api/staff/login/" && method === "POST") return loginStaff(store, data, deviceToken);
  if (pathname === "/api/staff/me/" && method === "GET") { const { session, account } = sessionFor(store, staffToken); return { user: publicUser(store, account, session) }; }
  if (pathname === "/api/staff/logout/" && method === "POST") { archiveLegacyStore(store); if (staffToken) delete store.sessions[staffToken]; saveAuthStore(store); return null; }
  if (pathname === "/api/staff/profile/" && method === "PATCH") return profileUpdate(store, staffToken, data);
  if (pathname === "/api/clinics/" && method === "POST") return createClinic(store, staffToken, data);
  if (pathname === "/api/staff/select-clinic/" && method === "POST") return chooseWorkspace(store, staffToken, data);
  if (pathname === "/api/staff/leave-clinic/" && method === "POST") return clearWorkspace(store, staffToken);
  if (pathname === "/api/clinic/context/" && method === "GET") { const { session, account } = sessionFor(store, staffToken); return { user: publicUser(store, account, session), ...(session.clinic_id ? { clinic: publicClinic(store.clinics.find((c) => c.id === session.clinic_id)) } : {}) }; }

  if (pathname === "/api/staff/verify/email/request/" && method === "POST") return initialVerificationRequest(store, staffToken, "email");
  if (pathname === "/api/staff/verify/email/confirm/" && method === "POST") return initialVerificationConfirm(store, staffToken, "email", data.code);
  if (pathname === "/api/staff/verify/phone/request/" && method === "POST") return initialVerificationRequest(store, staffToken, "phone");
  if (pathname === "/api/staff/verify/phone/confirm/" && method === "POST") return initialVerificationConfirm(store, staffToken, "phone", data.code);
  if (pathname === "/api/devices/contact/request/" && method === "POST") return deviceAuthorizationRequest(store, staffToken, data);
  if (pathname === "/api/devices/contact/confirm/" && method === "POST") return deviceAuthorizationConfirm(store, staffToken, data);
  if (pathname === "/api/devices/" && method === "GET") return deviceList(store, staffToken);
  const deviceDeleteMatch = pathname.match(/^\/api\/devices\/([0-9a-f-]+)\/$/i); if (deviceDeleteMatch && method === "DELETE") return deviceDelete(store, staffToken, deviceDeleteMatch[1]);
  if (pathname.startsWith("/api/devices/pairing/")) fail({ detail: "The browser demo uses verified email/SMS for new-device authorization." }, 400);

  if (pathname === "/api/staff/reauthenticate/password/" && method === "POST") return reauthenticatePassword(store, staffToken, data.password);
  if (pathname === "/api/staff/email/change/request/" && method === "POST") return contactChangeRequest(store, staffToken, "email", data);
  if (pathname === "/api/staff/email/change/confirm/" && method === "POST") return contactChangeConfirm(store, staffToken, "email", data.code);
  if (pathname === "/api/staff/phone/change/request/" && method === "POST") return contactChangeRequest(store, staffToken, "phone", data);
  if (pathname === "/api/staff/phone/change/confirm/" && method === "POST") return contactChangeConfirm(store, staffToken, "phone", data.code);
  if (pathname === "/api/staff/password/change/request/" && method === "POST") return passwordChangeRequest(store, staffToken, data);
  if (pathname === "/api/staff/password/change/confirm/" && method === "POST") return passwordChangeConfirm(store, staffToken, data);
  if (pathname === "/api/recovery/request/" && method === "POST") return recoveryRequest(store, data);
  if (pathname === "/api/recovery/confirm/" && method === "POST") return recoveryConfirm(store, data);
  if (pathname === "/api/recovery/code/confirm/" && method === "POST") return offlineRecoveryConfirm(store, data);
  if (pathname === "/api/recovery/reset/" && method === "POST") return recoveryReset(store, data);
  if (pathname === "/api/staff/recovery-codes/" && ["GET", "POST"].includes(method)) return recoveryCodes(store, staffToken, method);
  if (pathname.startsWith("/api/passkeys/")) return passkeyUnavailable(pathname, method);

  if (pathname === "/api/clinic/assistant/" && method === "GET") return clinicAssistant(store, staffToken);
  if (pathname === "/api/clinic/assistant/" && method === "DELETE") return removeAssistant(store, staffToken);
  if (pathname === "/api/clinic/assistant/setup/" && method === "POST") return assistantSetup(store, staffToken, data);
  if (pathname === "/api/clinic/assistant/setup/info/" && method === "POST") return assistantSetupInfo(store, data);
  if (pathname === "/api/clinic/assistant/setup/claim/" && method === "POST") return assistantSetupClaim(store, staffToken, data);
  if (pathname === "/api/clinic/assistant/recovery/" && method === "POST") return assistantRecovery(store, staffToken, data);
  if (pathname === "/api/staff/private-note/" && ["GET", "PATCH"].includes(method)) return privateNote(store, staffToken, method, data);
  if (pathname === "/api/staff/account/" && method === "GET") return accountDeletePreview(store, staffToken);
  if (pathname === "/api/staff/account/" && method === "DELETE") return deleteDoctorAccount(store, staffToken, data);

  if (isTaskPath(pathname)) { syncLegacyForSession(store, staffToken); return demoTaskApiRequest(path, { method, data, staffToken }); }
  if (isOperationalPath(pathname)) { syncLegacyForSession(store, staffToken); return demoOperationalApiRequest(path, { method, data, staffToken }); }
  fail({ detail: "This API route is not available in the browser demo." }, 404);
}
