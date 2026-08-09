import { useState } from "react";

import { formatDate, formatPatientPhone, formatTime } from "./patientForm.jsx";

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

function VisitHistoryRow({ visit, canManageAppointments, onEdit, onDelete }) {
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
      {canManageAppointments ? (
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

export default function PatientDetail({
  patient,
  visits,
  visitsLoading,
  onBack,
  onEdit,
  onDelete,
  onEditVisit,
  onDeleteVisit,
  deleting,
  canEditPatient,
  canDeletePatient,
  canManageAppointments,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="patient-detail">
      <div className="patient-detail__topbar">
        <button className="back-button back-button--inline" type="button" onClick={onBack}>← Patients</button>
        <div className="patient-detail__actions">
          {canEditPatient && <button className="secondary-button" type="button" onClick={onEdit}>Edit profile</button>}
          {canDeletePatient && <button className="danger-button" type="button" onClick={() => setConfirmDelete(true)}>Delete profile</button>}
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
      <dl className="patient-facts patient-facts--compact">
        <div className="patient-phone-fact">
          <dt>Phone</dt>
          <dd>{formatPatientPhone(patient)}</dd>
        </div>
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
              canManageAppointments={canManageAppointments}
              key={visit.id}
              onEdit={onEditVisit}
              onDelete={onDeleteVisit}
            />
          ))
        ) : (
          <p className="schedule-empty">No appointments have been recorded for this Patient.</p>
        )}
      </section>

      {canDeletePatient && confirmDelete && (
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
