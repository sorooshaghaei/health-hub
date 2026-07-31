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

function PatientContext({ patient }) {
  return (
    <span className="patient-context">
      <strong>{patient.full_name}</strong>
      <small>{patient.gender} · {patient.phone_e164} · {formatDate(patient.date_of_birth)}</small>
    </span>
  );
}

function VisitForm({ visit, visitType, defaultDate, staffToken, onSaved, onCancel }) {
  const type = visit?.visit_type ?? visitType;
  const [schedule, setSchedule] = useState({
    date: visit?.date ?? defaultDate,
    scheduled_time: visit?.scheduled_time?.slice(0, 5) ?? "",
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
    if (patientMode !== "existing" || !query.trim()) {
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
  }, [patientMode, query, staffToken]);

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
    if (patientMode === "existing" && !selectedPatient && !visit) {
      setError(new ApiError("Choose an existing patient or create a new patient."));
      return;
    }

    const data = {};
    if (!visit) data.visit_type = type;
    if (type === "appointment") {
      data.date = schedule.date;
      data.scheduled_time = schedule.scheduled_time;
      data.reason = schedule.reason;
    }

    if (patientMode === "new") {
      data.new_patient = {
        ...newPatient,
        date_of_birth: newPatient.date_of_birth || null,
        confirm_duplicate: confirmDuplicate,
      };
    } else if (selectedPatient && (!visit || patientChanged)) {
      data.patient_id = selectedPatient.id;
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
        setError(requestError instanceof ApiError ? requestError : new ApiError("Visit could not be saved."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  const heading = visit
    ? `Edit ${type === "appointment" ? "appointment" : "walk-in"}`
    : type === "appointment"
      ? "Schedule appointment"
      : "Add walk-in";

  return (
    <form className="visit-form" onSubmit={(event) => { event.preventDefault(); save(false); }}>
      <div className="patient-section-heading">
        <div>
          <p className="eyebrow">{visit ? "Edit Visit" : "New Visit"}</p>
          <h3>{heading}</h3>
          <p>
            {type === "appointment"
              ? "Choose a Patient, date, scheduled time, and an optional reason."
              : visit
                ? `The walk-in date remains ${formatDate(visit.date)}.`
                : `The walk-in date is recorded automatically as ${formatDate(localDateValue())}.`}
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

      {type === "appointment" && (
        <div className="visit-schedule-fields">
          <Field
            label="Date"
            name="date"
            type="date"
            value={schedule.date}
            onChange={(event) => setSchedule((current) => ({ ...current, date: event.target.value }))}
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
      )}

      {type === "appointment" && (
        <TextAreaField
          label="Visit reason"
          name="reason"
          value={schedule.reason}
          onChange={(event) => setSchedule((current) => ({ ...current, reason: event.target.value }))}
          rows="3"
          hint="Optional."
        />
      )}

      <section className="patient-picker">
        <div className="patient-picker__heading">
          <div>
            <p className="eyebrow">Patient</p>
            <h4>{patientMode === "new" ? "Create a new Patient" : "Use an existing Patient"}</h4>
          </div>
          {patientMode === "new" ? (
            <button className="text-button" type="button" onClick={() => { setPatientMode("existing"); setWarning(null); }}>Search existing</button>
          ) : (
            <button className="text-button" type="button" onClick={startNewPatient}>Create new Patient</button>
          )}
        </div>

        {patientMode === "existing" ? (
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
            <p>The Patient and this Visit will be created together. The schedule fields above remain attached to the new profile.</p>
            <PatientFields form={newPatient} onChange={updateNewPatient} />
          </div>
        )}
      </section>

      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button primary-button--compact" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : visit ? "Save Visit" : type === "appointment" ? "Add appointment" : "Add walk-in"}
        </button>
      </div>
    </form>
  );
}

function VisitRow({ visit, onEdit, onRemove }) {
  return (
    <div className="visit-row">
      <div className={`visit-time visit-time--${visit.visit_type}`}>
        <strong>{visit.visit_type === "appointment" ? formatTime(visit.scheduled_time) : "Walk-in"}</strong>
        <small>{visit.visit_type === "appointment" ? "Scheduled" : "Current day"}</small>
      </div>
      <PatientContext patient={visit.patient} />
      <div className="visit-reason">
        <small>Reason</small>
        <span>{visit.reason || "No reason recorded"}</span>
      </div>
      <div className="visit-row__actions">
        <button className="secondary-button" type="button" onClick={() => onEdit(visit)}>Edit</button>
        {visit.can_delete && <button className="danger-button" type="button" onClick={() => onRemove(visit)}>Remove</button>}
      </div>
    </div>
  );
}

export default function ScheduleWorkspace({
  staffToken,
  requestedVisitId,
  onRequestedVisitHandled,
  onVisitChanged,
}) {
  const today = useMemo(() => localDateValue(), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [visits, setVisits] = useState([]);
  const [mode, setMode] = useState("list");
  const [editingVisit, setEditingVisit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadVisits(date = selectedDate) {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiRequest(`/api/visits/?date=${encodeURIComponent(date)}`, { staffToken });
      setVisits(payload.visits);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Visits could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVisits(selectedDate);
  }, [selectedDate, staffToken]);

  useEffect(() => {
    if (!requestedVisitId) return;
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
        if (!cancelled) setError(requestError instanceof ApiError ? requestError : new ApiError("Visit could not be opened."));
      });
    return () => { cancelled = true; };
  }, [requestedVisitId, staffToken, onRequestedVisitHandled]);

  async function saved(visit) {
    setSelectedDate(visit.date);
    setEditingVisit(null);
    setMode("list");
    await loadVisits(visit.date);
    onVisitChanged?.();
  }

  async function removeVisit(visit) {
    if (!globalThis.confirm("Remove this future Visit?")) return;
    setError(null);
    try {
      await apiRequest(`/api/visits/${visit.id}/`, { method: "DELETE", staffToken });
      await loadVisits(selectedDate);
      onVisitChanged?.();
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Visit could not be removed."));
    }
  }

  const appointments = visits.filter((visit) => visit.visit_type === "appointment");
  const walkIns = visits.filter((visit) => visit.visit_type === "walk_in");

  return (
    <section className="workspace-card phase2-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Daily planning</p>
          <h2>Appointments and walk-ins</h2>
        </div>
        <span className="count-badge">{visits.length}</span>
      </div>

      <div className="phase2-content">
        <ErrorMessage error={error} />

        {mode === "list" && (
          <>
            <div className="schedule-toolbar">
              <div className="schedule-date-control">
                <Field
                  label="Working date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
                {selectedDate !== today && <button className="text-button" type="button" onClick={() => setSelectedDate(today)}>Today</button>}
              </div>
              <div className="schedule-actions">
                <button className="secondary-button" type="button" onClick={() => setMode("walk_in")}>+ Add walk-in</button>
                <button className="primary-button primary-button--compact" type="button" onClick={() => setMode("appointment")}>+ New appointment</button>
              </div>
            </div>

            {loading ? (
              <div className="patient-loading"><div className="loader" aria-label="Loading visits" /></div>
            ) : (
              <>
                <section className="schedule-section">
                  <div className="schedule-section__heading">
                    <h3>Scheduled appointments</h3>
                    <span>{appointments.length}</span>
                  </div>
                  {appointments.length ? appointments.map((visit) => (
                    <VisitRow
                      visit={visit}
                      key={visit.id}
                      onEdit={(item) => { setEditingVisit(item); setMode("edit"); }}
                      onRemove={removeVisit}
                    />
                  )) : <p className="schedule-empty">No appointments for this date.</p>}
                </section>

                <section className="schedule-section">
                  <div className="schedule-section__heading">
                    <h3>Walk-ins</h3>
                    <span>{walkIns.length}</span>
                  </div>
                  {walkIns.length ? walkIns.map((visit) => (
                    <VisitRow
                      visit={visit}
                      key={visit.id}
                      onEdit={(item) => { setEditingVisit(item); setMode("edit"); }}
                      onRemove={removeVisit}
                    />
                  )) : <p className="schedule-empty">No walk-ins recorded for this date.</p>}
                </section>
              </>
            )}
          </>
        )}

        {mode === "appointment" && (
          <VisitForm
            visitType="appointment"
            defaultDate={selectedDate}
            staffToken={staffToken}
            onSaved={saved}
            onCancel={() => setMode("list")}
          />
        )}
        {mode === "walk_in" && (
          <VisitForm
            visitType="walk_in"
            defaultDate={today}
            staffToken={staffToken}
            onSaved={saved}
            onCancel={() => setMode("list")}
          />
        )}
        {mode === "edit" && editingVisit && (
          <VisitForm
            visit={editingVisit}
            defaultDate={editingVisit.date}
            staffToken={staffToken}
            onSaved={saved}
            onCancel={() => { setEditingVisit(null); setMode("list"); }}
          />
        )}
      </div>
    </section>
  );
}
