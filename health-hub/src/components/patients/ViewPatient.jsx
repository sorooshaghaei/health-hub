import React, { useEffect, useState } from "react";
import { Teal, VeryLightPink, White } from "../../helpers/colors";
import Spinner from "../Spinner";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getPatientInfo } from "../../services/patientService";

import DeletePatient from "./deletePatient"; // Import the DeletePatient component

const ViewPatient = () => {
  const { patientID } = useParams();
  const navigate = useNavigate();

  // eslint-disable-next-line
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

  const onDelete = (deletedPatientID) => {
    // Handle the deletion in your local state or perform any necessary actions
    // For example, you can update the patient list after deletion
    const updatedPatients = getPatients.filter(
      (patient) => patient.id !== deletedPatientID
    );
    setPatients(updatedPatients);

    navigate("/Patients");
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
                          <h5 name="idNumber" className="form-group mb-4">
                            ID Number: <b>{patient.idNumber}</b>
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
                          <div className="mt-3">
                            <DeletePatient
                              patient={patient}
                              onDelete={onDelete}
                            />

                            <Link
                              to={`/Patients/edit/${patient.id}`}
                              type="edit"
                              className="btn mx-3 text-white"
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
