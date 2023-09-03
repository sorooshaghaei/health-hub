import React from "react";
import { LightRed, Teal, VeryLightPink } from "../../helpers/colors";
import Spinner from "../Spinner";

const ViewPatient = ({ loading }) => {
  return (
    <>
      {loading ? (
        <Spinner />
      ) : (
        <>
          <section className="m-5">
            <div
              className="card border-0 m-3 col-6"
              style={{
                backgroundColor: VeryLightPink,
                textAlign: "left",
              }}
            >
              <div>
                <form className="p-5">
                  <div className="form-group">Full Name: </div>
                  <div className="form-group">Type Of Sickness: </div>
                  <div className="form-group">Date: </div>
                  <div className="form-group">Time: </div>
                  <div className="form-group">Urgency: </div>
                  <div className="form-group">Phone Number: </div>

                  <button
                    type="submit"
                    className="btn mt-3 text-white"
                    style={{ backgroundColor: Teal }}
                  >
                    save changes
                  </button>
                  <button
                    to={"/Patients"}
                    type="delete"
                    className="btn mt-3 mx-2 text-white"
                    style={{ backgroundColor: LightRed }}
                  >
                    delete patient
                  </button>
                </form>
              </div>
            </div>
          </section>
        </>
      )}
    </>
  );
};
export default ViewPatient;
