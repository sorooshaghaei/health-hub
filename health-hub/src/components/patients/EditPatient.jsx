import React, { useEffect } from "react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Spinner from "../Spinner";

import {
  LightRed,
  LightTeal,
  Teal,
  VeryLightPink,
} from "../../helpers/colors";

import {
  getAllGroups,
  getAllSicknesses,
  getPatientInfo,
  updatePatient,
} from "../../services/patientService";

const EditPatient = () => {
  const { patientID } = useParams();
  const navigate = useNavigate();

  const [state, setState] = useState({
    loading: false,
    patient: {
      name: "",
      idNumber: "",
      appointmentDate: "",
      appointmentTime: "",
      typeOfSickness: "",
      levelOfUrgency: "",
      phone: "",
    },
    groups: [],
    sicknesses: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState({ ...state, loading: true });
        const { data: patientData } = await getPatientInfo(patientID);
        const { data: patientGroups } = await getAllGroups();
        const { data: patientSickness } = await getAllSicknesses();

        setState({
          ...state,
          loading: false,
          patient: patientData,
          groups: patientGroups,
          sicknesses: patientSickness,
        });
      } catch (error) {
        console.log(error);
        setState({ ...state, loading: false });
      }
    };
    fetchData();
    // eslint-disable-next-line
  }, [patientID]);

  const setPatientInfo = (event) => {
    setState({
      ...state,
      patient: {
        ...state.patient,
        [event.target.name]: event.target.value,
      },
    });
  };

  const submitForm = async (event) => {
    event.preventDefault();
    try {
      setState({ ...state, loading: true });
      const { data: updated } = await updatePatient(state.patient, patientID);

      setState({ ...state, loading: false });
      if (updated) {
        navigate("/Patients");
      }
    } catch (error) {
      console.log(error);
      setState({ ...state, loading: false });
    }
  };

  const { patient, loading, groups, sicknesses } = state;

  return (
    <div className="container">
      {loading ? (
        <Spinner />
      ) : (
        <section className="my-5">
          <h2 className="fw-bold text-center mb-5" style={{ color: LightTeal }}>
            Edit Patient "{patient.name}"
          </h2>
          <div className="row justify-content-center">
            <div className="col-lg-6">
              <div
                className="card border-0 m-3"
                style={{
                  backgroundColor: VeryLightPink,
                  textAlign: "left",
                }}
              >
                <form onSubmit={submitForm} className="p-5">
                  <div className="mb-3">
                    <label htmlFor="name" className="form-label">
                      Full Name
                    </label>
                    <input
                      name="name"
                      type="text"
                      className="form-control"
                      value={patient.name}
                      onChange={setPatientInfo}
                      placeholder="Enter Full Name"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="idNumber" className="form-label">
                      ID Number
                    </label>
                    <input
                      name="idNumber"
                      type="number"
                      className="form-control"
                      value={patient.idNumber}
                      onChange={setPatientInfo}
                      placeholder="Enter ID Number"
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="appointmentDate" className="form-label">
                      Appointment Date
                    </label>
                    <input
                      name="appointmentDate"
                      type="date"
                      className="form-control"
                      value={patient.appointmentDate}
                      onChange={setPatientInfo}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="appointmentTime" className="form-label">
                      Appointment Time
                    </label>
                    <input
                      name="appointmentTime"
                      type="time"
                      className="form-control"
                      value={patient.appointmentTime}
                      onChange={setPatientInfo}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="typeOfSickness" className="form-label">
                      Type Of Sickness
                    </label>
                    <select
                      name="typeOfSickness"
                      className="form-select"
                      value={patient.typeOfSickness}
                      onChange={setPatientInfo}
                    >
                      <option value="">Choose one</option>
                      {sicknesses.length > 0 &&
                        sicknesses.map((sickness) => (
                          <option key={sickness.id} value={sickness.typeOfSickness}>
                            {sickness.typeOfSickness}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="levelOfUrgency" className="form-label">
                      Level Of Urgency
                    </label>
                    <select
                      name="levelOfUrgency"
                      className="form-select"
                      value={patient.levelOfUrgency}
                      onChange={setPatientInfo}
                    >
                      <option value="">Choose one</option>
                      {groups.length > 0 &&
                        groups.map((group) => (
                          <option key={group.id} value={group.levelOfUrgency}>
                            {group.levelOfUrgency}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="phone" className="form-label">
                      Phone Number
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      className="form-control"
                      value={patient.phone}
                      onChange={setPatientInfo}
                      required
                    />
                  </div>
                  <div className="d-grid">
                    <button
                      type="submit"
                      className="btn mt-3"
                      style={{ backgroundColor: Teal }}
                    >
                      Submit
                    </button>
                    <Link
                      to="/Patients"
                      className="btn mt-3"
                      style={{backgroundColor:LightRed}}
                    >
                      Discard
                    </Link>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default EditPatient;
