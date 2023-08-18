import React from "react";
import { LightRed, LightTeal, Teal, VeryLightPink } from "../../helpers/colors";
import nurse_save_patient_info from "../../assets/nurse_save_patient_info.svg";

const AddPatient = () => {
  return (
    <>
    
      <section className="m-5">
      <p
                    className="h4 fw-bold text-center mb-5"
                    style={{color:LightTeal}}
                  >
                   Add a new patient
                  </p>
        <div className="row">
        
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
                  <label htmlFor="exampleInputFullName">Full name</label>
                  <input
                    type="text"
                    className="form-control"
                    id="exampleInputFullName"
                    aria-describedby="FullNameHelp"
                    placeholder="Enter Full Name"
                  />
                </div>

                <button
                  type="submit"
                  className="btn mt-3"
                  style={{ backgroundColor: Teal }}
                >
                  Submit
                </button>
                <button
                  type="discard"
                  className="btn mt-3 mx-2"
                  style={{ backgroundColor: LightRed }}
                >
                  discard
                </button>
              </form>
            </div>
          </div>
          <img
            alt="nurse_save_patient_info"
            src={nurse_save_patient_info}
            className="col-5"
            style={{
              opacity: "50%",
            }}
          />
        </div>
      </section>
    </>
  );
};

export default AddPatient;
