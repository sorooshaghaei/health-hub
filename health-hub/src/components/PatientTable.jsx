import React from "react";
// import { LightRed } from "../helpers/colors";

const PatientTable = ({ patient}) => {
  return (
    <div>
      <table className="table table-hover border rounded">
        <thead>
          <tr>
            <th scope="col">ID</th>
            <th scope="col">Name</th>
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
              <td>{p.phone}</td>
              <td>{p.appointmentDate}</td>
              <td>
                {/* <button
                  onClick={confirmDelete}
                  type="delete"
                  className="btn text-white"
                  style={{ backgroundColor: LightRed }}
                >
                  <i className="fa fa-trash"></i>
                </button> */}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PatientTable;
