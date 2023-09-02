import React from "react";
import { LightRed, LightTeal, Teal, VeryLightPink } from "../../helpers/colors";
import nurse_save_patient_info from "../../assets/nurse_save_patient_info.svg";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";

const AddPatient = ({
  loading,
  patient,
  setPatientInfo,
  sicknesses,
  groups,
  createPatientForm,
}) => {
  return (
    <>
      {loading ? (
        <Spinner />
      ) : (
        <>
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
            <p
              className="h4 fw-bold text-center mb-5"
              style={{ color: LightTeal }}
            >
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
                <form onSubmit={createPatientForm} className="p-5">
                  <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input
                      name="name"
                      type="text"
                      className="form-control"
                      value={patient.name}
                      onChange={setPatientInfo}
                      placeholder="Enter Full Name"
                      required={true}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="appointmentDate" className="mt-3">
                      Pick a Date
                    </label>
                    <input
                      name="appointmentDate"
                      type="Date"
                      className="form-control"
                      value={patient.appointmentDate}
                      onChange={setPatientInfo}
                      required={true}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="appointmentTime" className="mt-3">
                      Pick a Time
                    </label>
                    <input
                      name="appointmentTime"
                      type="time"
                      className="form-control"
                      value={patient.appointmentTime}
                      onChange={setPatientInfo}
                    />
                  </div>

                  <label htmlFor="typeOfSickness" className="mt-3">
                    Type Of Sickness
                  </label>
                  <select
                    name="typeOfSickness"
                    className="form-select"
                    value={patient.typeOfSickness}
                    onChange={setPatientInfo}
                  >
                    {sicknesses.length > 0 &&
                      sicknesses.map((sickness) => (
                        <option key={sickness.id} value={sickness.id}>
                          {sickness.typeOfSickness}
                        </option>
                      ))}
                  </select>

                  <label htmlFor="levelOfUrgency" className="mt-3">
                    Level Of Urgency
                  </label>
                  <select
                    name="levelOfUrgency"
                    className="form-select"
                    value={patient.levelOfUrgency}
                    onChange={setPatientInfo}
                  >
                    {groups.length > 0 &&
                      groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.levelOfUrgency}
                        </option>
                      ))}
                  </select>

                  <label htmlFor="phoneNumber" className="mt-3">
                    Enter Phone Number
                  </label>
                  <input
                    name="phone"
                    type="phone"
                    className="form-control"
                    value={patient.phone}
                    onChange={setPatientInfo}
                    required={true}
                  />

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
        </>
      )}
    </>
  );
};

export default AddPatient;
