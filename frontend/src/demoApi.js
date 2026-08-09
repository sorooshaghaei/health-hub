import {
  UNDO_WINDOW_MS,
  addMilliseconds,
  canDeleteVisit,
  createClinic,
  createPatient,
  createVisit,
  enterClinic,
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
  resolveClinic,
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
} from "./demoApiCore.js";

function sameDayAppointmentConflict(store, patientId, date, excludeVisitId = null) {
  const cutoff = Date.now() - UNDO_WINDOW_MS;
  const matches = store.visits.filter(
    (visit) => visit.id !== excludeVisitId
      && visit.patient_id === patientId
      && visit.date === date
      && (
        !visit.deleted_at
        || new Date(visit.deleted_at).getTime() >= cutoff
      ),
  );
  return matches.find((visit) => !visit.deleted_at)
    ?? matches.sort((first, second) => String(second.deleted_at).localeCompare(String(first.deleted_at)))[0]
    ?? null;
}

function rejectSameDayAppointment(store, conflict) {
  fail(
    {
      code: "same_day_appointment_exists",
      detail: "This Patient already has an appointment on this date.",
      appointment: publicVisit(store, conflict),
      recently_deleted: Boolean(conflict.deleted_at),
      undo_until: conflict.deleted_at
        ? addMilliseconds(conflict.deleted_at, UNDO_WINDOW_MS)
        : null,
    },
    409,
  );
}

export async function demoApiRequest(
  path,
  { method = "GET", data = {}, clinicToken, staffToken } = {},
) {
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
  if (pathname === "/api/staff/register/" && method === "POST") {
    return registerStaff(data, clinicToken);
  }
  if (pathname === "/api/staff/login/" && method === "POST") {
    return loginStaff(data, clinicToken);
  }
  if (pathname === "/api/staff/me/" && method === "GET") {
    const store = loadStore();
    const session = resolveSession(store, staffToken);
    return { user: publicUser(session.user, store.clinic, session.workspaceRole) };
  }
  if (pathname === "/api/staff/logout/" && method === "POST") {
    const store = loadStore();
    if (staffToken) delete store.sessions[staffToken];
    saveStore(store);
    return null;
  }

  const store = loadStore();
  const session = resolveSession(store, staffToken);

  if (pathname === "/api/patients/" && method === "GET") {
    return { patients: listPatients(store, url.searchParams.get("search")) };
  }
  if (pathname === "/api/patients/" && method === "POST") {
    requireAssistantWorkspace(session);
    return createPatient(store, data);
  }

  const patientUndoMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/undo-delete\/$/i);
  if (patientUndoMatch && method === "POST") {
    requireAssistantWorkspace(session);
    const patient = patientById(store, patientUndoMatch[1], { includeDeleted: true });
    if (!patient.deleted_at) fail({ detail: "Deleted Patient not found." }, 404);
    if (Date.now() > new Date(patient.deleted_at).getTime() + UNDO_WINDOW_MS) {
      fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
    }
    patient.deleted_at = null;
    saveStore(store);
    return publicPatient(patient);
  }

  const patientMatch = pathname.match(/^\/api\/patients\/([0-9a-f-]+)\/$/i);
  if (patientMatch) {
    const patientId = patientMatch[1];
    if (method === "GET") return publicPatient(patientById(store, patientId));
    if (method === "PATCH") {
      requireAssistantWorkspace(session);
      return updatePatient(store, patientId, data);
    }
    if (method === "DELETE") {
      requireAssistantWorkspace(session);
      const patient = patientById(store, patientId);
      const cutoff = Date.now() - UNDO_WINDOW_MS;
      const blockingVisits = store.visits.filter(
        (visit) => visit.patient_id === patient.id
          && visit.date >= localDateValue()
          && (!visit.deleted_at || new Date(visit.deleted_at).getTime() >= cutoff),
      );
      if (blockingVisits.length) {
        fail(
          {
            code: "future_visits_exist",
            detail: "Delete current and future appointments before deleting this Patient.",
            future_visit_count: blockingVisits.length,
          },
          409,
        );
      }
      patient.deleted_at = new Date().toISOString();
      saveStore(store);
      return {
        code: "patient_deleted",
        detail: "Patient deleted.",
        patient_id: patient.id,
        undo_until: addMilliseconds(patient.deleted_at, UNDO_WINDOW_MS),
      };
    }
  }

  if (pathname === "/api/visits/room-state/" && method === "GET") {
    return roomState(store, session.workspaceRole);
  }
  if (pathname === "/api/visits/room-ready/" && method === "POST") {
    return signalRoomReady(store, session);
  }
  if (pathname === "/api/visits/room-ready/undo/" && method === "POST") {
    return undoRoomReady(store, session);
  }
  if (pathname === "/api/visits/queue/" && method === "GET") {
    return { date: localDateValue(), queue: queueVisits(store, session.workspaceRole) };
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
  if (pathname === "/api/visits/" && method === "POST") {
    requireAssistantWorkspace(session);
    if (data.patient_id && data.date) {
      const conflict = sameDayAppointmentConflict(store, data.patient_id, data.date);
      if (conflict) rejectSameDayAppointment(store, conflict);
    }
    return createVisit(store, data);
  }

  const checkInMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/check-in\/$/i);
  if (checkInMatch && method === "POST") {
    requireAssistantWorkspace(session);
    const visit = visitById(store, checkInMatch[1]);
    if (visit.date !== localDateValue()) {
      fail({ code: "check_in_today_only", detail: "Only today's appointments can be checked in." });
    }
    if (visit.status !== "planned") {
      fail(
        {
          code: "already_checked_in",
          detail: "This Patient has already entered today's clinic workflow.",
        },
        409,
      );
    }
    const maximum = store.visits
      .filter((candidate) => candidate.date === visit.date)
      .reduce((value, candidate) => Math.max(value, Number(candidate.queue_sequence) || 0), 0);
    visit.status = "checked_in";
    visit.checked_in_at = new Date().toISOString();
    visit.queue_sequence = maximum + 1;
    visit.with_doctor_at = null;
    visit.doctor_finished_at = null;
    visit.updated_at = visit.checked_in_at;
    saveStore(store);
    return publicVisit(store, visit);
  }

  const undoCheckInMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/undo-check-in\/$/i);
  if (undoCheckInMatch && method === "POST") {
    requireAssistantWorkspace(session);
    const visit = visitById(store, undoCheckInMatch[1], { includeDeleted: true });
    if (visit.status !== "checked_in") {
      fail({ code: "not_checked_in", detail: "This appointment is not checked in." });
    }
    if (Date.now() > new Date(visit.checked_in_at).getTime() + UNDO_WINDOW_MS) {
      fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
    }
    visit.status = "planned";
    visit.checked_in_at = null;
    visit.queue_sequence = null;
    visit.with_doctor_at = null;
    visit.doctor_finished_at = null;
    visit.updated_at = new Date().toISOString();
    saveStore(store);
    return publicVisit(store, visit);
  }

  const withDoctorMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/with-doctor\/$/i);
  if (withDoctorMatch && method === "POST") {
    return sendWithDoctor(store, session, withDoctorMatch[1]);
  }

  const undoWithDoctorMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/undo-with-doctor\/$/i);
  if (undoWithDoctorMatch && method === "POST") {
    return undoWithDoctor(store, session, undoWithDoctorMatch[1]);
  }

  const undoDeleteMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/undo-delete\/$/i);
  if (undoDeleteMatch && method === "POST") {
    requireAssistantWorkspace(session);
    const visit = visitById(store, undoDeleteMatch[1], {
      includeDeleted: true,
      deletedOnly: true,
    });
    if (Date.now() > new Date(visit.deleted_at).getTime() + UNDO_WINDOW_MS) {
      fail({ code: "undo_expired", detail: "The five-second Undo period has expired." });
    }
    visit.deleted_at = null;
    visit.updated_at = new Date().toISOString();
    saveStore(store);
    return publicVisit(store, visit);
  }

  const visitMatch = pathname.match(/^\/api\/visits\/([0-9a-f-]+)\/$/i);
  if (visitMatch) {
    const visitId = visitMatch[1];
    if (method === "GET") return publicVisit(store, visitById(store, visitId));
    if (method === "PATCH") {
      requireAssistantWorkspace(session);
      const current = visitById(store, visitId);
      const patientId = data.patient_id ?? current.patient_id;
      const date = data.date ?? current.date;
      const conflict = sameDayAppointmentConflict(store, patientId, date, visitId);
      if (conflict) rejectSameDayAppointment(store, conflict);
      return updateVisit(store, visitId, data);
    }
    if (method === "DELETE") {
      requireAssistantWorkspace(session);
      const visit = visitById(store, visitId);
      if (["with_doctor", "doctor_finished"].includes(visit.status)) {
        fail(
          {
            code: "consultation_started",
            detail: "An appointment cannot be deleted after consultation starts.",
          },
          409,
        );
      }
      if (!canDeleteVisit(visit)) {
        fail({ code: "appointment_in_past", detail: "Past appointments cannot be deleted." });
      }
      visit.deleted_at = new Date().toISOString();
      visit.updated_at = visit.deleted_at;
      saveStore(store);
      return {
        code: "appointment_deleted",
        detail: "Appointment deleted.",
        visit_id: visit.id,
        undo_until: addMilliseconds(visit.deleted_at, UNDO_WINDOW_MS),
      };
    }
  }

  fail({ detail: "This API route is not available in the browser demo." }, 404);
}
