import { useCallback, useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import ScheduleWorkspace from "./ScheduleWorkspace.jsx";
import {
  PatientProfileForm,
  formatDate,
  formatTime,
} from "./patientForm.jsx";
import { Brand, ErrorMessage } from "./ui.jsx";

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

function VisitHistoryRow({ visit, onEdit, onRemove }) {
  return (
    <div className="history-row">
      <div>
        <strong>{formatDate(visit.date)}</strong>
        <small>{visit.visit_type === "appointment" ? formatTime(visit.scheduled_time) : "Walk-in"}</small>
      </div>
      <div>
        <strong>{visit.visit_type === "appointment" ? "Appointment" : "Walk-in"}</strong>
        <small>{visit.reason || "No reason recorded"}</small>
      </div>
      <div className="history-row__actions">
        <button className="secondary-button" type="button" onClick={() => onEdit(visit.id)}>Edit</button>
        {visit.can_delete && <button className="danger-button" type="button" onClick={() => onRemove(visit)}>Remove</button>}
      </div>
    </div>
  );
}

function PatientDetail({
  patient,
  visits,
  visitsLoading,
  onBack,
  onEdit,
  onDelete,
  onEditVisit,
  onRemoveVisit,
  deleting,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="patient-detail">
      <div className="patient-detail__topbar">
        <button className="back-button back-button--inline" type="button" onClick={onBack}>← Patients</button>
        <div className="patient-detail__actions">
          <button className="secondary-button" type="button" onClick={onEdit}>Edit profile</button>
          <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}>Delete profile</button>
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

      <section className="patient-history">
        <div className="schedule-section__heading">
          <div>
            <p className="eyebrow">Visit history</p>
            <h3>Past and future Visits</h3>
          </div>
          <span>{visits.length}</span>
        </div>
        {visitsLoading ? (
          <div className="patient-loading patient-loading--small"><div className="loader" aria-label="Loading visit history" /></div>
        ) : visits.length ? (
          visits.map((visit) => (
            <VisitHistoryRow
              visit={visit}
              key={visit.id}
              onEdit={onEditVisit}
              onRemove={onRemoveVisit}
            />
          ))
        ) : (
          <p className="schedule-empty">No Visits have been recorded for this Patient.</p>
        )}
      </section>

      {confirmDelete && (
        <div className="delete-confirmation" role="alertdialog" aria-modal="true" aria-label="Delete patient">
          <strong>Delete this active Patient profile?</strong>
          <p>Future Visits must be removed first. Past Visits remain as historical records after deletion.</p>
          <div className="form-actions">
            <button className="secondary-button" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="danger-button" type="button" disabled={deleting} onClick={onDelete}>{deleting ? "Deleting…" : "Delete Patient"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Workspace({ user, staffToken, onSignOut, onLeaveClinic }) {
  const doctor = user.role === "doctor";
  const [section, setSection] = useState(doctor ? "patients" : "schedule");
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [patientView, setPatientView] = useState("list");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientVisits, setPatientVisits] = useState([]);
  const [requestedVisitId, setRequestedVisitId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visitsLoading, setVisitsLoading] = useState(false);
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

  async function loadPatientVisits(patientId) {
    setVisitsLoading(true);
    try {
      const payload = await apiRequest(`/api/visits/?patient=${encodeURIComponent(patientId)}`, { staffToken });
      setPatientVisits(payload.visits);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Visit history could not be loaded."));
    } finally {
      setVisitsLoading(false);
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
      setPatientView("detail");
      await loadPatientVisits(patientId);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be opened."));
    }
  }

  async function savePatient(data) {
    const editing = patientView === "edit" && selectedPatient;
    const patient = await apiRequest(editing ? `/api/patients/${selectedPatient.id}/` : "/api/patients/", {
      method: editing ? "PATCH" : "POST",
      data,
      staffToken,
    });
    setSelectedPatient(patient);
    setPatientView("detail");
    await Promise.all([loadPatients(search), loadPatientVisits(patient.id)]);
  }

  async function deletePatient() {
    if (!selectedPatient) return;
    setDeleting(true);
    setError(null);
    try {
      await apiRequest(`/api/patients/${selectedPatient.id}/`, { method: "DELETE", staffToken });
      setSelectedPatient(null);
      setPatientVisits([]);
      setPatientView("list");
      await loadPatients(search);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be deleted."));
    } finally {
      setDeleting(false);
    }
  }

  async function removeVisit(visit) {
    if (!globalThis.confirm("Remove this future Visit?")) return;
    setError(null);
    try {
      await apiRequest(`/api/visits/${visit.id}/`, { method: "DELETE", staffToken });
      if (selectedPatient) await loadPatientVisits(selectedPatient.id);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Visit could not be removed."));
    }
  }

  function editVisit(visitId) {
    setRequestedVisitId(visitId);
    setSection("schedule");
  }

  const requestedHandled = useCallback(() => setRequestedVisitId(null), []);

  function submitSearch(event) {
    event.preventDefault();
    setPatientView("list");
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
          <div>
            <p className="eyebrow">{section === "schedule" ? "Daily planning" : "Patient records"}</p>
            <h1>{doctor ? "Doctor workspace" : "Assistant workspace"}</h1>
            <p>
              {doctor
                ? "Patient records remain the primary Doctor view. Appointment administration is available when needed."
                : "Manage the clinic schedule, walk-ins, and reusable Patient profiles from one workspace."}
            </p>
          </div>
          <div className="status-pill"><span /> Clinic access active</div>
        </section>

        <nav className="workspace-tabs" aria-label="Workspace sections">
          <button className={section === "schedule" ? "workspace-tab workspace-tab--active" : "workspace-tab"} type="button" onClick={() => setSection("schedule")}>
            {doctor ? "Appointments" : "Schedule"}
          </button>
          <button className={section === "patients" ? "workspace-tab workspace-tab--active" : "workspace-tab"} type="button" onClick={() => setSection("patients")}>
            Patients
          </button>
        </nav>

        <ErrorMessage error={error} />

        {section === "schedule" && (
          <ScheduleWorkspace
            staffToken={staffToken}
            requestedVisitId={requestedVisitId}
            onRequestedVisitHandled={requestedHandled}
            onVisitChanged={() => {
              if (selectedPatient) loadPatientVisits(selectedPatient.id);
            }}
          />
        )}

        {section === "patients" && (
          <section className="workspace-grid">
            <article className="workspace-card workspace-card--wide workspace-card--patients">
              <div className="card-heading">
                <div><p className="eyebrow">Clinic records</p><h2>Patients</h2></div>
                <span className="count-badge">{patients.length}</span>
              </div>
              <div className="patient-content">
                {patientView === "list" && (
                  <PatientList
                    patients={patients}
                    search={search}
                    onSearchChange={setSearch}
                    onSearch={submitSearch}
                    onClear={clearSearch}
                    onAdd={() => { setSelectedPatient(null); setPatientView("create"); }}
                    onOpen={openPatient}
                    loading={loading}
                  />
                )}
                {patientView === "create" && <PatientProfileForm onSave={savePatient} onCancel={() => setPatientView("list")} onUseExisting={openPatient} />}
                {patientView === "edit" && selectedPatient && <PatientProfileForm patient={selectedPatient} onSave={savePatient} onCancel={() => setPatientView("detail")} onUseExisting={openPatient} />}
                {patientView === "detail" && selectedPatient && (
                  <PatientDetail
                    patient={selectedPatient}
                    visits={patientVisits}
                    visitsLoading={visitsLoading}
                    onBack={() => setPatientView("list")}
                    onEdit={() => setPatientView("edit")}
                    onDelete={deletePatient}
                    onEditVisit={editVisit}
                    onRemoveVisit={removeVisit}
                    deleting={deleting}
                  />
                )}
              </div>
            </article>
            <article className="workspace-card">
              <div className="card-heading"><div><p className="eyebrow">Access</p><h2>Role boundary</h2></div></div>
              <dl className="access-list">
                <div><dt>Clinic</dt><dd>{user.clinic.name}</dd></div>
                <div><dt>Role</dt><dd>{doctor ? "Doctor" : "Assistant"}</dd></div>
                <div><dt>Patient access</dt><dd>Create, view, edit, delete</dd></div>
                <div><dt>Visit access</dt><dd>Create, view, edit, remove future</dd></div>
                <div><dt>Administrator</dt><dd>{user.is_clinic_admin ? "Yes" : "No"}</dd></div>
              </dl>
            </article>
            <article className="workspace-card">
              <div className="card-heading"><div><p className="eyebrow">Account</p><h2>Individual access</h2></div></div>
              <p className="card-copy">This workspace is protected by the individual staff account after clinic-level sign in.</p>
              <button className="secondary-button" type="button" onClick={onLeaveClinic}>Leave clinic completely</button>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}
