import HomePage from "./pages/HomePage";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import "./App.css";

import AddPatient from "./components/patients/AddPatient";
import ViewPatient from "./components/patients/ViewPatient";
import EditPatient from "./components/patients/EditPatient";

import { useState, useEffect } from "react";

import { Footer, Navbar } from "./components";
import {
  createPatient,
  getAllGroups,
  getAllPatients,
  getAllSicknesses,
} from "./services/patientService";
import Dashboard from "./pages/Dashboard";
import Login from "./components/auth/Login";
import Register from "./components/auth/Register";

function App() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [getPatients, setPatients] = useState([]);

  const [getGroups, setGroups] = useState([]);
  const [getSicknesses, setSicknesses] = useState([]);

  const [getPatient, setPatient] = useState({
    name: "",
    idNumber: "",
    appointmentDate: "",
    appointmentTime: "",
    typeOfSickness: "",
    levelOfUrgency: "",
    phone: "",
  });

  // useEffect hook is used to fetch data when the component mounts
  useEffect(() => {
    // Define the function to fetch data asynchronously using Axios
    const fetchData = async () => {
      try {
        // Set loading state to true before fetching data
        setLoading(true);

        // Fetch contacts data from the server using Axios
        const { data: patientsData } = await getAllPatients();

        const { data: sicknessData } = await getAllSicknesses();

        // Fetch groups data from the server using Axios
        const { data: groupsData } = await getAllGroups();

        // Update the state variables with the fetched data and set loading state to false
        setPatients(patientsData);
        setSicknesses(sicknessData);
        setGroups(groupsData);
        setLoading(false);
      } catch (err) {
        // If an error occurs during data fetching, set loading state to false
        setLoading(false);
        console.log("an error happened: " + err.message);
      }
    };

    // Call the fetchData function when the component mounts (empty dependency array means it runs only once)
    fetchData();
  }, []);

  const setPatientInfo = (event) => {
    setPatient({
      ...getPatient,
      [event.target.name]: event.target.value,
    });
  };
  const createPatientForm = async (event) => {
    event.preventDefault();
    try {
      const { status } = await createPatient(getPatient);
      if (status === 201) {
        setPatient({});
        navigate("/Patients");
      }
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div className="App">
      <Navbar patient={getPatients} />
      <Routes>
        {/* Redirect to MainPage when the path is "/" */}
        <Route path="/" element={<Navigate to="/HomePage" />} />

        <Route path="/HomePage" element={<HomePage />} />
        <Route path="/HomePage/Login" element={<Login />} />
        <Route path="/HomePage/Register" element={<Register />} />

        <Route path="/Dashboard" element={<Dashboard patients={getPatients} />} />
        <Route
          path="/Patients"
          element={<Patients patient={getPatients} loading={loading} />}
        />

        <Route
          path="/Patients/addPatient"
          element={
            <AddPatient
              loading={loading}
              setPatientInfo={setPatientInfo}
              patient={getPatient}
              groups={getGroups}
              sicknesses={getSicknesses}
              createPatientForm={createPatientForm}
            />
          }
        />
        <Route path="/Patients/:patientID" element={<ViewPatient />} />
        <Route path="/Patients/edit/:patientID" element={<EditPatient />} />

        <Route
          path="/Appointments"
          element={<Appointments patients={getPatients} />}
        />

        {/* anything else from upper Routes will be rendered here as a 404 or not found! */}
        <Route
          path="*"
          element={
            <main
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <p>There's nothing here!</p>
            </main>
          }
        />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
