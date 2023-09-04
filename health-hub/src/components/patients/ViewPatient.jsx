// import React, { useEffect, useState } from "react";
// import { LightRed, Teal, VeryLightPink } from "../../helpers/colors";
// import Spinner from "../Spinner";
// import { useParams } from "react-router-dom";
// import { getPatientInfo } from "../../services/patientService";

const ViewPatient = () => {
//   const { patientID } = useParams();

//   const [state, setState] = useState({
//     loading: false,
//     patient: {},
//   });

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         setState({ ...state, loading: true });
//         const { date: patientData } = await getPatientInfo(patientID);

//         setState({ ...state, loading: false, patient: patientData });
//       } catch (error) {
//         console.log(error);
//         setState({ ...state, loading: false });
//       }
//     };
//     fetchData();
//   }, [patientID]);

//   const { loading, patient } = state;
//   return (
//     <>
//       {loading ? (
//         <Spinner />
//       ) : (
//         // Object.keys(patient).length > 0 &&
//          (
//           <>
//             {
//               <>
//                 <section className="m-5">
//                   <div
//                     className="card border-0 m-3 col-6"
//                     style={{
//                       backgroundColor: VeryLightPink,
//                       textAlign: "left",
//                     }}
//                   >
//                     <div>
//                       <form className="p-5">
//                         <div className="form-group mb-3">
//                           Full Name: {patient.name}
//                         </div>
//                         <div className="form-group mb-3">
//                           Type Of Sickness: {patient.typeOfSickness}
//                         </div>
//                         <div className="form-group mb-3">
//                           Date: {patient.appointmentDate}
//                         </div>
//                         <div className="form-group mb-3">
//                           Time: {patient.appointmentTime}
//                         </div>
//                         <div className="form-group mb-3">
//                           Urgency: {patient.levelOfUrgency}
//                         </div>
//                         <div className="form-group mb-3">
//                           Phone Number: {patient.phone}
//                         </div>

//                         <button
//                           type="submit"
//                           className="btn mt-3 text-white"
//                           style={{ backgroundColor: Teal }}
//                         >
//                           save changes
//                         </button>
//                         <button
//                           to={"/Patients"}
//                           type="delete"
//                           className="btn mt-3 mx-2 text-white"
//                           style={{ backgroundColor: LightRed }}
//                         >
//                           delete patient
//                         </button>
//                       </form>
//                     </div>
//                   </div>
//                 </section>
//               </>
//             }
//           </>
//         )
//       )}
//     </>
//   );
 };
export default ViewPatient;
