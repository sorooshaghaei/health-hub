import React, { useState } from "react";
import DeletePatient from "./patients/deletePatient"; // Import the DeletePatient component
import { VeryLightPink } from "../helpers/colors";

const PatientTable = ({ patient, onPatientSelect }) => {
  const [selectedPatient, setSelectedPatient] = useState(null); // Track selected patient

  const handlePatientSelect = (p) => {
    if (selectedPatient === p) {
      setSelectedPatient(null); // Deselect patient if clicked again
    } else {
      setSelectedPatient(p); // Update selected patient state
    }
    onPatientSelect(p); // Notify parent component of selection
  };

  const onDelete = (deletedPatientID) => {
    // Handle deletion in local state or perform necessary actions
    // Update patient list after deletion
    const updatedPatients = patient.filter((p) => p.id !== deletedPatientID);
    // Update parent component with updated patient list
    onPatientSelect(null); // Deselect patient when deleted
  };

  return (
    <div style={{ backgroundColor: VeryLightPink, borderRadius: 10 }}>
      <table className="table table-hover table-borderless shadow responsive">
        <thead>
          <tr>
            <th scope="col">
              <input
                type="radio"
                checked={selectedPatient !== null}
                className="form-check-input"
                disabled
              />
            </th>
            <th scope="col">ID</th>
            <th scope="col">Name</th>
            <th scope="col">ID NUMBER</th>
            <th scope="col">Phone</th>
            <th scope="col">Appointment Date</th>
            <th scope="col">Handle</th>
          </tr>
        </thead>

        <tbody>
          {patient.map((p) => (
            <tr key={p.id} onClick={() => handlePatientSelect(p)}>
              <th scope="row">
                <input
                  type="radio"
                  checked={p.id === selectedPatient?.id} // Check if patient is selected
                  onChange={() => handlePatientSelect(p)} // Update selection on checkbox change
                  className="form-check-input"
                />
              </th>
              <td>{p.id}</td>
              <td>{p.name}</td>
              <td>{p.idNumber}</td>
              <td>{p.phone}</td>
              <td>{p.appointmentDate}</td>
              <td>
                <div className="m-2">
                  <DeletePatient patient={p} onDelete={onDelete} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientTable;
