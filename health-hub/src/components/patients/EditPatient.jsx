import React, { useEffect } from "react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import Spinner from "../Spinner";

import { LightRed, LightTeal, Teal, VeryLightPink } from "../../helpers/colors";

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
        [event.target.name]: [event.target.value],
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
    <>
      {loading ? (
        <Spinner />
      ) : (
        <>
          <section className="m-5">
            <p
              className="h4 fw-bold text-center mb-5"
              style={{ color: LightTeal }}
            >
              Edit patient "{patient.name}"
            </p>

            <div
              className="card border-0 m-3 col-6"
              style={{
                backgroundColor: VeryLightPink,
                textAlign: "left",
              }}
            >
              <div>
                <form onSubmit={submitForm} className="p-5">
                  <div className="form-group">
                    <input
                      name="name"
                      type="text"
                      className="form-control"
                      value={patient.name}
                      onChange={setPatientInfo}
                      placeholder="Enter Full Name"
                    />
                  </div>
                  <div className="form-group">
                    <input
                      name="appointmentDate"
                      type=""
                      className="form-control"
                      value={patient.appointmentDate}
                      onChange={setPatientInfo}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      name="appointmentTime"
                      type=""
                      className="form-control"
                      value={patient.appointmentTime}
                      onChange={setPatientInfo}
                    />
                  </div>

                  <select
                    name="typeOfSickness"
                    className="form-select"
                    value={patient.typeOfSickness}
                    onChange={setPatientInfo}
                  >
                    <option value="">choose one</option>
                    {sicknesses.length > 0 &&
                      sicknesses.map((sickness) => (
                        <option
                          key={sickness.id}
                          value={sickness.typeOfSickness}
                        >
                          {sickness.typeOfSickness}
                        </option>
                      ))}
                  </select>

                  <select
                    name="levelOfUrgency"
                    className="form-select"
                    value={patient.levelOfUrgency}
                    onChange={setPatientInfo}
                  >
                    <option value="">choose one</option>
                    {groups.length > 0 &&
                      groups.map((group) => (
                        <option key={group.id} value={group.levelOfUrgency}>
                          {group.levelOfUrgency}
                        </option>
                      ))}
                  </select>

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

export default EditPatient;
