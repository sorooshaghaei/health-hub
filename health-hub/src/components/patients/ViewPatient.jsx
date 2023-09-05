import React, { useEffect, useState } from "react";
import { LightRed, Teal, VeryLightPink} from "../../helpers/colors";
import Spinner from "../Spinner";
import { useParams } from "react-router-dom";
import { getPatientInfo } from "../../services/patientService";

const ViewPatient = () => {
  const { patientID } = useParams();

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

  const { loading, patient } = state;

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
                        <h5 name="name" className="form-group mb-4">
                          Full Name: <b>{patient.name}</b>
                        </h5>

                        <h5 name="typeOfSickness" className="form-group mb-4">
                          Type Of Sickness: <b>{patient.typeOfSickness}</b>
                        </h5>
                        <h5 name="appointmentDate" className="form-group mb-4">
                          Date: <b>{patient.appointmentDate}</b>
                        </h5>
                        <h5 name="appointmentTime" className="form-group mb-4">
                          Time: <b>{patient.appointmentTime}</b>
                        </h5>
                        <h5 name="levelOfUrgency" className="form-group mb-4">
                          Urgency: <b>{patient.levelOfUrgency}</b>
                        </h5>
                        <h5 name="phone" className="form-group mb-4">
                          Phone Number: <b>{patient.phone}</b>
                        </h5>

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
                          className="btn mt-3 mx-3 text-white"
                          style={{ backgroundColor: LightRed }}
                        >
                          delete patient
                        </button>
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
