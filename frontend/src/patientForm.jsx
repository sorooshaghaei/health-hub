import { useState } from "react";

import { ApiError } from "./api.js";
import { ErrorMessage, Field, SelectField, TextAreaField } from "./ui.jsx";

export const COUNTRY_CODES = [
  ["Iran", "+98"],
  ["France", "+33"],
  ["United States / Canada", "+1"],
  ["United Kingdom", "+44"],
  ["Germany", "+49"],
  ["Turkey", "+90"],
  ["United Arab Emirates", "+971"],
  ["Saudi Arabia", "+966"],
  ["Qatar", "+974"],
  ["Kuwait", "+965"],
  ["Iraq", "+964"],
  ["Afghanistan", "+93"],
  ["Pakistan", "+92"],
  ["India", "+91"],
  ["Armenia", "+374"],
  ["Azerbaijan", "+994"],
  ["Georgia", "+995"],
];

export function emptyPatient() {
  return {
    full_name: "",
    gender: "",
    country_calling_code: "+98",
    phone_number: "",
    date_of_birth: "",
    patient_note: "",
  };
}

export function patientFormValue(patient) {
  if (!patient) return emptyPatient();
  return {
    full_name: patient.full_name,
    gender: patient.gender,
    country_calling_code: patient.country_calling_code,
    phone_number: patient.phone_number,
    date_of_birth: patient.date_of_birth ?? "",
    patient_note: patient.patient_note ?? "",
  };
}

export function formatDate(value) {
  if (!value) return "Not recorded";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value) {
  if (!value) return "No scheduled time";
  return value.slice(0, 5);
}

export function PatientFields({ form, onChange, includeNote = true }) {
  const update = (event) => onChange(event.target.name, event.target.value);
  return (
    <>
      <div className="patient-form-grid">
        <Field label="Full name" name="full_name" value={form.full_name} onChange={update} autoComplete="name" required />
        <SelectField label="Gender" name="gender" value={form.gender} onChange={update} required>
          <option value="">Choose gender</option>
          <option value="Man">Man</option>
          <option value="Woman">Woman</option>
        </SelectField>
        <Field
          label="Country calling code"
          name="country_calling_code"
          value={form.country_calling_code}
          onChange={update}
          list="patient-country-codes"
          inputMode="tel"
          required
        />
        <Field
          label="Phone number"
          name="phone_number"
          value={form.phone_number}
          onChange={update}
          inputMode="tel"
          autoComplete="tel-national"
          hint="Enter the national number; the selected calling code is stored separately."
          required
        />
        <Field label="Date of birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={update} />
      </div>
      <datalist id="patient-country-codes">
        {COUNTRY_CODES.map(([country, code]) => <option value={code} key={`${country}-${code}`}>{country}</option>)}
      </datalist>
      {includeNote && (
        <TextAreaField
          label="Patient note"
          name="patient_note"
          value={form.patient_note}
          onChange={update}
          rows="4"
          hint="Shared plain text visible and editable by both Doctor and Assistant."
        />
      )}
    </>
  );
}

export function DuplicateWarning({ warning, onUseExisting, onCreateSeparate }) {
  if (!warning) return null;
  return (
    <div className="duplicate-warning" role="alert">
      <div>
        <p className="eyebrow">Check existing profile</p>
        <strong>Possible duplicate patient</strong>
        <span>Using an existing patient is preferred. Create a separate profile only when this is a different person.</span>
      </div>
      <div className="duplicate-matches">
        {warning.matches.map((match) => (
          <button type="button" key={match.id} onClick={() => onUseExisting(match)}>
            <strong>{match.full_name}</strong>
            <span>{match.gender} · {match.phone_e164} · {formatDate(match.date_of_birth)}</span>
          </button>
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={onCreateSeparate}>Create separate patient</button>
    </div>
  );
}

export function PatientProfileForm({ patient, onSave, onCancel, onUseExisting }) {
  const [form, setForm] = useState(patientFormValue(patient));
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(name, value) {
    setWarning(null);
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save(confirmDuplicate = false) {
    setError(null);
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        date_of_birth: form.date_of_birth || null,
        confirm_duplicate: confirmDuplicate,
      });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409 && requestError.fields?.code === "possible_duplicate") {
        setWarning(requestError.fields);
      } else {
        setError(requestError instanceof ApiError ? requestError : new ApiError("Something went wrong."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="patient-form" onSubmit={(event) => { event.preventDefault(); save(false); }}>
      <div className="patient-section-heading">
        <div>
          <p className="eyebrow">{patient ? "Edit profile" : "New profile"}</p>
          <h3>{patient ? patient.full_name : "Add patient"}</h3>
          <p>Create the reusable Patient profile here. Appointments and walk-ins can be added from Schedule.</p>
        </div>
      </div>
      <ErrorMessage error={error} />
      <DuplicateWarning
        warning={warning}
        onUseExisting={(match) => onUseExisting(match.id)}
        onCreateSeparate={() => save(true)}
      />
      <PatientFields form={form} onChange={update} />
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button primary-button--compact" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : patient ? "Save changes" : "Create patient"}
        </button>
      </div>
    </form>
  );
}
