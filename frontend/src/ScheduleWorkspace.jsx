import { useEffect, useMemo, useRef, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import { formatDate, formatTime } from "./patientForm.jsx";
import VisitForm from "./VisitForm.jsx";
import { ErrorMessage, Field } from "./ui.jsx";

const STATUS_LABELS = {
  planned: "Planned",
  checked_in: "Checked in",
  with_doctor: "With doctor",
  doctor_finished: "Completed",
};

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

function formatCheckInTime(value) {
  if (!value) return "Not checked in";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function playRoomReadySound() {
  try {
    const AudioContext = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.32);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
    oscillator.addEventListener("ended", () => context.close(), { once: true });
  } catch {
    // The persistent visual notice remains when browser audio is unavailable.
  }
}

function PatientContext({ patient, showPhone = false }) {
  return (
    <span className="patient-context">
      <strong>{patient.full_name}</strong>
      <small>
        {patient.gender}
        {showPhone && patient.phone_e164 ? ` · ${patient.phone_e164}` : ""}
        {patient.date_of_birth ? ` · ${formatDate(patient.date_of_birth)}` : ""}
      </small>
    </span>
  );
}

function AppointmentRow({ visit, readOnly, onCheckIn, onEdit, onDelete }) {
  return (
    <div className="visit-row appointment-row">
      <div className="visit-time">
        <strong>{formatTime(visit.scheduled_time)}</strong>
        <small>{statusLabel(visit.status)}</small>
      </div>
      <PatientContext patient={visit.patient} showPhone={!readOnly} />
      <div className="visit-reason">
        <small>Reason</small>
        <span>{visit.reason || "No reason recorded"}</span>
      </div>
      {readOnly ? (
        <span className={`status-chip status-chip--${visit.status}`}>
          {statusLabel(visit.status)}
        </span>
      ) : (
        <div className="visit-row__actions">
          {visit.can_check_in && (
            <button className="check-in-button" type="button" onClick={() => onCheckIn(visit)}>Check in</button>
          )}
          <span className={`status-chip status-chip--${visit.status}`}>
            {statusLabel(visit.status)}
          </span>
          <button className="secondary-button" type="button" onClick={() => onEdit(visit)}>Edit</button>
          {visit.can_delete && <button className="danger-button" type="button" onClick={() => onDelete(visit)}>Delete</button>}
        </div>
      )}
    </div>
  );
}

function QueueRow({ item, roomReady, suggested, sending, onWithDoctor }) {
  return (
    <div className={suggested ? "queue-row queue-row--suggested" : "queue-row"}>
      <div className="queue-position" aria-label={`Queue position ${item.queue_position}`}>{item.queue_position}</div>
      <PatientContext patient={item.patient} showPhone={Boolean(item.patient.phone_e164)} />
      <div className="queue-fact">
        <small>Scheduled</small>
        <strong>{formatTime(item.scheduled_time)}</strong>
      </div>
      <div className="queue-fact">
        <small>Checked in</small>
        <strong>{formatCheckInTime(item.checked_in_at)}</strong>
      </div>
      <div className="queue-reason">
        <small>Reason</small>
        <span>{item.reason || "No reason recorded"}</span>
      </div>
      {roomReady && (
        <button
          className={suggested ? "with-doctor-button with-doctor-button--suggested" : "with-doctor-button"}
          type="button"
          disabled={sending}
          onClick={() => onWithDoctor(item)}
        >
          {sending ? "Sending…" : "With doctor"}
        </button>
      )}
    </div>
  );
}

function DoctorConsultationCard({ visit, onOpenPatient }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setExpanded(false);
    }
    globalThis.addEventListener("keydown", closeOnEscape);
    return () => globalThis.removeEventListener("keydown", closeOnEscape);
  }, [expanded]);

  if (!visit) {
    return (
      <div className="consultation-empty">
        <span className="consultation-empty__dot" />
        <span>No Patient is currently with the Doctor.</span>
      </div>
    );
  }

  return (
    <>
      <button className="consultation-card" type="button" onClick={() => setExpanded(true)}>
        <span>
          <small>With doctor</small>
          <strong>{visit.patient.full_name}</strong>
        </span>
        <span>
          <small>Checked in</small>
          <strong>{formatCheckInTime(visit.checked_in_at)}</strong>
        </span>
        <span aria-hidden="true">Open →</span>
      </button>
      {expanded && (
        <div className="consultation-modal" role="presentation" onMouseDown={() => setExpanded(false)}>
          <article
            className="consultation-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-label={`${visit.patient.full_name} consultation details`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="consultation-modal__heading">
              <div>
                <p className="eyebrow">With doctor</p>
                <h3>{visit.patient.full_name}</h3>
              </div>
              <button className="modal-close-button" type="button" onClick={() => setExpanded(false)} aria-label="Close consultation details">×</button>
            </div>
            <dl className="consultation-facts">
              <div><dt>Scheduled time</dt><dd>{formatTime(visit.scheduled_time)}</dd></div>
              <div><dt>Check-in time</dt><dd>{formatCheckInTime(visit.checked_in_at)}</dd></div>
              <div className="consultation-facts__wide"><dt>Reason</dt><dd>{visit.reason || "No reason recorded"}</dd></div>
            </dl>
            <section className="patient-note-card">
              <p className="eyebrow">Patient note</p>
              <p>{visit.patient.patient_note || "No patient note has been added."}</p>
            </section>
            <div className="form-actions">
              <button className="secondary-button" type="button" onClick={() => { setExpanded(false); onOpenPatient?.(visit.patient.id); }}>Open patient profile</button>
            </div>
          </article>
        </div>
      )}
    </>
  );
}

function RoomReadyNotification({ roomCall, queue, dismissed, onDismiss }) {
  const suggested = queue.find((item) => item.id === roomCall.suggested_visit_id) ?? null;
  return (
    <>
      {!dismissed && (
        <div className="room-ready-notification" role="status" aria-live="assertive">
          <span className="room-ready-notification__signal" aria-hidden="true" />
          <div>
            <strong>Doctor&apos;s room is ready</strong>
            <span>{suggested ? `${suggested.patient.full_name} is suggested next.` : "Send a checked-in Patient when available."}</span>
          </div>
          <button type="button" onClick={onDismiss}>Dismiss</button>
        </div>
      )}
      <div className="room-ready-indicator">
        <span /> Room ready
        {suggested && <strong>Suggested: {suggested.patient.full_name}</strong>}
      </div>
    </>
  );
}

export default function ScheduleWorkspace({
  staffToken,
  requestedVisitId,
  onRequestedVisitHandled,
  onVisitChanged,
  onRegisterUndo,
  onOpenPatient,
  refreshVersion = 0,
  readOnly = false,
}) {
  const today = useMemo(() => localDateValue(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visits, setVisits] = useState([]);
  const [queue, setQueue] = useState([]);
  const [roomState, setRoomState] = useState({
    current_visit: null,
    room_call: null,
    can_room_ready: false,
  });
  const [dismissedRoomCall, setDismissedRoomCall] = useState(null);
  const notifiedRoomCall = useRef(null);
  const [mode, setMode] = useState("list");
  const [editingVisit, setEditingVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomReadySubmitting, setRoomReadySubmitting] = useState(false);
  const [sendingVisitId, setSendingVisitId] = useState(null);

  async function loadVisits(date = selectedDate, { quiet = false } = {}) {
    if (!quiet) setLoading(true);
    if (!quiet) setError(null);
    try {
      const payload = await apiRequest(`/api/visits/?date=${encodeURIComponent(date)}`, { staffToken });
      setVisits(payload.visits);
    } catch (requestError) {
      if (!quiet) setError(requestError instanceof ApiError ? requestError : new ApiError("Appointments could not be loaded."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }

  async function loadQueue({ quiet = false } = {}) {
    if (!quiet) setQueueLoading(true);
    try {
      const payload = await apiRequest("/api/visits/queue/", { staffToken });
      setQueue(payload.queue);
    } catch (requestError) {
      if (!quiet) setError(requestError instanceof ApiError ? requestError : new ApiError("Live queue could not be loaded."));
    } finally {
      if (!quiet) setQueueLoading(false);
    }
  }

  async function loadRoomState({ quiet = false } = {}) {
    try {
      const payload = await apiRequest("/api/visits/room-state/", { staffToken });
      setRoomState(payload);
    } catch (requestError) {
      if (!quiet) setError(requestError instanceof ApiError ? requestError : new ApiError("Room status could not be loaded."));
    }
  }

  async function refreshAll({ quiet = false } = {}) {
    const requests = [loadQueue({ quiet }), loadRoomState({ quiet })];
    if (selectedDate === today) requests.push(loadVisits(selectedDate, { quiet }));
    await Promise.all(requests);
  }

  useEffect(() => {
    loadVisits(selectedDate);
  }, [selectedDate, staffToken, refreshVersion]);

  useEffect(() => {
    loadQueue();
    loadRoomState();
    const timer = globalThis.setInterval(() => refreshAll({ quiet: true }), 3_000);
    return () => globalThis.clearInterval(timer);
  }, [staffToken, refreshVersion, selectedDate]);

  useEffect(() => {
    if (readOnly || !roomState.room_call?.available) return;
    const callKey = roomState.room_call.requested_at;
    if (notifiedRoomCall.current === callKey) return;
    notifiedRoomCall.current = callKey;
    setDismissedRoomCall(null);
    playRoomReadySound();
  }, [readOnly, roomState.room_call]);

  useEffect(() => {
    if (!requestedVisitId || readOnly) return;
    let cancelled = false;
    apiRequest(`/api/visits/${requestedVisitId}/`, { staffToken })
      .then((visit) => {
        if (cancelled) return;
        setEditingVisit(visit);
        setSelectedDate(visit.date);
        setMode("edit");
        onRequestedVisitHandled?.();
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment could not be opened."));
      });
    return () => { cancelled = true; };
  }, [requestedVisitId, readOnly, staffToken, onRequestedVisitHandled]);

  async function saved(visit) {
    setSelectedDate(visit.date);
    setEditingVisit(null);
    setMode("list");
    await Promise.all([loadVisits(visit.date), loadQueue(), loadRoomState()]);
    onVisitChanged?.();
  }

  function openExistingAppointment(visit) {
    setSelectedDate(visit.date);
    setEditingVisit(visit);
    setMode("edit");
  }

  async function checkIn(visit) {
    setError(null);
    try {
      const checkedIn = await apiRequest(`/api/visits/${visit.id}/check-in/`, {
        method: "POST",
        staffToken,
      });
      onRegisterUndo?.({
        id: `check-in:${visit.id}:${Date.now()}`,
        kind: "check_in",
        resourceId: visit.id,
        message: `${visit.patient.full_name} checked in.`,
        undoUntil: checkedIn.check_in_undo_until,
      });
      await refreshAll();
      onVisitChanged?.();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be checked in."));
    }
  }

  async function signalRoomReady() {
    setRoomReadySubmitting(true);
    setError(null);
    try {
      const payload = await apiRequest("/api/visits/room-ready/", {
        method: "POST",
        staffToken,
      });
      onRegisterUndo?.({
        id: `room-ready:${payload.room_call.requested_at}`,
        kind: "room_ready",
        resourceId: null,
        message: payload.previous_visit
          ? `${payload.previous_visit.patient.full_name} finished. Room ready called.`
          : "Room ready called.",
        undoUntil: payload.room_call.undo_until,
      });
      await refreshAll();
      onVisitChanged?.();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Room ready could not be sent."));
    } finally {
      setRoomReadySubmitting(false);
    }
  }

  async function sendWithDoctor(visit) {
    setSendingVisitId(visit.id);
    setError(null);
    try {
      const sent = await apiRequest(`/api/visits/${visit.id}/with-doctor/`, {
        method: "POST",
        staffToken,
      });
      onRegisterUndo?.({
        id: `with-doctor:${visit.id}:${Date.now()}`,
        kind: "with_doctor",
        resourceId: visit.id,
        message: `${visit.patient.full_name} is with the Doctor.`,
        undoUntil: sent.with_doctor_undo_until,
      });
      await refreshAll();
      onVisitChanged?.();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be sent to the Doctor."));
    } finally {
      setSendingVisitId(null);
    }
  }

  async function deleteVisit(visit) {
    setError(null);
    try {
      const deleted = await apiRequest(`/api/visits/${visit.id}/`, {
        method: "DELETE",
        staffToken,
      });
      onRegisterUndo?.({
        id: `appointment-delete:${visit.id}:${Date.now()}`,
        kind: "appointment_delete",
        resourceId: visit.id,
        message: `${visit.patient.full_name}'s appointment deleted.`,
        undoUntil: deleted.undo_until,
      });
      await refreshAll();
      onVisitChanged?.();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment could not be deleted."));
    }
  }

  const availableRoomCall = !readOnly && roomState.room_call?.available
    ? roomState.room_call
    : null;
  const dismissed = availableRoomCall
    ? dismissedRoomCall === availableRoomCall.requested_at
    : false;

  return (
    <section className="schedule-workspace">
      {readOnly && (
        <article className="workspace-card consultation-workspace-card">
          <div className="card-heading">
            <div>
              <p className="eyebrow">Consultation room</p>
              <h2>Current Patient</h2>
            </div>
            <button
              className="room-ready-button"
              type="button"
              disabled={!roomState.can_room_ready || roomReadySubmitting}
              onClick={signalRoomReady}
            >
              {roomReadySubmitting
                ? "Sending…"
                : roomState.room_call
                  ? "Room call pending"
                  : "Room ready"}
            </button>
          </div>
          <DoctorConsultationCard visit={roomState.current_visit} onOpenPatient={onOpenPatient} />
          {roomState.room_call && (
            <p className="room-ready-pending-copy">
              {roomState.room_call.available
                ? "The Assistant has received the room-ready call."
                : "The Assistant will receive this call after the five-second Undo period."}
            </p>
          )}
        </article>
      )}

      {!readOnly && availableRoomCall && (
        <RoomReadyNotification
          roomCall={availableRoomCall}
          queue={queue}
          dismissed={dismissed}
          onDismiss={() => setDismissedRoomCall(availableRoomCall.requested_at)}
        />
      )}

      <article className="workspace-card live-queue-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Today · {formatDate(today)}</p>
            <h2>Live queue</h2>
          </div>
          <span className="count-badge">{queue.length}</span>
        </div>
        <div className="phase3-content">
          {queueLoading ? (
            <div className="patient-loading patient-loading--small"><div className="loader" aria-label="Loading live queue" /></div>
          ) : queue.length ? (
            <div className="queue-list">
              {queue.map((item) => (
                <QueueRow
                  item={item}
                  key={item.id}
                  roomReady={Boolean(availableRoomCall)}
                  suggested={availableRoomCall?.suggested_visit_id === item.id}
                  sending={sendingVisitId === item.id}
                  onWithDoctor={sendWithDoctor}
                />
              ))}
            </div>
          ) : (
            <p className="schedule-empty">
              {availableRoomCall ? "The room is ready. Waiting for a Patient to check in." : "No Patients are checked in."}
            </p>
          )}
        </div>
      </article>

      <article className="workspace-card phase2-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">{readOnly ? "Appointment overview" : "Daily planning"}</p>
            <h2>Appointments</h2>
          </div>
          <span className="count-badge">{visits.length}</span>
        </div>

        <div className="phase2-content">
          <ErrorMessage error={error} />
          {readOnly && (
            <p className="security-note">
              The Doctor workspace shows appointments and the live queue without administrative controls.
            </p>
          )}

          {mode === "list" && (
            <>
              <div className="schedule-toolbar">
                <div className="schedule-date-control">
                  <Field
                    label="Appointment date"
                    type="date"
                    value={selectedDate}
                    onChange={(event) => setSelectedDate(event.target.value)}
                  />
                  {selectedDate !== today && <button className="text-button" type="button" onClick={() => setSelectedDate(today)}>Today</button>}
                </div>
                {!readOnly && (
                  <div className="schedule-actions">
                    <button className="primary-button primary-button--compact" type="button" onClick={() => setMode("create")}>+ New appointment</button>
                  </div>
                )}
              </div>

              {loading ? (
                <div className="patient-loading"><div className="loader" aria-label="Loading appointments" /></div>
              ) : visits.length ? (
                <section className="schedule-section">
                  <div className="schedule-section__heading">
                    <h3>{formatDate(selectedDate)}</h3>
                    <span>{visits.length}</span>
                  </div>
                  {visits.map((visit) => (
                    <AppointmentRow
                      visit={visit}
                      readOnly={readOnly}
                      key={visit.id}
                      onCheckIn={checkIn}
                      onEdit={(item) => { setEditingVisit(item); setMode("edit"); }}
                      onDelete={deleteVisit}
                    />
                  ))}
                </section>
              ) : (
                <p className="schedule-empty">No appointments for this date.</p>
              )}
            </>
          )}

          {mode === "create" && (
            <VisitForm
              key="create"
              defaultDate={selectedDate}
              defaultTime={selectedDate === today ? localTimeValue() : ""}
              staffToken={staffToken}
              onSaved={saved}
              onCancel={() => setMode("list")}
              onOpenExisting={openExistingAppointment}
              onOpenPatient={onOpenPatient}
            />
          )}
          {mode === "edit" && editingVisit && (
            <VisitForm
              key={editingVisit.id}
              visit={editingVisit}
              defaultDate={editingVisit.date}
              defaultTime={editingVisit.scheduled_time?.slice(0, 5) ?? ""}
              staffToken={staffToken}
              onSaved={saved}
              onCancel={() => { setEditingVisit(null); setMode("list"); }}
              onOpenExisting={openExistingAppointment}
              onOpenPatient={onOpenPatient}
            />
          )}
        </div>
      </article>
    </section>
  );
}
