import React from "react";
import Spinner from "../components/Spinner";
import Patient from "../components/patients/Patient";
import { LightTeal } from "../helpers/colors";
import { Link } from "react-router-dom";
import PatientTable from "../components/PatientTable";

const Patients = ({ patient, loading, confirmDelete }) => {
  return (
    <div>
      <div className="mx-3 mt-3">
        <Link
          to={"/Patients/addPatient"}
          className="btn text-white"
          style={{ backgroundColor: LightTeal }}
        >
          <i className="fa fa-plus"></i> Add Patient
        </Link>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="row">
          <div className="col m-5">
            <div>
              {patient.length > 0 ? (
                <PatientTable
                  patient={patient}
                  confirmDelete={() => {
                    confirmDelete(patient.id, patient.name);
                  }}
                />
              ) : (
                <p>No patient data available</p>
              )}
            </div>
          </div>
          <div className="col">
            <div className=" m-5">
              {patient.length > 0 ? (
                patient.map((p) => (
                  <div
                    className="col d-flex justify-content-center align-items-center"
                    key={p.id}
                  >
                    <Patient patient={p} />
                  </div>
                ))
              ) : (
                <div className="text-center mt-5">
                  <p className="h3">not found!</p>
                  {/* <img src={notfound} alt="not found!" className="w-25" /> */}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Patients;
