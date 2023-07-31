import React from "react";
import { Navbar } from "../components";
import Spinner from "../components/Spinner";
import Patient from "../components/Patient";
import { LightTeal } from "../helpers/colors";

const Patients = ({ patient, loading }) => {
  return (
    <div>
      <Navbar />

      <div className="mx-3 mt-3">
        <button
          type="button"
          className="btn text-white"
          style={{ backgroundColor: LightTeal }}
        >
          <i className="fa fa-plus"></i> Add Patient
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <div className="row mx-4">
          {patient.length > 0 ? (
            patient.map((p) => (
              <div className="col d-flex justify-content-center align-items-center" key={p.id}>
                <Patient patient={p}  />
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
