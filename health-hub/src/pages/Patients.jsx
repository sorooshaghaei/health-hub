import React, { useState } from "react";
import Spinner from "../components/Spinner";
import Patient from "../components/patients/Patient";
import { LightTeal } from "../helpers/colors";
import { Link } from "react-router-dom";
import PatientTable from "../components/PatientTable";

const Patients = ({ patient, loading }) => {
  const [selectedPatient, setSelectedPatient] = useState(null);

  const handlePatientSelect = (patient) => {
    setSelectedPatient(patient);
  };

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
        <div className="container-fluid p-5">
          <div className="row">
            <div className="col-lg-8 col-md-12">
              <div>
                {patient.length > 0 ? (
                  <PatientTable
                    patient={patient}
                    onPatientSelect={handlePatientSelect}
                  />
                ) : (
                  <p>No patient data available</p>
                )}
              </div>
            </div>
            <div className="col-lg-4 col-md-12 mt-3">
              {selectedPatient ? (
                <Patient patient={selectedPatient} />
              ) : (
                <div
                  className="border rounded-3"
                  style={{ height: "19rem", width: "18rem" }}
                >
                  <div className="text-center my-5">
                    <p className="h4">Select a patient from the table</p>
                  </div>
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
