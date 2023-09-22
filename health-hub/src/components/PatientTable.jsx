import React, { useState } from "react";
import DeletePatient from "./patients/deletePatient"; // Import the DeletePatient component

const PatientTable = ({ patient }) => {
  const [getPatients, setPatients] = useState([]);

  const onDelete = (deletedPatientID) => {
    // Handle the deletion in your local state or perform any necessary actions
    // For example, you can update the patient list after deletion
    const updatedPatients = getPatients.filter(
      (patient) => patient.id !== deletedPatientID
    );
    setPatients(updatedPatients);
  };

  return (
    <div>
      <table className="table table-hover border rounded">
        <thead>
          <tr>
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
            <tr key={p.id}>
              <th scope="row">{p.id}</th>
              <td>{p.name}</td>
              <td>{p.idNumber}</td>
              <td>{p.phone}</td>
              <td>{p.appointmentDate}</td>
              <td>
                <DeletePatient patient={patient} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientTable;
