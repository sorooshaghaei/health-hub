import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import {
  PATIENT_PICKER_MODE,
  appointmentPatientPayload,
  shouldSuggestPatients,
} from "./appointmentPatientFlow.js";
import { dateValueInTimeZone } from "./clinicTime.js";
import { suggestedAppointmentTimes, workingHoursForDate } from "./clinicWorkingHours.js";
import { normalizePatientPhone } from "./patientPhoneFormats.js";
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
    <button
      type="button"
      role="option"
      aria-label={`Select existing Patient ${patient.full_name}`}
      onClick={() => onSelect(patient)}
    >
      <span className="patient-suggestion__identity">
        <strong>{patient.full_name}</strong>
        <span>{patient.phone_e164 || "No phone recorded"}</span>
      </span>
      <span className="patient-suggestion__details">
        <span>{patient.gender}</span>
        {patient.date_of_birth && <span>{formatDate(patient.date_of_birth)}</span>}
      </span>
      <span className="patient-suggestion__select" aria-hidden="true">Select</span>
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
  const [patientPickerMode, setPatientPickerMode] = useState(PATIENT_PICKER_MODE.SEARCH);
  const [patientSearch, setPatientSearch] = useState("");
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

  const typedName = patientSearch.trim();
  const clinicToday = dateValueInTimeZone(clinic?.timezone || "UTC");
  const selectedDayHours = workingHoursForDate(workingHours, schedule.date);
  const timeSuggestions = selectedDayHours
    ? suggestedAppointmentTimes(selectedDayHours.start_time, selectedDayHours.end_time)
    : [];
  const patientChoicePending = !workflowStarted
    && !selectedPatient
    && patientPickerMode !== PATIENT_PICKER_MODE.CREATE;

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
    if (
      workflowStarted
      || selectedPatient
      || patientPickerMode !== PATIENT_PICKER_MODE.SEARCH
      || !shouldSuggestPatients(typedName)
    ) {
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
  }, [workflowStarted, selectedPatient, patientPickerMode, typedName, staffToken]);

  function selectPatient(patient) {
    setSelectedPatient(patient);
    setPatientPickerMode(PATIENT_PICKER_MODE.SEARCH);
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
    setPatientPickerMode(PATIENT_PICKER_MODE.SEARCH);
    setPatientSearch("");
    setPatientDraft(emptyPatient());
    setMatches([]);
    setSearchCompleted(false);
    setWarning(null);
    setSameDayConflict(null);
    setError(null);
  }

  function createNewPatient() {
    setPatientPickerMode(PATIENT_PICKER_MODE.CREATE);
    setPatientDraft({ ...emptyPatient(), full_name: typedName });
    setMatches([]);
    setSearchCompleted(false);
    setWarning(null);
    setSameDayConflict(null);
    setError(null);
  }

  function returnToPatientSearch() {
    setPatientSearch(patientDraft.full_name);
    setPatientPickerMode(PATIENT_PICKER_MODE.SEARCH);
    setPatientDraft(emptyPatient());
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
    if (
      !workflowStarted
      && !selectedPatient
      && patientPickerMode !== PATIENT_PICKER_MODE.CREATE
    ) {
      setError(new ApiError("Select an existing Patient or choose Create new patient."));
      return;
    }

    if (
      !workflowStarted
      && patientPickerMode === PATIENT_PICKER_MODE.CREATE
      && !patientDraft.full_name.trim()
    ) {
      setError(new ApiError("Enter the new Patient's full name."));
      return;
    }

    let normalizedPatientDraft = patientDraft;
    if (!workflowStarted && !selectedPatient) {
      try {
        normalizedPatientDraft = {
          ...patientDraft,
          ...normalizePatientPhone(patientDraft.country_calling_code, patientDraft.phone_number),
        };
      } catch (phoneError) {
        setError(new ApiError(phoneError.message));
        return;
      }
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
      patientPickerMode,
      patientDraft: normalizedPatientDraft,
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
          <p className="eyebrow">{visit ? "Edit appointment" : "Appointment details"}</p>
          <h3>{visit ? "Edit appointment" : "New appointment"}</h3>
          <p>
            {workflowStarted
              ? "The Patient and appointment date are locked after check-in. Scheduled time and reason can still be corrected."
              : "Search for an existing Patient first, or choose to create a new Patient after the search."}
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
            <h4>
              {workflowStarted
                ? "Checked-in Patient"
                : selectedPatient
                  ? "Selected Patient"
                  : patientPickerMode === PATIENT_PICKER_MODE.CREATE
                    ? "New Patient"
                    : "Find Patient"}
            </h4>
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
        ) : patientPickerMode === PATIENT_PICKER_MODE.CREATE ? (
          <div className="inline-patient-form">
            <div className="patient-picker__new-heading">
              <p>Enter the information for a new reusable Patient profile.</p>
              <button className="text-button" type="button" onClick={returnToPatientSearch}>
                Back to patient search
              </button>
            </div>
            <PatientFields form={patientDraft} onChange={updatePatientDraft} />
          </div>
        ) : (
          <div className="patient-search-workflow">
            <div className="patient-name-entry">
              <Field
                label="Search existing patients"
                name="patient_search"
                value={patientSearch}
                onChange={(event) => {
                  setPatientSearch(event.target.value);
                  setError(null);
                }}
                autoComplete="off"
                placeholder="Type at least 2 characters"
                autoFocus={!visit}
              />
              {searching && <span className="patient-name-entry__status">Searching…</span>}
            </div>
            {!shouldSuggestPatients(typedName) && (
              <p className="patient-picker__status">Enter at least 2 characters to search this clinic's Patients.</p>
            )}
            {shouldSuggestPatients(typedName) && searchCompleted && !searching && (
              <div className="patient-search-results">
                {!!matches.length ? (
                  <>
                    <p className="patient-search-results__label">Select existing patient</p>
                    <div className="patient-picker__results" role="listbox" aria-label="Matching existing Patients">
                      {matches.map((patient) => (
                        <PatientSuggestion patient={patient} onSelect={selectPatient} key={patient.id} />
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="patient-picker__status patient-picker__status--empty">No existing Patient found.</p>
                )}
                <div className="patient-picker__create-choice">
                  <div>
                    <strong>Not an existing Patient?</strong>
                    <span>Create a new reusable profile with the full Patient form.</span>
                  </div>
                  <button className="secondary-button" type="button" onClick={createNewPatient}>
                    Create new patient
                  </button>
                </div>
              </div>
            )}
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
        <button
          className="primary-button primary-button--compact"
          type="submit"
          disabled={submitting || patientChoicePending}
        >
          {submitting ? "Saving…" : visit ? "Save appointment" : "Create appointment"}
        </button>
      </div>
    </form>
  );
}
