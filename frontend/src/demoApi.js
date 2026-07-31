const STORE_KEY = "health-hub.demo-store.v1";
const TRUNK_ZERO_CODES = new Set(["+33", "+44", "+49", "+90", "+98", "+971"]);
const NATIONAL_LENGTHS = {
  "+1": [10, 10],
  "+33": [9, 9],
  "+44": [9, 10],
  "+49": [7, 11],
  "+90": [10, 10],
  "+98": [10, 10],
  "+971": [8, 9],
};

function emptyStore() {
  return {
    clinic: null,
    staff: [],
    sessions: {},
    patients: [],
    visits: [],
  };
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!parsed || typeof parsed !== "object") return emptyStore();
    return {
      ...emptyStore(),
      ...parsed,
      staff: Array.isArray(parsed.staff) ? parsed.staff : [],
      sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
      patients: Array.isArray(parsed.patients) ? parsed.patients : [],
      visits: Array.isArray(parsed.visits) ? parsed.visits : [],
    };
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
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function publicClinic(clinic) {
  return { id: clinic.id, name: clinic.name, email: clinic.email, phone: clinic.phone };
}

function publicUser(user, clinic) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    display_name: `${user.first_name} ${user.last_name}`.trim() || user.username,
    role: user.role,
    is_clinic_admin: user.role === "doctor",
    clinic: publicClinic(clinic),
  };
}

function publicPatient(patient) {
  return {
    id: patient.id,
    full_name: patient.full_name,
    gender: patient.gender,
    country_calling_code: patient.country_calling_code,
    phone_number: patient.phone_number,
    phone_e164: patient.phone_e164,
    date_of_birth: patient.date_of_birth || null,
    patient_note: patient.patient_note || "",
  };
}

function rolePayload(store) {
  return {
    doctor: { exists: store.staff.some((user) => user.role === "doctor"), is_administrator: true },
    assistant: { exists: store.staff.some((user) => user.role === "assistant"), is_administrator: false },
  };
}

function resolveClinic(store, clinicToken) {
  if (!store.clinic || clinicToken !== `demo-clinic:${store.clinic.id}`) {
    fail({ detail: "Clinic access is invalid or expired." }, 403);
  }
  return store.clinic;
}

function resolveSession(store, staffToken) {
  const userId = store.sessions[staffToken];
  const user = store.staff.find((candidate) => candidate.id === userId);
  if (!user || !store.clinic) fail({ detail: "Staff session is invalid or expired." }, 401);
  return user;
}

function normalizePhone(countryCallingCode, phoneNumber) {
  let code = clean(countryCallingCode).replace(/[\s().-]+/g, "");
  if (code.startsWith("00")) code = `+${code.slice(2)}`;
  if (!/^\+[1-9]\d{0,3}$/.test(code)) {
    fail({ country_calling_code: ["Choose a valid country calling code, such as +98."] });
  }

  let national = clean(phoneNumber).replace(/[\s().-]+/g, "");
  if (national.startsWith("00")) national = `+${national.slice(2)}`;
  if (national.startsWith("+")) {
    if (!national.startsWith(code)) {
      fail({ phone_number: ["The phone number country code must match the selected calling code."] });
    }
    national = national.slice(code.length);
  }
  if (TRUNK_ZERO_CODES.has(code) && national.startsWith("0")) national = national.slice(1);
  if (!/^\d+$/.test(national)) fail({ phone_number: ["Enter a valid national phone number."] });

  const [minimum, maximum] = NATIONAL_LENGTHS[code] ?? [6, 14];
  if (national.length < minimum || national.length > maximum) {
    const message = minimum === maximum
      ? `Phone numbers for ${code} must contain ${minimum} national digits.`
      : `Phone numbers for ${code} must contain between ${minimum} and ${maximum} national digits.`;
    fail({ phone_number: [message] });
  }
  const e164 = `${code}${national}`;
  if (e164.length > 16) fail({ phone_number: ["The international phone number is too long."] });
  return { country_calling_code: code, phone_number: national, phone_e164: e164 };
}

function validatePatient(data, current = null) {
  const fullName = clean(data.full_name ?? current?.full_name);
  const gender = data.gender ?? current?.gender;
  const dateOfBirth = data.date_of_birth === undefined ? current?.date_of_birth ?? null : data.date_of_birth || null;
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

function patientById(store, patientId) {
  const patient = store.patients.find((candidate) => candidate.id === patientId && !candidate.deleted_at);
  if (!patient) fail({ detail: "Patient not found." }, 404);
  return patient;
}

function visitById(store, visitId) {
  const visit = store.visits.find((candidate) => candidate.id === visitId);
  if (!visit) fail({ detail: "Visit not found." }, 404);
  return visit;
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

function isVisitFuture(visit) {
  const today = localDateValue();
  if (visit.date > today) return true;
  if (visit.date < today) return false;
  if (visit.visit_type !== "appointment" || !visit.scheduled_time) return false;
  return visit.scheduled_time > localTimeValue();
}

function publicVisit(store, visit) {
  const activePatient = store.patients.find((candidate) => candidate.id === visit.patient_id && !candidate.deleted_at);
  const patient = activePatient
    ? {
        id: activePatient.id,
        full_name: activePatient.full_name,
        gender: activePatient.gender,
        phone_e164: activePatient.phone_e164,
        date_of_birth: activePatient.date_of_birth || null,
        active: true,
      }
    : {
        id: visit.patient_id,
        full_name: visit.patient_full_name_snapshot,
        gender: visit.patient_gender_snapshot,
        phone_e164: visit.patient_phone_snapshot,
        date_of_birth: visit.patient_date_of_birth_snapshot || null,
        active: false,
      };
  return {
    id: visit.id,
    visit_type: visit.visit_type,
    date: visit.date,
    scheduled_time: visit.scheduled_time,
    reason: visit.reason,
    patient,
    can_delete: isVisitFuture(visit),
    is_future: isVisitFuture(visit),
    created_at: visit.created_at,
    updated_at: visit.updated_at,
  };
}

function normalizeScheduledTime(value) {
  const time = clean(value);
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    fail({ scheduled_time: ["Scheduled time is required."] });
  }
  const [hour, minute, second = "00"] = time.split(":");
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    fail({ scheduled_time: ["Enter a valid scheduled time."] });
  }
  return `${hour}:${minute}:${second}`;
}

function validateVisit(data, current = null) {
  const visitType = data.visit_type ?? current?.visit_type;
  if (!["appointment", "walk_in"].includes(visitType)) {
    fail({ visit_type: ["Choose Appointment or Walk-in."] });
  }
  if (current && data.visit_type && data.visit_type !== current.visit_type) {
    fail({ visit_type: ["Visit type cannot be changed after creation."] });
  }

  if (visitType === "walk_in") {
    return {
      visit_type: visitType,
      date: current?.date ?? localDateValue(),
      scheduled_time: null,
      reason: "",
    };
  }

  const date = data.date ?? current?.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail({ date: ["Appointment date is required."] });
  }
  return {
    visit_type: visitType,
    date,
    scheduled_time: normalizeScheduledTime(data.scheduled_time ?? current?.scheduled_time),
    reason: clean(data.reason === undefined ? current?.reason : data.reason),
  };
}

function resolveVisitPatient(store, data, currentVisit = null) {
  const hasExisting = Boolean(data.patient_id);
  const hasNew = data.new_patient && typeof data.new_patient === "object";
  if (!currentVisit && hasExisting === hasNew) {
    fail({ non_field_errors: ["Choose one existing patient or create one new patient."] });
  }
  if (currentVisit && hasExisting && hasNew) {
    fail({ non_field_errors: ["Choose one existing patient or create one new patient."] });
  }

  if (hasNew) {
    const patient = createPatientCandidate(store, data.new_patient);
    return { patient, isNew: true, changed: true };
  }
  if (hasExisting) {
    const patient = patientById(store, data.patient_id);
    return {
      patient,
      isNew: false,
      changed: !currentVisit || patient.id !== currentVisit.patient_id,
    };
  }
  const patient = store.patients.find((candidate) => candidate.id === currentVisit.patient_id);
  if (!patient) fail({ detail: "Patient not found." }, 404);
  return { patient, isNew: false, changed: false };
}

function capturePatient(visit, patient) {
  visit.patient_id = patient.id;
  visit.patient_full_name_snapshot = patient.full_name;
  visit.patient_gender_snapshot = patient.gender;
  visit.patient_phone_snapshot = patient.phone_e164;
  visit.patient_date_of_birth_snapshot = patient.date_of_birth || null;
}

function createVisit(store, data) {
  const validated = validateVisit(data);
  const patientResolution = resolveVisitPatient(store, data);
  const now = new Date().toISOString();
  const visit = {
    id: crypto.randomUUID(),
    clinic_id: store.clinic.id,
    ...validated,
    created_at: now,
    updated_at: now,
  };
  capturePatient(visit, patientResolution.patient);
  if (patientResolution.isNew) store.patients.push(patientResolution.patient);
  store.visits.push(visit);
  saveStore(store);
  return publicVisit(store, visit);
}

function updateVisit(store, visitId, data) {
  const visit = visitById(store, visitId);
  const validated = validateVisit(data, visit);
  const patientResolution = resolveVisitPatient(store, data, visit);
  Object.assign(visit, validated, { updated_at: new Date().toISOString() });
  if (patientResolution.changed) capturePatient(visit, patientResolution.patient);
  if (patientResolution.isNew) store.patients.push(patientResolution.patient);
  saveStore(store);
  return publicVisit(store, visit);
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

function listVisits(store, date, patientId) {
  let visits = [...store.visits];
  if (date) visits = visits.filter((visit) => visit.date === date);
  if (patientId) {
    patientById(store, patientId);
    visits = visits.filter((visit) => visit.patient_id === patientId);
    visits.sort((first, second) => (
      second.date.localeCompare(first.date)
      || String(second.scheduled_time ?? "").localeCompare(String(first.scheduled_time ?? ""))
      || second.created_at.localeCompare(first.created_at)
    ));
  } else {
    visits.sort((first, second) => (
      first.date.localeCompare(second.date)
      || String(first.scheduled_time ?? "99:99:99").localeCompare(String(second.scheduled_time ?? "99:99:99"))
      || first.created_at.localeCompare(second.created_at)
    ));
  }
  return visits.map((visit) => publicVisit(store, visit));
}

async function createClinic(data) {
  const name = clean(data.name);
  const email = normalizeEmail(data.email);
  const phone = clean(data.phone);
  const password = data.password ?? "";
  if (!name || !email || !phone) fail({ detail: "Complete all clinic fields." });
  if (password !== data.password_confirm) fail({ password_confirm: ["Clinic passwords do not match."] });
  if (password.length < 10) fail({ password: ["Use at least 10 characters for the clinic password."] });

  const store = loadStore();
  if (store.clinic) fail({ detail: "This browser demo already contains a clinic. Clear site data to start again." }, 409);
  const clinic = { id: crypto.randomUUID(), name, email, phone, password_hash: await hashSecret(password) };
  store.clinic = clinic;
  saveStore(store);
  return { clinic: publicClinic(clinic), roles: rolePayload(store), clinic_access_token: `demo-clinic:${clinic.id}` };
}

async function enterClinic(data) {
  const store = loadStore();
  const email = normalizeEmail(data.email);
  const passwordHash = await hashSecret(data.password ?? "");
  if (!store.clinic || store.clinic.email !== email || store.clinic.password_hash !== passwordHash) {
    fail({ non_field_errors: ["Clinic email or password is incorrect."] });
  }
  return { clinic: publicClinic(store.clinic), roles: rolePayload(store), clinic_access_token: `demo-clinic:${store.clinic.id}` };
}

async function registerStaff(data, clinicToken) {
  const store = loadStore();
  const clinic = resolveClinic(store, clinicToken);
  const role = data.role;
  const username = clean(data.username);
  const email = normalizeEmail(data.email);
  const firstName = clean(data.first_name);
  const lastName = clean(data.last_name);
  const password = data.password ?? "";
  if (!["doctor", "assistant"].includes(role)) fail({ role: ["Choose Doctor or Assistant."] });
  if (store.staff.some((user) => user.role === role)) fail({ role: ["This clinic already has an account for this role."] }, 409);
  if (store.staff.some((user) => user.username.toLowerCase() === username.toLowerCase())) fail({ username: ["This username is already in use."] });
  if (store.staff.some((user) => user.email === email)) fail({ email: ["This email is already in use."] });
  if (!username || !email || !firstName || !lastName) fail({ detail: "Complete all staff fields." });
  if (password !== data.password_confirm) fail({ password_confirm: ["Staff passwords do not match."] });
  if (password.length < 8) fail({ password: ["Use at least 8 characters for the staff password."] });

  const user = {
    id: crypto.randomUUID(),
    username,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    password_hash: await hashSecret(password),
  };
  store.staff.push(user);
  const sessionToken = randomToken("demo-staff");
  store.sessions[sessionToken] = user.id;
  saveStore(store);
  return { user: publicUser(user, clinic), session_token: sessionToken, expires_at: null };
}

async function loginStaff(data, clinicToken) {
  const store = loadStore();
  const clinic = resolveClinic(store, clinicToken);
  const username = clean(data.username).toLowerCase();
  const passwordHash = await hashSecret(data.password ?? "");
  const user = store.staff.find((candidate) => candidate.role === data.role && candidate.username.toLowerCase() === username);
  if (!user || user.password_hash !== passwordHash) fail({ non_field_errors: ["Username or password is incorrect."] });
  const sessionToken = randomToken("demo-staff");
  store.sessions[sessionToken] = user.id;
  saveStore(store);
  return { user: publicUser(user, clinic), session_token: sessionToken, expires_at: null };
}

export async function demoApiRequest(path, { method = "GET", data = {}, clinicToken, staffToken } = {}) {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 20));
  const url = new URL(path, "https://health-hub.demo");
  const pathname = url.pathname;

  if (pathname === "/api/clinics/" && method === "POST") return createClinic(data);
  if (pathname === "/api/clinics/enter/" && method === "POST") return enterClinic(data);

  if (pathname === "/api/clinic/context/" && method === "GET") {
    const store = loadStore();
    const clinic = resolveClinic(store, clinicToken);
    return { clinic: publicClinic(clinic), roles: rolePayload(store) };
  }

  if (pathname === "/api/staff/register/" && method === "POST") return registerStaff(data, clinicToken);
  if (pathname === "/api/staff/login/" && method === "POST") return loginStaff(data, clinicToken);

  if (pathname === "/api/staff/me/" && method === "GET") {
    const store = loadStore();
    const user = resolveSession(store, staffToken);
    return { user: publicUser(user, store.clinic) };
  }

  if (pathname === "/api/staff/logout/" && method === "POST") {
    const store = loadStore();
    if (staffToken) delete store.sessions[staffToken];
    saveStore(store);
    return null;
  }

  const store = loadStore();
  resolveSession(store, staffToken);

  if (pathname === "/api/patients/" && method === "GET") {
    return { patients: listPatients(store, url.searchParams.get("search")) };
  }
  if (pathname === "/api/patients/" && method === "POST") return createPatient(store, data);

  const patientMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/$/i);
  if (patientMatch) {
    const patientId = patientMatch[1];
    if (method === "GET") return publicPatient(patientById(store, patientId));
    if (method === "PATCH") return updatePatient(store, patientId, data);
    if (method === "DELETE") {
      const patient = patientById(store, patientId);
      const futureVisits = store.visits.filter((visit) => visit.patient_id === patient.id && isVisitFuture(visit));
      if (futureVisits.length) {
        fail({
          code: "future_visits_exist",
          detail: "Remove future visits before deleting this patient.",
          future_visit_count: futureVisits.length,
        }, 409);
      }
      patient.deleted_at = new Date().toISOString();
      saveStore(store);
      return null;
    }
  }

  if (pathname === "/api/visits/" && method === "GET") {
    return {
      visits: listVisits(
        store,
        url.searchParams.get("date"),
        url.searchParams.get("patient"),
      ),
    };
  }
  if (pathname === "/api/visits/" && method === "POST") return createVisit(store, data);

  const visitMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/$/i);
  if (visitMatch) {
    const visitId = visitMatch[1];
    if (method === "GET") return publicVisit(store, visitById(store, visitId));
    if (method === "PATCH") return updateVisit(store, visitId, data);
    if (method === "DELETE") {
      const visit = visitById(store, visitId);
      if (!isVisitFuture(visit)) {
        fail({ code: "visit_not_future", detail: "Only future visits can be removed." }, 400);
      }
      store.visits = store.visits.filter((candidate) => candidate.id !== visit.id);
      saveStore(store);
      return null;
    }
  }

  fail({ detail: "This API route is not available in the browser demo." }, 404);
}
