import { useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import { Brand, ErrorMessage, Field, SelectField, TextAreaField } from "./ui.jsx";

const EMPTY_PATIENT = {
  full_name: "",
  gender: "",
  country_calling_code: "+98",
  phone_number: "",
  date_of_birth: "",
  patient_note: "",
};

const COUNTRY_CODES = [
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

function formatDate(value) {
  if (!value) return "Not recorded";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function PatientList({ patients, search, onSearchChange, onSearch, onClear, onAdd, onOpen, loading }) {
  return (
    <>
      <div className="patient-toolbar">
        <form className="patient-search" onSubmit={onSearch}>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, phone, or date of birth"
            aria-label="Search patients"
          />
          <button type="submit" className="secondary-button">Search</button>
          {search && <button type="button" className="text-button" onClick={onClear}>Clear</button>}
        </form>
        <button className="primary-button primary-button--compact" type="button" onClick={onAdd}>+ Add patient</button>
      </div>
      {loading ? (
        <div className="patient-loading"><div className="loader" aria-label="Loading patients" /></div>
      ) : patients.length ? (
        <div className="patient-list">
          {patients.map((patient) => (
            <button className="patient-row" type="button" key={patient.id} onClick={() => onOpen(patient.id)}>
              <span className="patient-avatar" aria-hidden="true">{patient.full_name.slice(0, 1).toUpperCase()}</span>
              <span className="patient-row__identity">
                <strong>{patient.full_name}</strong>
                <small>{patient.gender} · {patient.phone_e164}</small>
              </span>
              <span className="patient-row__birth">
                <small>Date of birth</small>
                <strong>{formatDate(patient.date_of_birth)}</strong>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state__dot" />
          <strong>{search ? "No matching patients" : "No patient profiles yet"}</strong>
          <span>{search ? "Try a different name, phone number, or date of birth." : "Create the first reusable patient profile for this clinic."}</span>
          {!search && <button className="secondary-button" type="button" onClick={onAdd}>Add first patient</button>}
        </div>
      )}
    </>
  );
}

function DuplicateWarning({ warning, onUseExisting, onCreateSeparate }) {
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
          <button type="button" key={match.id} onClick={() => onUseExisting(match.id)}>
            <strong>{match.full_name}</strong>
            <span>{match.phone_e164} · {formatDate(match.date_of_birth)}</span>
          </button>
        ))}
      </div>
      <button className="secondary-button" type="button" onClick={onCreateSeparate}>Create separate patient</button>
    </div>
  );
}

function PatientForm({ patient, onSave, onCancel, onUseExisting }) {
  const [form, setForm] = useState(patient ? {
    full_name: patient.full_name,
    gender: patient.gender,
    country_calling_code: patient.country_calling_code,
    phone_number: patient.phone_number,
    date_of_birth: patient.date_of_birth ?? "",
    patient_note: patient.patient_note ?? "",
  } : EMPTY_PATIENT);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function update(event) {
    setWarning(null);
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
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

  function submit(event) {
    event.preventDefault();
    save(false);
  }

  return (
    <form className="patient-form" onSubmit={submit}>
      <div className="patient-section-heading">
        <div>
          <p className="eyebrow">{patient ? "Edit profile" : "New profile"}</p>
          <h3>{patient ? patient.full_name : "Add patient"}</h3>
          <p>A Patient is a reusable person profile. Visits are added separately in a later phase.</p>
        </div>
      </div>
      <ErrorMessage error={error} />
      <DuplicateWarning warning={warning} onUseExisting={onUseExisting} onCreateSeparate={() => save(true)} />
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
      <TextAreaField
        label="Patient note"
        name="patient_note"
        value={form.patient_note}
        onChange={update}
        rows="5"
        hint="Shared plain text visible and editable by both Doctor and Assistant."
      />
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button primary-button--compact" type="submit" disabled={submitting}>
          {submitting ? "Saving…" : patient ? "Save changes" : "Create patient"}
        </button>
      </div>
    </form>
  );
}

function PatientDetail({ patient, onBack, onEdit, onDelete, deleting }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="patient-detail">
      <div className="patient-detail__topbar">
        <button className="back-button back-button--inline" type="button" onClick={onBack}>← Patients</button>
        <div className="patient-detail__actions">
          <button className="secondary-button" type="button" onClick={onEdit}>Edit</button>
          <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}>Delete</button>
        </div>
      </div>
      <div className="patient-profile-heading">
        <span className="patient-avatar patient-avatar--large">{patient.full_name.slice(0, 1).toUpperCase()}</span>
        <div>
          <p className="eyebrow">Patient profile</p>
          <h3>{patient.full_name}</h3>
          <span>{patient.gender}</span>
        </div>
      </div>
      <dl className="patient-facts">
        <div><dt>Phone</dt><dd>{patient.phone_e164}</dd></div>
        <div><dt>Country code</dt><dd>{patient.country_calling_code}</dd></div>
        <div><dt>National number</dt><dd>{patient.phone_number}</dd></div>
        <div><dt>Date of birth</dt><dd>{formatDate(patient.date_of_birth)}</dd></div>
      </dl>
      <section className="patient-note-card">
        <p className="eyebrow">Patient note</p>
        <p>{patient.patient_note || "No patient note has been added."}</p>
      </section>
      {confirmDelete && (
        <div className="delete-confirmation" role="alertdialog" aria-modal="true" aria-label="Delete patient">
          <strong>Delete this active patient profile?</strong>
          <p>Deleted profiles cannot receive new Visits. Historical Visit records will remain when Visit support is added.</p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="danger-button" type="button" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting…" : "Delete patient"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Workspace({ user, staffToken, onSignOut, onLeaveClinic }) {
  const doctor = user.role === "doctor";
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("list");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function loadPatients(query = search) {
    setLoading(true);
    setError(null);
    try {
      const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
      const payload = await apiRequest(`/api/patients/${suffix}`, { staffToken });
      setPatients(payload.patients);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patients could not be loaded."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPatients("");
  }, [staffToken]);

  async function openPatient(patientId) {
    setError(null);
    try {
      const patient = await apiRequest(`/api/patients/${patientId}/`, { staffToken });
      setSelectedPatient(patient);
      setView("detail");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be opened."));
    }
  }

  async function savePatient(data) {
    const editing = view === "edit" && selectedPatient;
    const patient = await apiRequest(editing ? `/api/patients/${selectedPatient.id}/` : "/api/patients/", {
      method: editing ? "PATCH" : "POST",
      data,
      staffToken,
    });
    setSelectedPatient(patient);
    setView("detail");
    await loadPatients(search);
  }

  async function deletePatient() {
    if (!selectedPatient) return;
    setDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/patients/${selectedPatient.id}/`, { method: "DELETE", staffToken });
      setSelectedPatient(null);
      setView("list");
      await loadPatients(search);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be deleted."));
    } finally {
      setDeleting(false);
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setView("list");
    loadPatients(search);
  }

  function clearSearch() {
    setSearch("");
    loadPatients("");
  }

  return (
    <div className="workspace">
      <header className="workspace-header">
        <Brand compact />
        <div className="workspace-header__clinic"><span>{user.clinic.name}</span><strong>{doctor ? "Doctor workspace" : "Assistant workspace"}</strong></div>
        <div className="user-menu"><div><strong>{user.display_name}</strong><span>{doctor ? "Doctor · Administrator" : "Assistant"}</span></div><button type="button" onClick={onSignOut}>Sign out</button></div>
      </header>
      <main className="workspace-main">
        <section className="workspace-title">
          <div><p className="eyebrow">Patient records</p><h1>{doctor ? "Doctor workspace" : "Assistant workspace"}</h1><p>Create and reuse permanent patient profiles. Appointments, Visits, queues, and consultation flow remain outside this phase.</p></div>
          <div className="status-pill"><span /> Clinic access active</div>
        </section>
        <ErrorMessage error={error} />
        <section className="workspace-grid">
          <article className="workspace-card workspace-card--wide workspace-card--patients">
            <div className="card-heading">
              <div><p className="eyebrow">Clinic records</p><h2>Patients</h2></div>
              <span className="count-badge">{patients.length}</span>
            </div>
            <div className="patient-content">
              {view === "list" && (
                <PatientList
                  patients={patients}
                  search={search}
                  onSearchChange={setSearch}
                  onSearch={submitSearch}
                  onClear={clearSearch}
                  onAdd={() => { setSelectedPatient(null); setView("create"); }}
                  onOpen={openPatient}
                  loading={loading}
                />
              )}
              {view === "create" && <PatientForm onSave={savePatient} onCancel={() => setView("list")} onUseExisting={openPatient} />}
              {view === "edit" && selectedPatient && <PatientForm patient={selectedPatient} onSave={savePatient} onCancel={() => setView("detail")} onUseExisting={openPatient} />}
              {view === "detail" && selectedPatient && (
                <PatientDetail
                  patient={selectedPatient}
                  onBack={() => setView("list")}
                  onEdit={() => setView("edit")}
                  onDelete={deletePatient}
                  deleting={deleting}
                />
              )}
            </div>
          </article>
          <article className="workspace-card">
            <div className="card-heading"><div><p className="eyebrow">Access</p><h2>Role boundary</h2></div></div>
            <dl className="access-list"><div><dt>Clinic</dt><dd>{user.clinic.name}</dd></div><div><dt>Role</dt><dd>{doctor ? "Doctor" : "Assistant"}</dd></div><div><dt>Patient access</dt><dd>Create, view, edit, delete</dd></div><div><dt>Administrator</dt><dd>{user.is_clinic_admin ? "Yes" : "No"}</dd></div></dl>
          </article>
          <article className="workspace-card">
            <div className="card-heading"><div><p className="eyebrow">Account</p><h2>Individual access</h2></div></div>
            <p className="card-copy">This workspace is protected by the individual staff account after clinic-level sign in.</p>
            <button className="secondary-button" type="button" onClick={onLeaveClinic}>Leave clinic completely</button>
          </article>
        </section>
      </main>
    </div>
  );
}
