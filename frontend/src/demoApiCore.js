import { UNDO_WINDOW_MS, localDateValue, localTimeValue, loadStore, saveStore, fail, clean, normalizeEmail, randomToken, hashSecret, publicClinic, publicUser, publicPatient, rolePayload, resolveClinic, resolveSession, requireAssistantWorkspace, patientById, createPatientCandidate, createPatient, updatePatient, listPatients } from "./demoApiBase.js";

function visitById(store, visitId, { includeDeleted = false, deletedOnly = false } = {}) { const visit = store.visits.find((candidate) => candidate.id === visitId && (includeDeleted || !candidate.deleted_at) && (!deletedOnly || candidate.deleted_at)); if (!visit)
    fail({ detail: deletedOnly ? "Deleted appointment not found." : "Appointment not found." }, 404); return visit; }

function normalizeScheduledTime(value) { const time = clean(value); if (!/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    fail({ scheduled_time: ["Scheduled time is required."] });
} const [hour, minute, second = "00"] = time.split(":"); if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    fail({ scheduled_time: ["Enter a valid scheduled time."] });
} return `${hour}:${minute}:${second}`; }

function validateVisit(data, current = null) { if (Object.hasOwn(data, "visit_type")) {
    fail({ visit_type: ["Appointment payloads do not accept visit_type."] });
} const date = data.date ?? current?.date; if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail({ date: ["Appointment date is required."] });
} const scheduledTime = normalizeScheduledTime(data.scheduled_time ?? current?.scheduled_time); if (current?.status === "checked_in") {
    if (Object.hasOwn(data, "date") && date !== current.date) {
        fail({ date: ["The appointment date cannot change after check-in."] });
    }
    if (data.new_patient || (data.patient_id && data.patient_id !== current.patient_id)) {
        fail({ patient_id: ["The Patient cannot change after check-in."] });
    }
} return { date, scheduled_time: scheduledTime, reason: clean(data.reason === undefined ? current?.reason : data.reason), }; }

function resolveVisitPatient(store, data, currentVisit = null) { const hasExisting = Boolean(data.patient_id); const hasNew = data.new_patient && typeof data.new_patient === "object"; if (!currentVisit && hasExisting === hasNew) {
    fail({ non_field_errors: ["Choose one existing patient or create one new patient."] });
} if (currentVisit && hasExisting && hasNew) {
    fail({ non_field_errors: ["Choose one existing patient or create one new patient."] });
} if (currentVisit?.status === "checked_in" && (hasExisting || hasNew)) {
    if (hasNew || data.patient_id !== currentVisit.patient_id) {
        fail({ patient_id: ["The Patient cannot change after check-in."] });
    }
} if (hasNew) {
    const patient = createPatientCandidate(store, data.new_patient);
    return { patient, isNew: true, changed: true };
} if (hasExisting) {
    const patient = patientById(store, data.patient_id);
    return { patient, isNew: false, changed: !currentVisit || patient.id !== currentVisit.patient_id };
} const patient = store.patients.find((candidate) => candidate.id === currentVisit.patient_id); if (!patient)
    fail({ detail: "Patient not found." }, 404); return { patient, isNew: false, changed: false }; }

function capturePatient(visit, patient) { visit.patient_id = patient.id; visit.patient_full_name_snapshot = patient.full_name; visit.patient_gender_snapshot = patient.gender; visit.patient_phone_snapshot = patient.phone_e164; visit.patient_date_of_birth_snapshot = patient.date_of_birth || null; }

function isVisitFuture(visit) { const today = localDateValue(); if (visit.date > today)
    return true; if (visit.date < today)
    return false; return visit.scheduled_time > localTimeValue(); }

function canDeleteVisit(visit) { return visit.date >= localDateValue(); }

function addMilliseconds(isoValue, milliseconds) { return new Date(new Date(isoValue).getTime() + milliseconds).toISOString(); }

function publicVisit(store, visit) { const activePatient = store.patients.find((candidate) => candidate.id === visit.patient_id && !candidate.deleted_at); const patient = activePatient ? { id: activePatient.id, full_name: activePatient.full_name, gender: activePatient.gender, phone_e164: activePatient.phone_e164, date_of_birth: activePatient.date_of_birth || null, active: true, } : { id: visit.patient_id, full_name: visit.patient_full_name_snapshot, gender: visit.patient_gender_snapshot, phone_e164: visit.patient_phone_snapshot, date_of_birth: visit.patient_date_of_birth_snapshot || null, active: false, }; return { id: visit.id, date: visit.date, scheduled_time: visit.scheduled_time, reason: visit.reason, patient, status: visit.status, checked_in_at: visit.checked_in_at, check_in_undo_until: visit.checked_in_at ? addMilliseconds(visit.checked_in_at, UNDO_WINDOW_MS) : null, can_check_in: visit.date === localDateValue() && visit.status === "planned", can_delete: canDeleteVisit(visit), is_future: isVisitFuture(visit), created_at: visit.created_at, updated_at: visit.updated_at, }; }

function createVisit(store, data) { const validated = validateVisit(data); const patientResolution = resolveVisitPatient(store, data); const now = new Date().toISOString(); const visit = { id: crypto.randomUUID(), clinic_id: store.clinic.id, ...validated, status: "planned", checked_in_at: null, queue_sequence: null, deleted_at: null, created_at: now, updated_at: now, }; capturePatient(visit, patientResolution.patient); if (patientResolution.isNew)
    store.patients.push(patientResolution.patient); store.visits.push(visit); saveStore(store); return publicVisit(store, visit); }

function updateVisit(store, visitId, data) { const visit = visitById(store, visitId); const validated = validateVisit(data, visit); const patientResolution = resolveVisitPatient(store, data, visit); Object.assign(visit, validated, { updated_at: new Date().toISOString() }); if (patientResolution.changed)
    capturePatient(visit, patientResolution.patient); if (patientResolution.isNew)
    store.patients.push(patientResolution.patient); saveStore(store); return publicVisit(store, visit); }

function listVisits(store, date, patientId) { let visits = store.visits.filter((visit) => !visit.deleted_at); if (date)
    visits = visits.filter((visit) => visit.date === date); if (patientId) {
    patientById(store, patientId);
    visits = visits.filter((visit) => visit.patient_id === patientId);
    visits.sort((first, second) => (second.date.localeCompare(first.date) || second.scheduled_time.localeCompare(first.scheduled_time) || second.created_at.localeCompare(first.created_at)));
}
else {
    visits.sort((first, second) => (first.date.localeCompare(second.date) || first.scheduled_time.localeCompare(second.scheduled_time) || first.created_at.localeCompare(second.created_at)));
} return visits.map((visit) => publicVisit(store, visit)); }

function queueVisits(store, workspaceRole) { return store.visits.filter((visit) => !visit.deleted_at && visit.date === localDateValue() && visit.status === "checked_in").sort((first, second) => (Number(first.queue_sequence) - Number(second.queue_sequence) || String(first.checked_in_at).localeCompare(String(second.checked_in_at)) || first.created_at.localeCompare(second.created_at))).map((visit, index) => { const item = publicVisit(store, visit); const patient = { ...item.patient }; if (workspaceRole === "doctor")
    delete patient.phone_e164; return { id: item.id, queue_position: index + 1, scheduled_time: item.scheduled_time, reason: item.reason, patient, status: item.status, checked_in_at: item.checked_in_at, }; }); }

async function createClinic(data) { const name = clean(data.name); const email = normalizeEmail(data.email); const phone = clean(data.phone); const password = data.password ?? ""; if (!name || !email || !phone)
    fail({ detail: "Complete all clinic fields." }); if (password !== data.password_confirm)
    fail({ password_confirm: ["Clinic passwords do not match."] }); if (password.length < 10)
    fail({ password: ["Use at least 10 characters for the clinic password."] }); const store = loadStore(); if (store.clinic)
    fail({ detail: "This browser demo already contains a clinic. Clear site data to start again." }, 409); const clinic = { id: crypto.randomUUID(), name, email, phone, password_hash: await hashSecret(password) }; store.clinic = clinic; saveStore(store); return { clinic: publicClinic(clinic), roles: rolePayload(store), clinic_access_token: `demo-clinic:${clinic.id}` }; }

async function enterClinic(data) { const store = loadStore(); const email = normalizeEmail(data.email); const passwordHash = await hashSecret(data.password ?? ""); if (!store.clinic || store.clinic.email !== email || store.clinic.password_hash !== passwordHash) {
    fail({ non_field_errors: ["Clinic email or password is incorrect."] });
} return { clinic: publicClinic(store.clinic), roles: rolePayload(store), clinic_access_token: `demo-clinic:${store.clinic.id}` }; }

async function registerStaff(data, clinicToken) { const store = loadStore(); const clinic = resolveClinic(store, clinicToken); const role = data.role; const username = clean(data.username); const email = normalizeEmail(data.email); const firstName = clean(data.first_name); const lastName = clean(data.last_name); const password = data.password ?? ""; if (!["doctor", "assistant"].includes(role))
    fail({ role: ["Choose Doctor or Assistant."] }); if (store.staff.some((user) => user.role === role))
    fail({ role: ["This clinic already has an account for this role."] }, 409); if (store.staff.some((user) => user.username.toLowerCase() === username.toLowerCase()))
    fail({ username: ["This username is already in use."] }); if (store.staff.some((user) => user.email === email))
    fail({ email: ["This email is already in use."] }); if (!username || !email || !firstName || !lastName)
    fail({ detail: "Complete all staff fields." }); if (password !== data.password_confirm)
    fail({ password_confirm: ["Staff passwords do not match."] }); if (password.length < 8)
    fail({ password: ["Use at least 8 characters for the staff password."] }); const user = { id: crypto.randomUUID(), username, email, first_name: firstName, last_name: lastName, role, password_hash: await hashSecret(password), }; store.staff.push(user); const sessionToken = randomToken("demo-staff"); store.sessions[sessionToken] = { user_id: user.id, workspace_role: role }; saveStore(store); return { user: publicUser(user, clinic, role), session_token: sessionToken, expires_at: null }; }

async function loginStaff(data, clinicToken) { const store = loadStore(); const clinic = resolveClinic(store, clinicToken); const username = clean(data.username).toLowerCase(); const passwordHash = await hashSecret(data.password ?? ""); const workspaceRole = data.role; const user = store.staff.find((candidate) => candidate.username.toLowerCase() === username); const allowed = user && (user.role === workspaceRole || (user.role === "doctor" && workspaceRole === "assistant")); if (!allowed || user.password_hash !== passwordHash)
    fail({ non_field_errors: ["Username or password is incorrect."] }); const sessionToken = randomToken("demo-staff"); store.sessions[sessionToken] = { user_id: user.id, workspace_role: workspaceRole }; saveStore(store); return { user: publicUser(user, clinic, workspaceRole), session_token: sessionToken, expires_at: null }; }

export { UNDO_WINDOW_MS, localDateValue, localTimeValue, loadStore, saveStore, publicClinic, publicUser, publicPatient, rolePayload, resolveClinic, resolveSession, requireAssistantWorkspace, listPatients, createPatient, patientById, updatePatient, addMilliseconds, listVisits, createVisit, queueVisits, visitById, publicVisit, updateVisit, canDeleteVisit, createClinic, enterClinic, registerStaff, loginStaff, fail };
