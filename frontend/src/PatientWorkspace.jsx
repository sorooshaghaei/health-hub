import { useCallback, useEffect, useState } from "react";

import { ApiError, apiRequest } from "./api.js";
import ScheduleWorkspace from "./ScheduleWorkspace.jsx";
import UndoStack from "./UndoStack.jsx";
import {
  PatientProfileForm,
  formatDate,
  formatTime,
} from "./patientForm.jsx";
import { Brand, ErrorMessage } from "./ui.jsx";

const STATUS_LABELS = {
  planned: "Planned",
  checked_in: "Checked in",
  with_doctor: "With doctor",
  doctor_finished: "Doctor finished",
};

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

function PatientList({
  patients,
  search,
  onSearchChange,
  onSearch,
  onClear,
  onAdd,
  onOpen,
  loading,
  canManage,
}) {
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
        {canManage && (
          <button className="primary-button primary-button--compact" type="button" onClick={onAdd}>+ Add patient</button>
        )}
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
          <span>
            {search
              ? "Try a different name, phone number, or date of birth."
              : canManage
                ? "Create the first reusable Patient profile for this clinic."
                : "No Patient profiles are available to view."}
          </span>
          {!search && canManage && <button className="secondary-button" type="button" onClick={onAdd}>Add first patient</button>}
        </div>
      )}
    </>
  );
}

function VisitHistoryRow({ visit, canManage, onEdit, onDelete }) {
  return (
    <div className="history-row">
      <div>
        <strong>{formatDate(visit.date)}</strong>
        <small>{formatTime(visit.scheduled_time)}</small>
      </div>
      <div>
        <strong>{statusLabel(visit.status)}</strong>
        <small>
          {visit.checked_in_at ? `${formatCheckInTime(visit.checked_in_at)} · ` : ""}
          {visit.reason || "No reason recorded"}
        </small>
      </div>
      {canManage ? (
        <div className="history-row__actions">
          <span className={`status-chip status-chip--${visit.status}`}>
            {statusLabel(visit.status)}
          </span>
          <button className="secondary-button" type="button" onClick={() => onEdit(visit.id)}>Edit</button>
          {visit.can_delete && <button className="danger-button" type="button" onClick={() => onDelete(visit)}>Delete</button>}
        </div>
      ) : (
        <span className={`status-chip status-chip--${visit.status}`}>
          {statusLabel(visit.status)}
        </span>
      )}
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
  onDeleteVisit,
  deleting,
  canManage,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="patient-detail">
      <div className="patient-detail__topbar">
        <button className="back-button back-button--inline" type="button" onClick={onBack}>← Patients</button>
        {canManage && (
          <div className="patient-detail__actions">
            <button className="secondary-button" type="button" onClick={onEdit}>Edit profile</button>
            <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}>Delete profile</button>
          </div>
        )}
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
            <p className="eyebrow">Appointment history</p>
            <h3>Past and future appointments</h3>
          </div>
          <span>{visits.length}</span>
        </div>
        {visitsLoading ? (
          <div className="patient-loading patient-loading--small"><div className="loader" aria-label="Loading appointment history" /></div>
        ) : visits.length ? (
          visits.map((visit) => (
            <VisitHistoryRow
              visit={visit}
              canManage={canManage}
              key={visit.id}
              onEdit={onEditVisit}
              onDelete={onDeleteVisit}
            />
          ))
        ) : (
          <p className="schedule-empty">No appointments have been recorded for this Patient.</p>
        )}
      </section>

      {canManage && confirmDelete && (
        <div className="delete-confirmation" role="alertdialog" aria-modal="true" aria-label="Delete patient">
          <strong>Delete this active Patient profile?</strong>
          <p>Current and future appointments must be deleted first. Past appointments remain historical.</p>
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
  const doctorAccount = user.role === "doctor";
  const doctorWorkspace = user.workspace_role === "doctor";
  const canManage = user.workspace_role === "assistant";
  const [section, setSection] = useState(doctorWorkspace ? "patients" : "schedule");
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
  const [undoActions, setUndoActions] = useState([]);
  const [undoingId, setUndoingId] = useState(null);
  const [scheduleRefreshVersion, setScheduleRefreshVersion] = useState(0);

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
      setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment history could not be loaded."));
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
      setSection("patients");
      await loadPatientVisits(patientId);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Patient could not be opened."));
    }
  }

  async function savePatient(data) {
    if (!canManage) return;
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

  const registerUndo = useCallback((action) => {
    setUndoActions((current) => [...current.filter((item) => item.id !== action.id), action]);
  }, []);

  const expireUndo = useCallback((actionId) => {
    setUndoActions((current) => current.filter((item) => item.id !== actionId));
  }, []);

  async function undoAction(action) {
    setUndoingId(action.id);
    setError(null);
    let endpoint;
    if (action.kind === "check_in") {
      endpoint = `/api/visits/${action.resourceId}/undo-check-in/`;
    } else if (action.kind === "with_doctor") {
      endpoint = `/api/visits/${action.resourceId}/undo-with-doctor/`;
    } else if (action.kind === "room_ready") {
      endpoint = "/api/visits/room-ready/undo/";
    } else if (action.kind === "appointment_delete") {
      endpoint = `/api/visits/${action.resourceId}/undo-delete/`;
    } else {
      endpoint = `/api/patients/${action.resourceId}/undo-delete/`;
    }
    try {
      await apiRequest(endpoint, { method: "POST", staffToken });
      expireUndo(action.id);
      setScheduleRefreshVersion((value) => value + 1);
      await loadPatients(search);
      if (selectedPatient && action.kind !== "patient_delete") {
        await loadPatientVisits(selectedPatient.id);
      }
    } catch (requestError) {
      expireUndo(action.id);
      setError(requestError instanceof ApiError ? requestError : new ApiError("The action could not be undone."));
    } finally {
      setUndoingId(null);
    }
  }

  async function deletePatient() {
    if (!canManage || !selectedPatient) return;
    setDeleting(true);
    setError(null);
    try {
      const patientName = selectedPatient.full_name;
      const deleted = await apiRequest(`/api/patients/${selectedPatient.id}/`, { method: "DELETE", staffToken });
      registerUndo({
        id: `patient-delete:${selectedPatient.id}:${Date.now()}`,
        kind: "patient_delete",
        resourceId: selectedPatient.id,
        message: `${patientName} deleted.`,
        undoUntil: deleted.undo_until,
      });
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

  async function deleteVisit(visit) {
    if (!canManage) return;
    setError(null);
    try {
      const deleted = await apiRequest(`/api/visits/${visit.id}/`, { method: "DELETE", staffToken });
      registerUndo({
        id: `appointment-delete:${visit.id}:${Date.now()}`,
        kind: "appointment_delete",
        resourceId: visit.id,
        message: `${visit.patient.full_name}'s appointment deleted.`,
        undoUntil: deleted.undo_until,
      });
      setScheduleRefreshVersion((value) => value + 1);
      if (selectedPatient) await loadPatientVisits(selectedPatient.id);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError : new ApiError("Appointment could not be deleted."));
    }
  }

  function editVisit(visitId) {
    if (!canManage) return;
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
        <div className="workspace-header__clinic">
          <span>{user.clinic.name}</span>
          <strong>{doctorWorkspace ? "Doctor workspace" : "Assistant workspace"}</strong>
        </div>
        <div className="user-menu">
          <div>
            <strong>{user.display_name}</strong>
            <span>
              {doctorAccount
                ? canManage
                  ? "Doctor · Administrator access"
                  : "Doctor · Administrator"
                : "Assistant"}
            </span>
          </div>
          <button type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </header>
      <main className="workspace-main">
        <section className="workspace-title">
          <div>
            <p className="eyebrow">{section === "schedule" ? "Appointments and live queue" : "Patient records"}</p>
            <h1>{doctorWorkspace ? "Doctor workspace" : "Assistant workspace"}</h1>
            <p>
              {doctorWorkspace
                ? "View Patient records and signal when the consultation room is ready."
                : doctorAccount
                  ? "Manage Patients, appointments, check-in, the queue, and consultation handoff through Administrator access."
                  : "Manage Patients, appointments, check-in, the live queue, and consultation handoff from one workspace."}
            </p>
          </div>
          <div className="status-pill"><span /> Clinic access active</div>
        </section>

        <nav className="workspace-tabs" aria-label="Workspace sections">
          <button className={section === "schedule" ? "workspace-tab workspace-tab--active" : "workspace-tab"} type="button" onClick={() => setSection("schedule")}>
            {doctorWorkspace ? "Consultations & queue" : "Schedule & queue"}
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
            onRegisterUndo={registerUndo}
            onOpenPatient={openPatient}
            refreshVersion={scheduleRefreshVersion}
            readOnly={!canManage}
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
                    canManage={canManage}
                  />
                )}
                {canManage && patientView === "create" && <PatientProfileForm onSave={savePatient} onCancel={() => setPatientView("list")} onUseExisting={openPatient} />}
                {canManage && patientView === "edit" && selectedPatient && <PatientProfileForm patient={selectedPatient} onSave={savePatient} onCancel={() => setPatientView("detail")} onUseExisting={openPatient} />}
                {patientView === "detail" && selectedPatient && (
                  <PatientDetail
                    patient={selectedPatient}
                    visits={patientVisits}
                    visitsLoading={visitsLoading}
                    onBack={() => setPatientView("list")}
                    onEdit={() => setPatientView("edit")}
                    onDelete={deletePatient}
                    onEditVisit={editVisit}
                    onDeleteVisit={deleteVisit}
                    deleting={deleting}
                    canManage={canManage}
                  />
                )}
              </div>
            </article>
            <article className="workspace-card">
              <div className="card-heading"><div><p className="eyebrow">Access</p><h2>Role boundary</h2></div></div>
              <dl className="access-list">
                <div><dt>Clinic</dt><dd>{user.clinic.name}</dd></div>
                <div><dt>Account</dt><dd>{doctorAccount ? "Doctor" : "Assistant"}</dd></div>
                <div><dt>Workspace</dt><dd>{doctorWorkspace ? "Doctor" : "Assistant"}</dd></div>
                <div><dt>Patient access</dt><dd>{canManage ? "Create, view, edit, delete" : "View only"}</dd></div>
                <div><dt>Appointment access</dt><dd>{canManage ? "Manage and hand off" : "View and Room ready"}</dd></div>
                <div><dt>Live queue</dt><dd>View</dd></div>
                <div><dt>Administrator</dt><dd>{user.is_clinic_admin ? "Yes" : "No"}</dd></div>
              </dl>
            </article>
            <article className="workspace-card">
              <div className="card-heading"><div><p className="eyebrow">Account</p><h2>Individual access</h2></div></div>
              <p className="card-copy">
                {doctorWorkspace
                  ? "Administrative changes are deliberately kept out of the Doctor workspace."
                  : doctorAccount
                    ? "You entered the Assistant workspace with Doctor administrator credentials."
                    : "This workspace is protected by the Assistant account."}
              </p>
              <button className="secondary-button" type="button" onClick={onLeaveClinic}>Leave clinic completely</button>
            </article>
          </section>
        )}
      </main>
      <UndoStack
        actions={undoActions}
        undoingId={undoingId}
        onUndo={undoAction}
        onExpire={expireUndo}
      />
    </div>
  );
}
