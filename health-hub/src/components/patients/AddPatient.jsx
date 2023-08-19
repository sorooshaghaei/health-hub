import React from "react";
import { LightRed, LightTeal, Teal, VeryLightPink } from "../../helpers/colors";
import nurse_save_patient_info from "../../assets/nurse_save_patient_info.svg";
import { Link } from "react-router-dom";

const AddPatient = () => {
  return (
    <div>
      <section className="m-5">
        <img
          src={nurse_save_patient_info}
          style={{
            position: "absolute",
            zIndex: -1,
            height: "400px",
            top: "300px",
            right: "180px",
            opacity: "50%",
          }}
          alt="nurse_save_patient_info"
        />
        <p className="h4 fw-bold text-center mb-5" style={{ color: LightTeal }}>
          Add a new patient
        </p>

        <div
          className="card border-0 m-3 col-6"
          style={{
            backgroundColor: VeryLightPink,
            textAlign: "left",
          }}
        >
          <div>
            <form className="p-5">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  id="exampleInputFullName"
                  aria-describedby="FullNameHelp"
                  placeholder="Enter Full Name"
                />
              </div>
              <div className="form-group">
                <label htmlFor="appointmentDate" className="mt-3">
                  Pick a Date
                </label>
                <input
                  type="Date"
                  className="form-control"
                  id="appointmentDate"
                  aria-describedby="FullNameHelp"
                />
              </div>
              <div className="form-group">
                <label htmlFor="appointmentTime" className="mt-3">
                  Pick a Time
                </label>
                <input
                  type="time"
                  className="form-control"
                  id="appointmentTime"
                  aria-describedby="FullNameHelp"
                />
              </div>

              <label htmlFor="typeOfSickness" className="mt-3">
                Type Of Sickness
              </label>
              <select className="form-select" aria-label="Default">
                <option selected>default</option>
                <option value="1">butox</option>
                <option value="2">surgery</option>
                <option value="3">gel</option>
              </select>
              <label htmlFor="levelOfUrgency" className="mt-3">
                Level Of Urgency
              </label>
              <select className="form-select" aria-label="Default">
                <option selected>normal</option>
                <option value="1">urgent</option>
                <option value="2">low</option>
              </select>

              <button
                type="submit"
                className="btn mt-3"
                style={{ backgroundColor: Teal }}
              >
                Submit
              </button>
              <Link
                to={"/Patients"}
                type="discard"
                className="btn mt-3 mx-2"
                style={{ backgroundColor: LightRed }}
              >
                Discard
              </Link>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AddPatient;
