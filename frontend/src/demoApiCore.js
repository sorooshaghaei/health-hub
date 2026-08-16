import {
  UNDO_WINDOW_MS,
  clean,
  createPatient,
  createPatientCandidate,
  fail,
  hashSecret,
  listPatients,
  loadStore,
  localDateValue,
  localTimeValue,
  normalizeEmail,
  patientById,
  publicClinic,
  publicPatient,
  publicUser,
  randomToken,
  requireAssistantWorkspace,
  requireDoctorWorkspace,
  resolveSession,
  rolePayload,
  saveStore,
  updatePatient,
} from "./demoApiBase.js";

function visitById(store, visitId, { includeDeleted = false, deletedOnly = false } = {}) {
  const visit = store.visits.find(
    (candidate) => candidate.id === visitId
      && (includeDeleted || !candidate.deleted_at)
      && (!deletedOnly || candidate.deleted_at),
  );
  if (!visit) {
    fail(
      { detail: deletedOnly ? "Deleted appointment not found." : "Appointment not found." },
      404,
    );
  }
  return visit;
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
  if (Object.hasOwn(data, "visit_type")) {
    fail({ visit_type: ["Appointment payloads do not accept visit_type."] });
  }

  const date = data.date ?? current?.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    fail({ date: ["Appointment date is required."] });
  }
  const scheduledTime = normalizeScheduledTime(data.scheduled_time ?? current?.scheduled_time);

  if (current?.status !== undefined && current.status !== "planned") {
    if (Object.hasOwn(data, "date") && date !== current.date) {
      fail({ date: ["The appointment date cannot change after check-in."] });
    }
    if (data.new_patient || (data.patient_id && data.patient_id !== current.patient_id)) {
      fail({ patient_id: ["The Patient cannot change after check-in."] });
    }
  }

  return {
    date,
    scheduled_time: scheduledTime,
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
  if (currentVisit?.status !== undefined && currentVisit.status !== "planned" && (hasExisting || hasNew)) {
    if (hasNew || data.patient_id !== currentVisit.patient_id) {
      fail({ patient_id: ["The Patient cannot change after check-in."] });
    }
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

function isVisitFuture(visit) {
  const today = localDateValue();
  if (visit.date > today) return true;
  if (visit.date < today) return false;
  return visit.scheduled_time > localTimeValue();
}

function canDeleteVisit(visit) {
  return visit.date >= localDateValue()
    && ["planned", "checked_in"].includes(visit.status);
}

function addMilliseconds(isoValue, milliseconds) {
  return new Date(new Date(isoValue).getTime() + milliseconds).toISOString();
}

function publicPatientForVisit(store, visit) {
  const activePatient = store.patients.find(
    (candidate) => candidate.id === visit.patient_id && !candidate.deleted_at,
  );
  if (activePatient) {
    return {
      id: activePatient.id,
      full_name: activePatient.full_name,
      gender: activePatient.gender,
      phone_e164: activePatient.phone_e164,
      date_of_birth: activePatient.date_of_birth || null,
      patient_note: activePatient.patient_note || "",
      active: true,
    };
  }
  return {
    id: visit.patient_id,
    full_name: visit.patient_full_name_snapshot,
    gender: visit.patient_gender_snapshot,
    phone_e164: visit.patient_phone_snapshot,
    date_of_birth: visit.patient_date_of_birth_snapshot || null,
    patient_note: "",
    active: false,
  };
}

function publicVisit(store, visit) {
  return {
    id: visit.id,
    date: visit.date,
    scheduled_time: visit.scheduled_time,
    reason: visit.reason,
    patient: publicPatientForVisit(store, visit),
    status: visit.status,
    checked_in_at: visit.checked_in_at,
    with_doctor_at: visit.with_doctor_at,
    doctor_finished_at: visit.doctor_finished_at,
    check_in_undo_until: visit.status === "checked_in" && visit.checked_in_at
      ? addMilliseconds(visit.checked_in_at, UNDO_WINDOW_MS)
      : null,
    with_doctor_undo_until: visit.status === "with_doctor" && visit.with_doctor_at
      ? addMilliseconds(visit.with_doctor_at, UNDO_WINDOW_MS)
      : null,
    can_check_in: visit.date === localDateValue() && visit.status === "planned",
    can_delete: canDeleteVisit(visit),
    is_future: isVisitFuture(visit),
    created_at: visit.created_at,
    updated_at: visit.updated_at,
  };
}

function createVisit(store, data) {
  const validated = validateVisit(data);
  const patientResolution = resolveVisitPatient(store, data);
  const now = new Date().toISOString();
  const visit = {
    id: crypto.randomUUID(),
    clinic_id: store.clinic.id,
    ...validated,
    status: "planned",
    checked_in_at: null,
    queue_sequence: null,
    with_doctor_at: null,
    doctor_finished_at: null,
    deleted_at: null,
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

function listVisits(store, date, patientId) {
  let visits = store.visits.filter((visit) => !visit.deleted_at);
  if (date) visits = visits.filter((visit) => visit.date === date);
  if (patientId) {
    patientById(store, patientId);
    visits = visits.filter((visit) => visit.patient_id === patientId);
    visits.sort(
      (first, second) => second.date.localeCompare(first.date)
        || second.scheduled_time.localeCompare(first.scheduled_time)
        || second.created_at.localeCompare(first.created_at),
    );
  } else {
    visits.sort(
      (first, second) => first.date.localeCompare(second.date)
        || first.scheduled_time.localeCompare(second.scheduled_time)
        || first.created_at.localeCompare(second.created_at),
    );
  }
  return visits.map((visit) => publicVisit(store, visit));
}

function orderedQueue(store) {
  return store.visits
    .filter(
      (visit) => !visit.deleted_at
        && visit.date === localDateValue()
        && visit.status === "checked_in",
    )
    .sort(
      (first, second) => Number(first.queue_sequence) - Number(second.queue_sequence)
        || String(first.checked_in_at).localeCompare(String(second.checked_in_at))
        || first.created_at.localeCompare(second.created_at),
    );
}

function queueVisits(store, workspaceRole) {
  return orderedQueue(store).map((visit, index) => {
    const item = publicVisit(store, visit);
    const patient = { ...item.patient };
    delete patient.patient_note;
    if (workspaceRole === "doctor") delete patient.phone_e164;
    return {
      id: item.id,
      queue_position: index + 1,
      scheduled_time: item.scheduled_time,
      reason: item.reason,
      patient,
      status: item.status,
      checked_in_at: item.checked_in_at,
    };
  });
}

function roomCallIsPending(store) {
  return Boolean(
    store.room_call
      && store.room_call.date === localDateValue()
      && !store.room_call.selected_visit_id
      && !store.room_call.consumed_at,
  );
}

function roomCallAvailableAt(roomCall) {
  return addMilliseconds(roomCall.requested_at, UNDO_WINDOW_MS);
}

function currentDoctorVisit(store) {
  return store.visits
    .filter(
      (visit) => !visit.deleted_at
        && visit.date === localDateValue()
        && visit.status === "with_doctor",
    )
    .sort(
      (first, second) => String(first.with_doctor_at).localeCompare(String(second.with_doctor_at))
        || first.created_at.localeCompare(second.created_at),
    )[0] ?? null;
}

function publicRoomCall(store, roomCall) {
  const firstWaiting = orderedQueue(store)[0] ?? null;
  const availableAt = roomCallAvailableAt(roomCall);
  return {
    requested_at: roomCall.requested_at,
    available_at: availableAt,
    undo_until: availableAt,
    available: Date.now() >= new Date(availableAt).getTime(),
    suggested_visit_id: firstWaiting?.id ?? null,
  };
}

function roomState(store, workspaceRole) {
  const currentVisit = currentDoctorVisit(store);
  const pending = roomCallIsPending(store) ? store.room_call : null;
  const now = Date.now();
  let visibleCall = pending;
  if (
    workspaceRole === "assistant"
      && pending
      && now < new Date(roomCallAvailableAt(pending)).getTime()
  ) {
    visibleCall = null;
  }

  let canRoomReady = workspaceRole === "doctor" && !pending;
  if (
    canRoomReady
      && currentVisit?.with_doctor_at
      && now <= new Date(addMilliseconds(currentVisit.with_doctor_at, UNDO_WINDOW_MS)).getTime()
  ) {
    canRoomReady = false;
  }

  return {
    date: localDateValue(),
    current_visit: workspaceRole === "doctor" && currentVisit
      ? publicVisit(store, currentVisit)
      : null,
    room_call: visibleCall ? publicRoomCall(store, visibleCall) : null,
    can_room_ready: canRoomReady,
  };
}

function signalRoomReady(store, session) {
  requireDoctorWorkspace(session);
  if (roomCallIsPending(store)) {
    fail(
      {
        code: "room_call_pending",
        detail: "The room is already waiting for the Assistant to send a Patient.",
      },
      409,
    );
  }

  const now = new Date().toISOString();
  const currentVisit = currentDoctorVisit(store);
  if (
    currentVisit?.with_doctor_at
      && Date.now() <= new Date(addMilliseconds(currentVisit.with_doctor_at, UNDO_WINDOW_MS)).getTime()
  ) {
    fail(
      {
        code: "with_doctor_undo_active",
        detail: "Wait until the previous five-second Undo period ends.",
      },
      409,
    );
  }

  if (currentVisit) {
    currentVisit.status = "doctor_finished";
    currentVisit.doctor_finished_at = now;
    currentVisit.updated_at = now;
  }

  store.room_call = {
    date: localDateValue(),
    requested_at: now,
    previous_visit_id: currentVisit?.id ?? null,
    selected_visit_id: null,
    consumed_at: null,
  };
  saveStore(store);
  return {
    code: "room_ready",
    detail: "The Assistant will receive the room-ready call after the Undo period.",
    undo_until: roomCallAvailableAt(store.room_call),
    room_call: publicRoomCall(store, store.room_call),
  };
}

function undoRoomReady(store, session) {
  requireDoctorWorkspace(session);
  const roomCall = store.room_call;
  if (!roomCallIsPending(store)) {
    fail(
      { code: "room_call_not_pending", detail: "There is no pending room-ready call to undo." },
      400,
    );
  }
  if (Date.now() > new Date(roomCallAvailableAt(roomCall)).getTime()) {
    fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
  }

  let restoredVisit = null;
  if (roomCall.previous_visit_id) {
    restoredVisit = visitById(store, roomCall.previous_visit_id);
    if (restoredVisit.status !== "doctor_finished") {
      fail(
        {
          code: "room_call_changed",
          detail: "The previous consultation can no longer be restored.",
        },
        409,
      );
    }
    restoredVisit.status = "with_doctor";
    restoredVisit.doctor_finished_at = null;
    restoredVisit.updated_at = new Date().toISOString();
  }

  store.room_call = null;
  saveStore(store);
  return {
    code: "room_ready_undone",
    detail: "Room ready was undone.",
    current_visit: restoredVisit ? publicVisit(store, restoredVisit) : null,
  };
}

function sendWithDoctor(store, session, visitId) {
  requireAssistantWorkspace(session);
  const roomCall = store.room_call;
  if (!roomCallIsPending(store)) {
    fail(
      { code: "room_not_ready", detail: "The Doctor has not called for the next Patient." },
      409,
    );
  }
  if (Date.now() < new Date(roomCallAvailableAt(roomCall)).getTime()) {
    fail(
      {
        code: "room_call_not_available",
        detail: "The room-ready call is still inside its Undo period.",
      },
      409,
    );
  }

  const visit = visitById(store, visitId);
  if (visit.date !== localDateValue() || visit.status !== "checked_in") {
    fail(
      {
        code: "patient_not_waiting",
        detail: "Only a checked-in Patient in today's queue can go With doctor.",
      },
      409,
    );
  }
  if (currentDoctorVisit(store)) {
    fail(
      { code: "doctor_busy", detail: "Another Patient is already With doctor." },
      409,
    );
  }

  const now = new Date().toISOString();
  visit.status = "with_doctor";
  visit.with_doctor_at = now;
  visit.doctor_finished_at = null;
  visit.updated_at = now;
  roomCall.selected_visit_id = visit.id;
  roomCall.consumed_at = now;
  saveStore(store);
  return publicVisit(store, visit);
}

function undoWithDoctor(store, session, visitId) {
  requireAssistantWorkspace(session);
  const roomCall = store.room_call;
  const visit = visitById(store, visitId);

  if (
    !roomCall
      || roomCall.date !== localDateValue()
      || roomCall.selected_visit_id !== visit.id
      || !roomCall.consumed_at
  ) {
    fail(
      {
        code: "with_doctor_action_changed",
        detail: "This With doctor action can no longer be undone.",
      },
      409,
    );
  }
  if (visit.status !== "with_doctor" || !visit.with_doctor_at) {
    fail(
      { code: "not_with_doctor", detail: "This Patient is not currently With doctor." },
      400,
    );
  }
  if (Date.now() > new Date(addMilliseconds(visit.with_doctor_at, UNDO_WINDOW_MS)).getTime()) {
    fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
  }

  visit.status = "checked_in";
  visit.with_doctor_at = null;
  visit.doctor_finished_at = null;
  visit.updated_at = new Date().toISOString();
  roomCall.selected_visit_id = null;
  roomCall.consumed_at = null;
  saveStore(store);
  return publicVisit(store, visit);
}

function createClinic(data) {
  const name = clean(data.name);
  const email = normalizeEmail(data.email);
  const phone = clean(data.phone);
  if (!name || !email || !phone) fail({ detail: "Complete all clinic fields." });

  const store = loadStore();
  if (store.clinic) {
    fail(
      { detail: "This browser demo already contains a clinic. Clear site data to start again." },
      409,
    );
  }
  const clinic = {
    id: crypto.randomUUID(),
    name,
    email,
    phone,
  };
  store.clinic = clinic;
  saveStore(store);
  return {
    clinic: publicClinic(clinic),
    roles: rolePayload(store),
  };
}

async function registerStaff(data) {
  const store = loadStore();
  const clinic = store.clinic;
  if (!clinic) fail({ detail: "Open the browser demo first." }, 409);
  const role = data.role;
  const username = clean(data.username);
  const email = normalizeEmail(data.email);
  const firstName = clean(data.first_name);
  const lastName = clean(data.last_name);
  const password = data.password ?? "";

  if (!["doctor", "assistant"].includes(role)) {
    fail({ role: ["Choose Doctor or Assistant."] });
  }
  if (store.staff.some((user) => user.role === role)) {
    fail({ role: ["This clinic already has an account for this role."] }, 409);
  }
  if (store.staff.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
    fail({ username: ["This username is already in use."] });
  }
  if (store.staff.some((user) => user.email === email)) {
    fail({ email: ["This email is already in use."] });
  }
  if (!username || !email || !firstName || !lastName) {
    fail({ detail: "Complete all staff fields." });
  }
  if (password !== data.password_confirm) {
    fail({ password_confirm: ["Staff passwords do not match."] });
  }
  if (password.length < 8) {
    fail({ password: ["Use at least 8 characters for the staff password."] });
  }

  const user = {
    id: crypto.randomUUID(),
    username,
    email,
    first_name: firstName,
    last_name: lastName,
    role,
    password_hash: await hashSecret(password),
    private_note: "",
  };
  store.staff.push(user);
  const sessionToken = randomToken("demo-staff");
  store.sessions[sessionToken] = { user_id: user.id, workspace_role: role };
  saveStore(store);
  return {
    user: publicUser(user, clinic, role),
    session_token: sessionToken,
    expires_at: null,
  };
}

async function loginStaff(data) {
  const store = loadStore();
  const clinic = store.clinic;
  if (!clinic) fail({ detail: "Open the browser demo first." }, 409);
  const username = clean(data.username).toLowerCase();
  const passwordHash = await hashSecret(data.password ?? "");
  const workspaceRole = data.role;
  const user = store.staff.find((candidate) => candidate.username.toLowerCase() === username);
  const allowed = user
    && (user.role === workspaceRole || (user.role === "doctor" && workspaceRole === "assistant"));
  if (!allowed || user.password_hash !== passwordHash) {
    fail({ non_field_errors: ["Username or password is incorrect."] });
  }

  const sessionToken = randomToken("demo-staff");
  store.sessions[sessionToken] = { user_id: user.id, workspace_role: workspaceRole };
  saveStore(store);
  return {
    user: publicUser(user, clinic, workspaceRole),
    session_token: sessionToken,
    expires_at: null,
  };
}

export {
  UNDO_WINDOW_MS,
  addMilliseconds,
  canDeleteVisit,
  createClinic,
  createPatient,
  createVisit,
  fail,
  listPatients,
  listVisits,
  loadStore,
  localDateValue,
  loginStaff,
  patientById,
  publicClinic,
  publicPatient,
  publicUser,
  publicVisit,
  queueVisits,
  registerStaff,
  requireAssistantWorkspace,
  requireDoctorWorkspace,
  resolveSession,
  rolePayload,
  roomState,
  saveStore,
  sendWithDoctor,
  signalRoomReady,
  undoRoomReady,
  undoWithDoctor,
  updatePatient,
  updateVisit,
  visitById,
};