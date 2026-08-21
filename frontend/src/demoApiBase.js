import { browserTimeZone, dateValueInTimeZone, timeValueInTimeZone } from "./clinicTime.js";
import { normalizePatientPhone, patientPhoneParts } from "./patientPhoneFormats.js";

const STORE_KEY = "health-hub.demo-store.v1";

const UNDO_WINDOW_MS = 5000;

function emptyStore() {
  return {
    clinic: null,
    staff: [],
    sessions: {},
    patients: [],
    visits: [],
    room_call: null,
  };
}

function activeStoreTimeZone() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    return parsed?.clinic?.timezone || null;
  } catch {
    return null;
  }
}

function localDateValue(date = new Date()) {
  return dateValueInTimeZone(activeStoreTimeZone() || browserTimeZone(), date);
}

function localTimeValue(date = new Date()) {
  return timeValueInTimeZone(
    activeStoreTimeZone() || browserTimeZone(),
    date,
    { seconds: true },
  );
}

function timeFromIso(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return localTimeValue();
  return localTimeValue(date);
}

function migrateStore(parsed) {
  const store = {
    ...emptyStore(),
    ...parsed,
    staff: Array.isArray(parsed?.staff) ? parsed.staff : [],
    sessions: parsed?.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
    patients: Array.isArray(parsed?.patients) ? parsed.patients : [],
    visits: Array.isArray(parsed?.visits) ? parsed.visits : [],
    room_call: parsed?.room_call && typeof parsed.room_call === "object" ? parsed.room_call : null,
  };

  if (store.clinic && !store.clinic.timezone) {
    store.clinic.timezone = browserTimeZone();
  }

  store.sessions = Object.fromEntries(
    Object.entries(store.sessions).map(([token, session]) => {
      if (typeof session === "string") {
        const user = store.staff.find((candidate) => candidate.id === session);
        return [token, { user_id: session, workspace_role: user?.role ?? "assistant" }];
      }
      return [token, session];
    }),
  );

  store.staff = store.staff.map((user) => ({
    ...user,
    private_note: typeof user.private_note === "string" ? user.private_note : "",
  }));

  store.patients = store.patients.map((patient) => ({
    ...patient,
    ...patientPhoneParts(patient),
  }));

  const validStatuses = new Set(["planned", "checked_in", "with_doctor", "doctor_finished"]);
  store.visits = store.visits.map((visit) => {
    const migrated = { ...visit };
    if (migrated.visit_type) {
      if (!migrated.scheduled_time) migrated.scheduled_time = timeFromIso(migrated.created_at);
      delete migrated.visit_type;
    }
    migrated.status = validStatuses.has(migrated.status) ? migrated.status : "planned";
    migrated.checked_in_at = migrated.status === "planned"
      ? null
      : migrated.checked_in_at ?? migrated.updated_at;
    migrated.queue_sequence = migrated.status === "planned"
      ? null
      : migrated.queue_sequence ?? null;
    migrated.with_doctor_at = ["with_doctor", "doctor_finished"].includes(migrated.status)
      ? migrated.with_doctor_at ?? migrated.updated_at
      : null;
    migrated.doctor_finished_at = migrated.status === "doctor_finished"
      ? migrated.doctor_finished_at ?? migrated.updated_at
      : null;
    migrated.deleted_at = migrated.deleted_at ?? null;
    return migrated;
  });

  let nextSequence = store.visits.reduce(
    (maximum, visit) => Math.max(maximum, Number(visit.queue_sequence) || 0),
    0,
  ) + 1;
  for (const visit of store.visits
    .filter((item) => item.status !== "planned" && item.queue_sequence == null)
    .sort((a, b) => String(a.checked_in_at).localeCompare(String(b.checked_in_at)))) {
    visit.queue_sequence = nextSequence;
    nextSequence += 1;
  }

  if (store.room_call) {
    store.room_call.date = store.room_call.date ?? localDateValue();
    store.room_call.selected_visit_id = store.room_call.selected_visit_id ?? null;
    store.room_call.consumed_at = store.room_call.consumed_at ?? null;
    store.room_call.previous_visit_id = store.room_call.previous_visit_id ?? null;
  }

  return store;
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!parsed || typeof parsed !== "object") return emptyStore();
    const migrated = migrateStore(parsed);
    saveStore(migrated);
    return migrated;
  } catch {
    return emptyStore();
  }
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function fail(payload, status = 400) {
  const error = new Error("Demo API request failed.");
  error.payload = payload;
  error.status = status;
  throw error;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeName(value) {
  return clean(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}_]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function randomToken(prefix) {
  return `${prefix}:${crypto.randomUUID()}`;
}

async function hashSecret(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

function publicClinic(clinic) {
  return {
    id: clinic.id,
    name: clinic.name,
    email: clinic.email,
    phone: clinic.phone,
    timezone: clinic.timezone || browserTimeZone(),
  };
}

function publicUser(user, clinic, workspaceRole = user.role) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    display_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
    role: user.role,
    workspace_role: workspaceRole,
    is_clinic_admin: user.role === "doctor",
    clinic: publicClinic(clinic),
  };
}

function publicPatient(patient) {
  const phone = patientPhoneParts(patient);
  return {
    id: patient.id,
    full_name: patient.full_name,
    gender: patient.gender,
    ...phone,
    phone_e164: patient.phone_e164,
    date_of_birth: patient.date_of_birth || null,
    patient_note: patient.patient_note || "",
  };
}

function rolePayload(store) {
  return {
    doctor: {
      exists: store.staff.some((user) => user.role === "doctor"),
      is_administrator: true,
    },
    assistant: {
      exists: store.staff.some((user) => user.role === "assistant"),
      is_administrator: false,
    },
  };
}

function resolveSession(store, staffToken) {
  const session = store.sessions[staffToken];
  const user = store.staff.find((candidate) => candidate.id === session?.user_id);
  if (!user || !store.clinic) fail({ detail: "Staff session is invalid or expired." }, 401);
  return { user, workspaceRole: session.workspace_role || user.role };
}

function requireAssistantWorkspace(session) {
  if (session.workspaceRole !== "assistant") {
    fail({ detail: "Open the Assistant workspace to manage Patients and appointments." }, 403);
  }
}

function requireDoctorWorkspace(session) {
  if (session.workspaceRole !== "doctor") {
    fail({ detail: "Open the Doctor workspace to signal that the room is ready." }, 403);
  }
}

function normalizePhone(countryCallingCode, phoneNumber) {
  try {
    return normalizePatientPhone(countryCallingCode, phoneNumber);
  } catch (error) {
    fail({ phone_number: [error.message] });
  }
}

function validatePatient(data, current = null) {
  const fullName = clean(data.full_name ?? current?.full_name);
  const gender = data.gender ?? current?.gender;
  const dateOfBirth = data.date_of_birth === undefined
    ? current?.date_of_birth ?? null
    : data.date_of_birth || null;
  const patientNote = clean(data.patient_note === undefined ? current?.patient_note : data.patient_note);
  if (!normalizeName(fullName)) fail({ full_name: ["Full name is required."] });
  if (!["Man", "Woman"].includes(gender)) fail({ gender: ["Choose Man or Woman."] });
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    fail({ date_of_birth: ["Enter a valid date of birth."] });
  }
  return {
    full_name: fullName.replace(/\s+/g, " "),
    normalized_name: normalizeName(fullName),
    gender,
    ...normalizePhone(
      data.country_calling_code ?? current?.country_calling_code ?? "+98",
      data.phone_number ?? current?.phone_number ?? "",
    ),
    date_of_birth: dateOfBirth,
    patient_note: patientNote,
  };
}

function editDistance(first, second) {
  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= second.length; column += 1) {
      current[column] = Math.min(
        current[column - 1] + 1,
        previous[column] + 1,
        previous[column - 1] + (first[row - 1] === second[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[second.length];
}

function namesAreSimilar(first, second) {
  const a = normalizeName(first);
  const b = normalizeName(second);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.split(" ").sort().join(" ") === b.split(" ").sort().join(" ")) return true;
  return 1 - editDistance(a, b) / Math.max(a.length, b.length) >= 0.82;
}

function duplicateMatches(store, candidate, excludeId = null) {
  return store.patients
    .filter((patient) => !patient.deleted_at && patient.id !== excludeId && patient.phone_e164 === candidate.phone_e164)
    .filter((patient) => namesAreSimilar(patient.full_name, candidate.full_name))
    .slice(0, 5);
}

function possibleDuplicate(matches) {
  fail({
    code: "possible_duplicate",
    detail: "Possible duplicate patient",
    matches: matches.map(publicPatient),
  }, 409);
}

function patientById(store, patientId, { includeDeleted = false } = {}) {
  const patient = store.patients.find(
    (candidate) => candidate.id === patientId && (includeDeleted || !candidate.deleted_at),
  );
  if (!patient) fail({ detail: "Patient not found." }, 404);
  return patient;
}

function createPatientCandidate(store, data) {
  const candidate = validatePatient(data);
  const matches = duplicateMatches(store, candidate);
  if (matches.length && !data.confirm_duplicate) possibleDuplicate(matches);
  return {
    id: crypto.randomUUID(),
    clinic_id: store.clinic.id,
    ...candidate,
    deleted_at: null,
  };
}

function createPatient(store, data) {
  const patient = createPatientCandidate(store, data);
  store.patients.push(patient);
  saveStore(store);
  return publicPatient(patient);
}

function updatePatient(store, patientId, data) {
  const patient = patientById(store, patientId);
  const candidate = validatePatient(data, patient);
  const identityChanged = candidate.full_name !== patient.full_name
    || candidate.phone_e164 !== patient.phone_e164
    || candidate.date_of_birth !== patient.date_of_birth;
  const matches = identityChanged ? duplicateMatches(store, candidate, patient.id) : [];
  if (matches.length && !data.confirm_duplicate) possibleDuplicate(matches);
  Object.assign(patient, candidate);
  saveStore(store);
  return publicPatient(patient);
}

function listPatients(store, search) {
  const query = clean(search);
  const normalized = normalizeName(query);
  const digits = query.replace(/\D/g, "");
  return store.patients
    .filter((patient) => !patient.deleted_at)
    .filter((patient) => !query
      || patient.normalized_name.includes(normalized)
      || (digits && (patient.phone_number.includes(digits) || patient.phone_e164.replace(/\D/g, "").includes(digits)))
      || patient.date_of_birth === query)
    .sort((first, second) => first.normalized_name.localeCompare(second.normalized_name))
    .map(publicPatient);
}

export {
  emptyStore,
  localDateValue,
  localTimeValue,
  timeFromIso,
  migrateStore,
  loadStore,
  saveStore,
  fail,
  clean,
  normalizeEmail,
  normalizeName,
  randomToken,
  hashSecret,
  publicClinic,
  publicUser,
  publicPatient,
  rolePayload,
  resolveSession,
  requireAssistantWorkspace,
  requireDoctorWorkspace,
  normalizePhone,
  validatePatient,
  editDistance,
  namesAreSimilar,
  duplicateMatches,
  possibleDuplicate,
  patientById,
  createPatientCandidate,
  createPatient,
  updatePatient,
  listPatients,
  UNDO_WINDOW_MS,
};
