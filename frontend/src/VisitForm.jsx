import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import { appointmentPatientPayload, shouldSuggestPatients } from "./appointmentPatientFlow.js";
import { dateValueInTimeZone } from "./clinicTime.js";
import { suggestedAppointmentTimes, workingHoursForDate } from "./clinicWorkingHours.js";
import {
  DuplicateWarning,
  PatientFields,
  emptyPatient,
  formatDate,
  formatTime,
} from "./patientForm.jsx";
import { ErrorMessage, Field, TextAreaField } from "./ui.jsx";

const STATUS_LABELS = {
  planned: "Planned",
  checked_in: "Checked in",
  with_doctor: "With doctor",
  doctor_finished: "Completed",
};

function statusLabel(status) {
  return STATUS_LABELS[status] ?? status;
}

function PatientSummary({ patient }) {
  return (
    <span className="patient-context">
      <strong>{patient.full_name}</strong>
      <small>
        {patient.gender}
        {patient.phone_e164 ? ` · ${patient.phone_e164}` : ""}
        {patient.date_of_birth ? ` · ${formatDate(patient.date_of_birth)}` : ""}
      </small>
    </span>
  );
}

function SameDayAppointmentWarning({ conflict, onOpenExisting }) {
  if (!conflict) return null;
  const appointment = conflict.appointment;
  return (
    <div className="duplicate-warning" role="alert">
      <div>
        <p className="eyebrow">Existing appointment</p>
        <strong>This Patient already has an appointment on this date.</strong>
        <span>
          {conflict.recently_deleted
            ? "The existing appointment was just deleted. Use the five-second Undo action or wait for it to expire."
            : `${formatTime(appointment.scheduled_time)} · ${statusLabel(appointment.status)}`}
        </span>
      </div>
      {!conflict.recently_deleted && (
        <button className="secondary-button" type="button" onClick={() => onOpenExisting(appointment)}>
          Open appointment
        </button>
      )}
    </div>
  );
}

function PatientSuggestion({ patient, onSelect }) {
  return (
    <button type="button" role="option" onClick={() => onSelect(patient)}>
      <span className="patient-suggestion__identity">
        <strong>{patient.full_name}</strong>
        <span>{patient.phone_e164 || "No phone recorded"}</span>
      </span>
      <span className="patient-suggestion__details">
        <span>{patient.gender}</span>
        {patient.date_of_birth && <span>{formatDate(patient.date_of_birth)}</span>}
      </span>
    </button>
  );
}

export default function VisitForm({
  visit,
  defaultDate,
  defaultTime,
  clinic,
  staffToken,
  onSaved,
  onCancel,
  onOpenExisting,
  onOpenPatient,
}) {
  const workflowStarted = Boolean(visit && visit.status !== "planned");
  const [schedule, setSchedule] = useState({
    date: visit?.date ?? defaultDate,
    scheduled_time: visit?.scheduled_time?.slice(0, 5) ?? defaultTime,
    reason: visit?.reason ?? "",
  });
  const [selectedPatient, setSelectedPatient] = useState(visit?.patient ?? null);
  const [patientChanged, setPatientChanged] = useState(false);
  const [patientDraft, setPatientDraft] = useState(emptyPatient());
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [warning, setWarning] = useState(null);
  const [sameDayConflict, setSameDayConflict] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [workingHours, setWorkingHours] = useState([]);
  const [workingHoursConfigured, setWorkingHoursConfigured] = useState(false);
  const [workingHoursLoaded, setWorkingHoursLoaded] = useState(false);
  const [workingHoursUnavailable, setWorkingHoursUnavailable] = useState(false);

  const typedName = patientDraft.full_name.trim();
  const clinicToday = dateValueInTimeZone(clinic?.timezone || "UTC");
  const selectedDayHours = workingHoursForDate(workingHours, schedule.date);
  const timeSuggestions = selectedDayHours
    ? suggestedAppointmentTimes(selectedDayHours.start_time, selectedDayHours.end_time)
    : [];

  useEffect(() => {
    setWorkingHours([]);
    setWorkingHoursConfigured(false);
    setWorkingHoursUnavailable(false);
    if (workflowStarted || !clinic?.id) {
      setWorkingHoursLoaded(true);
      return undefined;
    }
    let cancelled = false;
    setWorkingHoursLoaded(false);
    apiRequest(`/api/clinics/${clinic.id}/working-hours/`, { staffToken })
      .then((payload) => {
        if (cancelled) return;
        setWorkingHours(payload.working_hours);
        setWorkingHoursConfigured(payload.configured);
      })
      .catch(() => {
        if (!cancelled) setWorkingHoursUnavailable(true);
      })
      .finally(() => { if (!cancelled) setWorkingHoursLoaded(true); });
    return () => { cancelled = true; };
  }, [workflowStarted, clinic?.id, staffToken]);

  useEffect(() => {
    if (workflowStarted || selectedPatient || !shouldSuggestPatients(typedName)) {
      setMatches([]);
      setSearching(false);
      setSearchCompleted(false);
      return undefined;
    }

    let cancelled = false;
    setSearchCompleted(false);
    const timer = globalThis.setTimeout(async () => {
      setSearching(true);
      try {
        const payload = await apiRequest(
          `/api/patients/?search=${encodeURIComponent(typedName)}`,
          { staffToken },
        );
        if (!cancelled) {
          setMatches(payload.patients.slice(0, 8));
          setSearchCompleted(true);
        }
      } catch (requestError) {
        if (!cancelled) {
          setMatches([]);
          setSearchCompleted(true);
          setError(
            requestError instanceof ApiError
              ? requestError
              : new ApiError("Patient search failed."),
          );
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      globalThis.clearTimeout(timer);
    };
  }, [workflowStarted, selectedPatient, typedName, staffToken]);

  function selectPatient(patient) {
    setSelectedPatient(patient);
    setPatientChanged(!visit || patient.id !== visit.patient.id);
    setMatches([]);
    setSearchCompleted(false);
    setWarning(null);
    setSameDayConflict(null);
    setError(null);
  }

  function changePatient() {
    setSelectedPatient(null);
    setPatientChanged(true);
    setPatientDraft(emptyPatient());
    setMatches([]);
    setSearchCompleted(false);
    setWarning(null);
    setSameDayConflict(null);
    setError(null);
  }

  function updatePatientDraft(name, value) {
    setWarning(null);
    setSameDayConflict(null);
    setError(null);
    setPatientDraft((current) => ({ ...current, [name]: value }));
  }

  async function save(confirmDuplicate = false) {
    if (!workflowStarted && !selectedPatient && !patientDraft.full_name.trim()) {
      setError(new ApiError("Enter the Patient name or choose an existing Patient."));
      return;
    }

    const data = {
      date: schedule.date,
      scheduled_time: schedule.scheduled_time,
      reason: schedule.reason,
    };

    Object.assign(data, appointmentPatientPayload({
      workflowStarted,
      visit,
      selectedPatient,
      patientChanged,
      patientDraft,
      confirmDuplicate,
    }));

    setError(null);
    setSameDayConflict(null);
    setSubmitting(true);
    try {
      const saved = await apiRequest(
        visit ? `/api/visits/${visit.id}/` : "/api/visits/",
        {
          method: visit ? "PATCH" : "POST",
          data,
          staffToken,
        },
      );
      await onSaved(saved);
    } catch (requestError) {
      if (
        requestError instanceof ApiError
        && requestError.status === 409
        && requestError.fields?.code === "same_day_appointment_exists"
      ) {
        setSameDayConflict(requestError.fields);
      } else if (
        requestError instanceof ApiError
        && requestError.status === 409
        && requestError.fields?.code === "possible_duplicate"
      ) {
        setWarning(requestError.fields);
      } else {
        setError(
          requestError instanceof ApiError
            ? requestError
            : new ApiError("Appointment could not be saved."),
        );
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
            {workflowStarted
              ? "The Patient and appointment date are locked after check-in. Scheduled time and reason can still be corrected."
              : "Start with the Patient name. Existing Patients are suggested automatically while you type."}
          </p>
        </div>
      </div>

      <ErrorMessage error={error} />
      <SameDayAppointmentWarning conflict={sameDayConflict} onOpenExisting={onOpenExisting} />
      <DuplicateWarning
        warning={warning}
        onUseExisting={(match) => selectPatient({ ...match, active: true })}
        onCreateSeparate={() => save(true)}
      />

      <section className="patient-picker patient-picker--first">
        <div className="patient-picker__heading">
          <div>
            <p className="eyebrow">Patient</p>
            <h4>{workflowStarted ? "Checked-in Patient" : selectedPatient ? "Selected Patient" : "Patient information"}</h4>
          </div>
        </div>

        {workflowStarted ? (
          <div className="selected-patient selected-patient--locked">
            <PatientSummary patient={selectedPatient} />
            <span>Locked after check-in</span>
          </div>
        ) : selectedPatient ? (
          <div className="selected-patient">
            <PatientSummary patient={selectedPatient} />
            <div className="selected-patient__actions">
              {onOpenPatient && (
                <button className="text-button" type="button" onClick={() => onOpenPatient(selectedPatient.id)}>
                  Open profile
                </button>
              )}
              <button className="text-button" type="button" onClick={changePatient}>Change</button>
            </div>
          </div>
        ) : (
          <div className="inline-patient-form">
            <div className="patient-name-entry">
              <Field
                label="Full name"
                name="full_name"
                value={patientDraft.full_name}
                onChange={(event) => updatePatientDraft("full_name", event.target.value)}
                autoComplete="off"
                placeholder="Start typing the Patient name"
                required
                autoFocus
              />
              {searching && <span className="patient-name-entry__status">Searching…</span>}
              {!!matches.length && (
                <div className="patient-picker__results patient-picker__results--overlay" role="listbox" aria-label="Matching existing Patients">
                  {matches.map((patient) => (
                    <PatientSuggestion patient={patient} onSelect={selectPatient} key={patient.id} />
                  ))}
                </div>
              )}
            </div>
            {shouldSuggestPatients(typedName) && searchCompleted && !searching && !matches.length && (
              <p className="patient-picker__status">No existing Patient found. Continue below to create a new profile.</p>
            )}
            <PatientFields form={patientDraft} onChange={updatePatientDraft} includeName={false} />
          </div>
        )}
      </section>

      <section className="appointment-details">
        <div className="appointment-details__heading">
          <p className="eyebrow">Appointment</p>
          <h4>Date, time, and reason</h4>
        </div>
        <div className="visit-schedule-fields">
          <div className="visit-date-control">
            <Field
              label="Date"
              name="date"
              type="date"
              value={schedule.date}
              onChange={(event) => {
                setSameDayConflict(null);
                setSchedule((current) => ({ ...current, date: event.target.value }));
              }}
              disabled={workflowStarted}
              required
            />
            {!workflowStarted && <div className="visit-date-control__actions"><button className="text-button" type="button" disabled={schedule.date === clinicToday} onClick={() => { setSameDayConflict(null); setSchedule((current) => ({ ...current, date: clinicToday })); }}>Today</button></div>}
          </div>
          <Field
            label="Scheduled time"
            name="scheduled_time"
            type="time"
            value={schedule.scheduled_time}
            onChange={(event) => setSchedule((current) => ({ ...current, scheduled_time: event.target.value }))}
            required
          />
          {!workflowStarted && workingHoursLoaded && (
            <div className="appointment-time-guidance">
              {workingHoursConfigured && !selectedDayHours && schedule.date && <p className="appointment-working-warning" role="status">This is not a working day for this clinic.</p>}
              {workingHoursUnavailable && <p className="appointment-hours-unavailable">Working hours could not be loaded. Enter the time manually.</p>}
              {!!timeSuggestions.length && <div className="appointment-time-suggestions" aria-label="Suggested appointment times"><span>Suggested times</span>{timeSuggestions.map((time) => <button type="button" key={time} aria-pressed={schedule.scheduled_time === time} onClick={() => setSchedule((current) => ({ ...current, scheduled_time: time }))}>{time}</button>)}</div>}
            </div>
          )}
        </div>
        <TextAreaField
          label="Visit reason"
          name="reason"
          value={schedule.reason}
          onChange={(event) => setSchedule((current) => ({ ...current, reason: event.target.value }))}
          rows="3"
          hint="Optional."
        />
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
