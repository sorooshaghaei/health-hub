import { useState } from "react";
import AccountSettings from "./AccountSettings.jsx";
import ClinicTeam from "./ClinicTeam.jsx";
import PatientDetail from "./PatientDetail.jsx";
import PatientList from "./PatientList.jsx";
import PrivateSticky from "./PrivateSticky.jsx";
import ScheduleWorkspace from "./ScheduleWorkspace.jsx";
import TaskWorkspace from "./TaskWorkspace.jsx";
import TrustedDevices from "./TrustedDevices.jsx";
import UndoStack from "./UndoStack.jsx";
import { PatientProfileForm } from "./patientForm.jsx";
import { Brand, ErrorMessage } from "./ui.jsx";

export default function PatientWorkspaceView({ user, staffToken, onSignOut, onSwitchClinic, onSwitchWorkspace, onUserChange, onAccountDeleted, controller: c }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const { doctorAccount, doctorWorkspace, assistantWorkspace, canEditPatient, canCreateDeletePatients: canCreate, canManageAppointments: canManage, section, setSection, patients, search, setSearch, patientView, setPatientView, selectedPatient, setSelectedPatient, patientVisits, requestedVisitId, loading, visitsLoading, error, deleting, undoActions, undoingId, scheduleRefreshVersion, taskRefreshVersion, taskAttention, openPatient, savePatient, registerUndo, expireUndo, undoAction, deletePatient, deleteVisit, editVisit, requestedHandled, clearSearch, loadPatientVisits } = c;
  const eyebrow = section === "schedule" ? "Appointments and live queue" : section === "tasks" ? "Shared tasks" : "Patient records";
  const workspace = doctorWorkspace ? "Doctor workspace" : "Assistant workspace";
  const intro = doctorWorkspace ? "Follow the queue, prepare the room, update Patient records, and manage tasks." : doctorAccount ? "Manage Assistant-side appointments, queue handoff, Patient records, and tasks." : "Manage appointments, check-in, queue handoff, Patient records, and tasks.";
  const accountLabel = doctorAccount ? assistantWorkspace ? "Doctor · Administrator access" : "Doctor · Administrator" : "Assistant";
  return <div className="workspace">
    <header className="workspace-header">
      <Brand compact />
      <div className="workspace-header__context"><strong>{user.clinic.name}</strong><span>{workspace}</span></div>
      <div className="workspace-header__actions">
        {doctorAccount && <button className="workspace-switch-button" type="button" aria-label={assistantWorkspace ? "Return to Doctor workspace" : "Open Assistant workspace"} onClick={onSwitchWorkspace}><span className="workspace-switch-button__full">{assistantWorkspace ? "Return to Doctor workspace" : "Assistant workspace"}</span><span className="workspace-switch-button__compact" aria-hidden="true">{assistantWorkspace ? "Doctor" : "Assistant"}</span></button>}
        <div className="workspace-account-menu">
        <button className="workspace-menu-trigger" type="button" aria-controls="workspace-account-actions" aria-expanded={accountMenuOpen} onClick={() => setAccountMenuOpen((open) => !open)}>
          <span className="workspace-menu-trigger__label">Account</span><span aria-hidden="true">⋮</span>
        </button>
        <div className="workspace-account-menu__panel" id="workspace-account-actions" hidden={!accountMenuOpen}>
          <div className="workspace-account-menu__identity"><strong>{user.display_name}</strong><span>{accountLabel}</span><small>{user.clinic.name}</small></div>
          <button type="button" onClick={() => { setAccountMenuOpen(false); onSwitchClinic(); }}>Clinics</button>
          <AccountSettings user={user} staffToken={staffToken} onOpen={() => setAccountMenuOpen(false)} onUserChange={onUserChange} onAccountDeleted={onAccountDeleted}/>
          <ClinicTeam user={user} staffToken={staffToken} onOpen={() => setAccountMenuOpen(false)}/>
          <TrustedDevices staffToken={staffToken} onOpen={() => setAccountMenuOpen(false)}/>
          <button type="button" onClick={() => { setAccountMenuOpen(false); onSignOut(); }}>Sign out</button>
        </div>
        </div>
      </div>
    </header>
    <main className="workspace-main">
      {doctorAccount && assistantWorkspace && <aside className="administrator-banner"><strong>Viewing Assistant workspace as Doctor administrator</strong><button type="button" onClick={onSwitchWorkspace}>Return to Doctor workspace</button></aside>}
      <section className="workspace-title"><div><p className="eyebrow">{eyebrow}</p><h1>{workspace}</h1><p>{intro}</p></div></section>
      <nav className="workspace-tabs" aria-label="Workspace sections"><button className={`workspace-tab${section === "schedule" ? " workspace-tab--active" : ""}`} type="button" onClick={() => setSection("schedule")}>{doctorWorkspace ? "Consultations & queue" : "Schedule & queue"}</button><button className={`workspace-tab${section === "patients" ? " workspace-tab--active" : ""}`} type="button" onClick={() => setSection("patients")}>Patients</button><button className={`workspace-tab${section === "tasks" ? " workspace-tab--active" : ""}`} type="button" onClick={() => setSection("tasks")}>Tasks{taskAttention && <span className="task-attention-dot" aria-label={doctorAccount ? "Completed task activity" : "New task activity"} />}</button></nav>
      <ErrorMessage error={error} />
      {section === "schedule" && <ScheduleWorkspace staffToken={staffToken} requestedVisitId={requestedVisitId} onRequestedVisitHandled={requestedHandled} onRegisterUndo={registerUndo} onOpenPatient={openPatient} refreshVersion={scheduleRefreshVersion} readOnly={!canManage} onVisitChanged={() => selectedPatient && loadPatientVisits(selectedPatient.id)} />}
      {section === "patients" && <section className="workspace-grid workspace-grid--single"><article className="workspace-card workspace-card--wide workspace-card--patients"><div className="card-heading"><div><p className="eyebrow">Clinic records</p><h2>Patients</h2></div><span className="count-badge">{patients.length}</span></div><div className="patient-content">{patientView === "list" && <PatientList patients={patients} search={search} onSearchChange={setSearch} onClear={clearSearch} onAdd={() => { setSelectedPatient(null); setPatientView("create"); }} onOpen={openPatient} loading={loading} canCreate={canCreate} />}{canCreate && patientView === "create" && <PatientProfileForm onSave={savePatient} onCancel={() => setPatientView("list")} onUseExisting={openPatient} />}{canEditPatient && patientView === "edit" && selectedPatient && <PatientProfileForm patient={selectedPatient} onSave={savePatient} onCancel={() => setPatientView("detail")} onUseExisting={openPatient} />}{patientView === "detail" && selectedPatient && <PatientDetail patient={selectedPatient} visits={patientVisits} visitsLoading={visitsLoading} onBack={() => setPatientView("list")} onEdit={() => setPatientView("edit")} onDelete={deletePatient} onEditVisit={editVisit} onDeleteVisit={deleteVisit} deleting={deleting} canEditPatient={canEditPatient} canDeletePatient={canCreate} canManageAppointments={canManage} />}</div></article></section>}
      {section === "tasks" && <TaskWorkspace user={user} staffToken={staffToken} doctorAccount={doctorAccount} onRegisterUndo={registerUndo} onOpenPatient={openPatient} refreshVersion={taskRefreshVersion} />}
    </main>{user.role === user.workspace_role && <PrivateSticky staffToken={staffToken} />}<UndoStack actions={undoActions} undoingId={undoingId} onUndo={undoAction} onExpire={expireUndo} />
  </div>;
}
