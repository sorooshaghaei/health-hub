import { formatDate, formatPatientPhone } from "./patientForm.jsx";

export default function PatientList({
  patients,
  search,
  onSearchChange,
  onClear,
  onAdd,
  onOpen,
  loading,
  canCreate,
}) {
  return (
    <>
      <div className="patient-toolbar">
        <div className="patient-search patient-search--live">
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search name, phone, or date of birth"
            aria-label="Search patients"
          />
          {loading && <span className="patient-search__status">Searching…</span>}
          {search && <button type="button" className="text-button" onClick={onClear}>Clear</button>}
        </div>
        {canCreate && (
          <button className="primary-button primary-button--compact" type="button" onClick={onAdd}>+ Add patient</button>
        )}
      </div>
      {loading && !patients.length ? (
        <div className="patient-loading"><div className="loader" aria-label="Loading patients" /></div>
      ) : patients.length ? (
        <div className="patient-list">
          {patients.map((patient) => (
            <button className="patient-row" type="button" key={patient.id} onClick={() => onOpen(patient.id)}>
              <span className="patient-avatar" aria-hidden="true">{patient.full_name.slice(0, 1).toUpperCase()}</span>
              <span className="patient-row__identity">
                <strong>{patient.full_name}</strong>
                <small>{patient.gender} · {formatPatientPhone(patient)}</small>
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
              : canCreate
                ? "Create the first reusable Patient profile for this clinic."
                : "No Patient profiles are available to view."}
          </span>
          {!search && canCreate && <button className="secondary-button" type="button" onClick={onAdd}>Add first patient</button>}
        </div>
      )}
    </>
  );
}
