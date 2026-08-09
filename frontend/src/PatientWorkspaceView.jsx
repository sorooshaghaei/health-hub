import PatientDetail from "./PatientDetail.jsx";
import PatientList from "./PatientList.jsx";
import ScheduleWorkspace from "./ScheduleWorkspace.jsx";
import UndoStack from "./UndoStack.jsx";
import { PatientProfileForm } from "./patientForm.jsx";
import { Brand, ErrorMessage } from "./ui.jsx";

export default function PatientWorkspaceView({ user, staffToken, onSignOut, onLeaveClinic, controller }) {
  const {
    doctorAccount, doctorWorkspace, assistantWorkspace, canEditPatient,
    canCreateDeletePatients, canManageAppointments, section, setSection, patients,
    search, setSearch, patientView, setPatientView, selectedPatient, setSelectedPatient,
    patientVisits, requestedVisitId, loading, visitsLoading, error, deleting,
    undoActions, undoingId, scheduleRefreshVersion, openPatient, savePatient,
    registerUndo, expireUndo, undoAction, deletePatient, deleteVisit, editVisit,
    requestedHandled, clearSearch, loadPatientVisits,
  } = controller;

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
                ? assistantWorkspace
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
                ? "Use Room ready, follow the live queue, and keep Patient information up to date."
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
            readOnly={!canManageAppointments}
            onVisitChanged={() => {
              if (selectedPatient) loadPatientVisits(selectedPatient.id);
            }}
          />
        )}

        {section === "patients" && (
          <section className="workspace-grid workspace-grid--single">
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
                    onClear={clearSearch}
                    onAdd={() => { setSelectedPatient(null); setPatientView("create"); }}
                    onOpen={openPatient}
                    loading={loading}
                    canCreate={canCreateDeletePatients}
                  />
                )}
                {canCreateDeletePatients && patientView === "create" && (
                  <PatientProfileForm onSave={savePatient} onCancel={() => setPatientView("list")} onUseExisting={openPatient} />
                )}
                {canEditPatient && patientView === "edit" && selectedPatient && (
                  <PatientProfileForm patient={selectedPatient} onSave={savePatient} onCancel={() => setPatientView("detail")} onUseExisting={openPatient} />
                )}
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
                    canEditPatient={canEditPatient}
                    canDeletePatient={canCreateDeletePatients}
                    canManageAppointments={canManageAppointments}
                  />
                )}
              </div>
              <div className="clinic-exit">
                <div>
                  <strong>Leave this clinic on this device</strong>
                  <span>Removes the saved clinic access from this browser. It does not delete clinic data or staff accounts.</span>
                </div>
                <button className="secondary-button" type="button" onClick={onLeaveClinic}>Leave clinic completely</button>
              </div>
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
