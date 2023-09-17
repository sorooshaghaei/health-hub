import React, { useEffect, useState } from "react";
import {
  DarkGray,
  LightPink,
  LightRed,
  Red,
  Teal,
  VeryLightPink,
  White,
} from "../../helpers/colors";
import Spinner from "../Spinner";
import { Link, useParams } from "react-router-dom";
import {
  deletePatient,
  getAllPatients,
  getPatientInfo,
} from "../../services/patientService";

import { confirmAlert } from "react-confirm-alert"; // Import the confirmAlert function

const ViewPatient = () => {
  const { patientID } = useParams();

  const [loading, setLoading] = useState(false);
  const [getPatients, setPatients] = useState([]);

  const [state, setState] = useState({
    loading: false,
    patient: {},
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setState((prevState) => ({ ...prevState, loading: true }));
        const { data: patientData } = await getPatientInfo(patientID);

        setState((prevState) => ({
          ...prevState,
          loading: false,
          patient: patientData,
        }));
      } catch (error) {
        console.log(error);
        setState((prevState) => ({ ...prevState, loading: false }));
      }
    };
    fetchData();
  }, [patientID]);

  const { patient } = state;

  const confirm = () => {
    confirmAlert({
      customUI: ({ onClose }) => {
        return (
          <>
            <div
              style={{
                backgroundColor: Teal,
                border: `1px solid ${LightPink}`,
                borderRadius: "1em",
              }}
              className="p-4"
            >
              <h1 style={{ color: DarkGray }}>Delete Patient</h1>
              <p style={{ color: DarkGray }}>
                Are you sure, you wanna delete {patient.name}?
              </p>
              <button
                onClick={() => {
                  removePatient(patientID);
                  onClose();
                }}
                className="btn mx-2"
                style={{ backgroundColor: Teal }}
              >
                yes!
              </button>
              <button
                onClick={onClose}
                className="btn "
                style={{ backgroundColor: Red }}
              >
                no!
              </button>
            </div>
          </>
        );
      },
    });
  };

  const removePatient = async (patientID) => {
    try {
      setLoading(false);
      const response = await deletePatient(patientID);
      if (response) {
        const { data: patientsData } = await getAllPatients();
        setPatients(patientsData);
        setLoading(false);
      }
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  return (
    <>
      {loading ? (
        <Spinner />
      ) : (
        Object.keys(patient).length > 0 && (
          <>
            {
              <>
                <div className="m-5">
                  <div
                    className="card border-0 m-3 col-6"
                    style={{
                      backgroundColor: VeryLightPink,
                      textAlign: "left",
                    }}
                  >
                    <div>
                      <div className="p-5">
                        <div
                          className="card rounded-3 p-4"
                          style={{ backgroundColor: White }}
                        >
                          <h5 name="name" className="form-group mb-4">
                            Full Name: <b>{patient.name}</b>
                          </h5>

                          <h5 name="typeOfSickness" className="form-group mb-4">
                            Type Of Sickness: <b>{patient.typeOfSickness}</b>
                          </h5>
                          <h5
                            name="appointmentDate"
                            className="form-group mb-4"
                          >
                            Date: <b>{patient.appointmentDate}</b>
                          </h5>
                          <h5
                            name="appointmentTime"
                            className="form-group mb-4"
                          >
                            Time: <b>{patient.appointmentTime}</b>
                          </h5>
                          <h5 name="levelOfUrgency" className="form-group mb-4">
                            Urgency: <b>{patient.levelOfUrgency}</b>
                          </h5>
                          <h5 name="phone" className="form-group mb-4">
                            Phone Number: <b>{patient.phone}</b>
                          </h5>
                          <div>
                            <button
                              onClick={confirm}
                              type="delete"
                              className="btn mt-3 text-white"
                              style={{ backgroundColor: LightRed }}
                            >
                              <i className="fa fa-trash"></i> delete patient
                            </button>
                            <Link
                              to={`/Patients/edit/${patient.id}`}
                              type="edit"
                              className="btn mt-3 mx-3 text-white"
                              style={{ backgroundColor: Teal }}
                            >
                              <i className="fa fa-pencil"></i> edit patient
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            }
          </>
        )
      )}
    </>
  );
};

export default ViewPatient;
