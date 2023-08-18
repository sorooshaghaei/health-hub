import React from "react";
import Spinner from "../components/Spinner";
import Patient from "../components/patients/Patient";
import { LightTeal } from "../helpers/colors";
import { Link } from "react-router-dom";

const Patients = ({ patient, loading }) => {
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
        <div className="row mx-4">
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
      )}
    </div>
  );
};

export default Patients;
