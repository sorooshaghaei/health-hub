import { useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import {
  DuplicateWarning,
  PatientFields,
  emptyPatient,
  formatDate,
  formatTime,
} from "./patientForm.jsx";
import { ErrorMessage, Field, TextAreaField } from "./ui.jsx";

function localDateValue(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function localTimeValue(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatCheckInTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function PatientContext({ patient, showPhone = true }) {
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

function VisitForm({ visit, defaultDate, defaultTime, staffToken, onSaved, onCancel }) {
  const checkedIn = visit?.status === "checked_in";
  const [schedule, setSchedule] = useState({
    date: visit?.date ?? defaultDate,
    scheduled_time: visit?.scheduled_time?.slice(0, 5) ?? defaultTime,
    reason: visit?.reason ?? "",
  });
  const [patientMode, setPatientMode] = useState("existing");
  const [selectedPatient, setSelectedPatient] = useState(visit?.patient ?? null);
  const [patientChanged, setPatientChanged] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [newPatient, setNewPatient] = useState(emptyPatient());
  const [warning, setWarning] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (checkedIn || patientMode !== "existing" || !query.trim()) {
      setMatches([]);
      return undefined;
    }
    let cancelled = false;
    const timer = globalThis.setTimeout(async () => {
      setSearching(true);
      try {
        const payload = await apiRequest(`/api/patients/?search=${encodeURIComponent(query.trim())}`, { staffToken });
        if (!cancelled) setMatches(payload.patients.slice(0, 8));
      } catch (requestError) {
        if (!cancelled) setError(requestError instanceof ApiError ? requestError : new ApiError("Patient search failed."));
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [checkedIn, patientMode, query, staffToken]);

  function selectPatient(patient) {
    setSelectedPatient(patient);
    setPatientChanged(!visit || patient.id !== visit.patient.id);
    setQuery("");
    setMatches([]);
    setWarning(null);
  }

  function startNewPatient() {
    setPatientMode("new");
    setSelectedPatient(null);
    setPatientChanged(true);
    setWarning(null);
  }

  function updateNewPatient(name, value) {
    setWarning(null);
    setNewPatient((current) => ({ ...current, [name]: value }));
  }

  async function save(confirmDuplicate = false) {
    if (!visit && patientMode === "existing" && !selectedPatient) {
      setError(new ApiError("Choose an existing Patient or create a new Patient."));
      return;
    }

    const data = {
      date: schedule.date,
      scheduled_time: schedule.scheduled_time,
      reason: schedule.reason,
    };

    if (!checkedIn) {
      if (patientMode === "new") {
        data.new_patient = {
          ...newPatient,
          date_of_birth: newPatient.date_of_birth || null,
          confirm_duplicate: confirmDuplicate,
        };
      } else if (selectedPatient && (!visit || patientChanged)) {
        data.patient_id = selectedPatient.id;
      }
    }

    setError(null);
    setSubmitting(true);
    try {
      const saved = await apiRequest(visit ? `/api/visits/${visit.id}/` : "/api/visits/", {
        method: visit ? "PATCH" : "POST",
        data,
        staffToken,
      });
      await onSaved(saved);
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409 && requestError.fields?.code === "possible_duplicate") {
        setWarning(requestError.fields);
      } else {
        setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment could not be saved."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="visit-form" onSubmit={(event) => { event.preventDefault(); save(false); }}>
      <div className="patient-section-heading">
        <div>
          <p className="eyebrow">{visit ? "Edit appointment" : "New appointment"}</p>
          <h3>{visit ? "Edit appointment" : "Schedule appointment"}</h3>
          <p>
            {checkedIn
              ? "The Patient and appointment date are locked after check-in. Scheduled time and reason can still be corrected."
              : "Choose a Patient, date, scheduled time, and an optional reason."}
          </p>
        </div>
      </div>

      <ErrorMessage error={error} />
      <DuplicateWarning
        warning={warning}
        onUseExisting={(match) => {
          setPatientMode("existing");
          selectPatient({ ...match, active: true });
        }}
        onCreateSeparate={() => save(true)}
      />

      <div className="visit-schedule-fields">
        <Field
          label="Date"
          name="date"
          type="date"
          value={schedule.date}
          onChange={(event) => setSchedule((current) => ({ ...current, date: event.target.value }))}
          disabled={checkedIn}
          required
        />
        <Field
          label="Scheduled time"
          name="scheduled_time"
          type="time"
          value={schedule.scheduled_time}
          onChange={(event) => setSchedule((current) => ({ ...current, scheduled_time: event.target.value }))}
          required
        />
      </div>

      <TextAreaField
        label="Visit reason"
        name="reason"
        value={schedule.reason}
        onChange={(event) => setSchedule((current) => ({ ...current, reason: event.target.value }))}
        rows="3"
        hint="Optional."
      />

      <section className="patient-picker">
        <div className="patient-picker__heading">
          <div>
            <p className="eyebrow">Patient</p>
            <h4>{checkedIn ? "Checked-in Patient" : patientMode === "new" ? "Create a new Patient" : "Use an existing Patient"}</h4>
          </div>
          {!checkedIn && (patientMode === "new" ? (
            <button className="text-button" type="button" onClick={() => { setPatientMode("existing"); setWarning(null); }}>Search existing</button>
          ) : (
            <button className="text-button" type="button" onClick={startNewPatient}>Create new Patient</button>
          ))}
        </div>

        {checkedIn ? (
          <div className="selected-patient selected-patient--locked">
            <PatientContext patient={selectedPatient} />
            <span>Locked after check-in</span>
          </div>
        ) : patientMode === "existing" ? (
          <>
            {selectedPatient && (
              <div className="selected-patient">
                <PatientContext patient={selectedPatient} />
                <button className="text-button" type="button" onClick={() => { setSelectedPatient(null); setPatientChanged(true); }}>Change</button>
              </div>
            )}
            {!selectedPatient && (
              <>
                <input
                  className="patient-picker__search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Type name, phone, or date of birth"
                  aria-label="Find existing patient"
                  autoFocus
                />
                {searching && <span className="patient-picker__status">Searching…</span>}
                {!searching && query && !matches.length && <span className="patient-picker__status">No matching active Patient.</span>}
                {!!matches.length && (
                  <div className="patient-picker__results">
                    {matches.map((patient) => (
                      <button type="button" key={patient.id} onClick={() => selectPatient(patient)}>
                        <PatientContext patient={patient} />
                        <span aria-hidden="true">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="inline-patient-form">
            <p>The Patient and appointment will be created together. The date, time, and reason remain attached.</p>
            <PatientFields form={newPatient} onChange={updateNewPatient} />
          </div>
        )}
      </section>

      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button primary-button--compact" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : visit ? "Save appointment" : "Add appointment"}
        </button>
      </div>
    </form>
  );
}

function AppointmentRow({ visit, readOnly, onCheckIn, onEdit, onDelete }) {
  return (
    <div className="visit-row appointment-row">
      <div className="visit-time">
        <strong>{formatTime(visit.scheduled_time)}</strong>
        <small>{visit.status === "checked_in" ? "Checked in" : "Planned"}</small>
      </div>
      <PatientContext patient={visit.patient} />
      <div className="visit-reason">
        <small>Reason</small>
        <span>{visit.reason || "No reason recorded"}</span>
      </div>
      {readOnly ? (
        <span className={`status-chip status-chip--${visit.status}`}>
          {visit.status === "checked_in" ? "Checked in" : "Planned"}
        </span>
      ) : (
        <div className="visit-row__actions">
          {visit.can_check_in && (
            <button className="check-in-button" type="button" onClick={() => onCheckIn(visit)}>Check in</button>
          )}
          <button className="secondary-button" type="button" onClick={() => onEdit(visit)}>Edit</button>
          {visit.can_delete && <button className="danger-button" type="button" onClick={() => onDelete(visit)}>Delete</button>}
        </div>
      )}
    </div>
  );
}

function QueueRow({ item }) {
  return (
    <div className="queue-row">
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
    </div>
  );
}

export default function ScheduleWorkspace({
  staffToken,
  requestedVisitId,
  onRequestedVisitHandled,
  onVisitChanged,
  onRegisterUndo,
  refreshVersion = 0,
  readOnly = false,
}) {
  const today = useMemo(() => localDateValue(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visits, setVisits] = useState([]);
  const [queue, setQueue] = useState([]);
  const [mode, setMode] = useState("list");
  const [editingVisit, setEditingVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadVisits(date = selectedDate, { quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest(`/api/visits/?date=${encodeURIComponent(date)}`, { staffToken });
      setVisits(payload.visits);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Appointments could not be loaded."));
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

  async function refreshAll({ quiet = false } = {}) {
    await Promise.all([loadVisits(selectedDate, { quiet }), loadQueue({ quiet })]);
  }

  useEffect(() => {
    loadVisits(selectedDate);
  }, [selectedDate, staffToken, refreshVersion]);

  useEffect(() => {
    loadQueue();
    const timer = globalThis.setInterval(() => loadQueue({ quiet: true }), 3_000);
    return () => globalThis.clearInterval(timer);
  }, [staffToken, refreshVersion]);

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
    await Promise.all([loadVisits(visit.date), loadQueue()]);
    onVisitChanged?.();
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

  return (
    <section className="schedule-workspace">
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
            <div className="queue-list">{queue.map((item) => <QueueRow item={item} key={item.id} />)}</div>
          ) : (
            <p className="schedule-empty">No Patients are checked in.</p>
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
              The Doctor workspace shows appointments and the live queue without management controls.
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
              defaultDate={selectedDate}
              defaultTime={selectedDate === today ? localTimeValue() : ""}
              staffToken={staffToken}
              onSaved={saved}
              onCancel={() => setMode("list")}
            />
          )}
          {mode === "edit" && editingVisit && (
            <VisitForm
              visit={editingVisit}
              defaultDate={editingVisit.date}
              defaultTime={editingVisit.scheduled_time?.slice(0, 5) ?? ""}
              staffToken={staffToken}
              onSaved={saved}
              onCancel={() => { setEditingVisit(null); setMode("list"); }}
            />
          )}
        </div>
      </article>
    </section>
  );
}
