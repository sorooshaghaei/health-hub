import MainPage from "./pages/MainPage";
import { Routes, Route, Navigate } from "react-router-dom";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";
import "./App.css";

import AddPatient from "./components/patients/AddPatient";
import ViewPatient from "./components/patients/ViewPatient";
import EditPatient from "./components/patients/EditPatient";

import { useState, useEffect } from "react";
import axios from "axios";
import { Footer, Navbar } from "./components";

function App() {
  const [loading, setLoading] = useState(false);
  const [getPatient, setPatient] = useState([]);
  // eslint-disable-next-line
  const [getGroups, setGroups] = useState([]);

  // useEffect hook is used to fetch data when the component mounts
  useEffect(() => {
    // Define the function to fetch data asynchronously using Axios
    const fetchData = async () => {
      try {
        // Set loading state to true before fetching data
        setLoading(true);

        // Fetch contacts data from the server using Axios
        const { data: patientsData } = await axios.get(
          "http://localhost:9000/patients"
        );

        // Fetch groups data from the server using Axios
        const { data: groupsData } = await axios.get(
          "http://localhost:9000/groups"
        );

        // Update the state variables with the fetched data and set loading state to false
        setPatient(patientsData);
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

  return (
    <div className="App">
      <Navbar />
      <Routes>
        {/* Redirect to MainPage when the path is "/" */}
        <Route path="/" element={<Navigate to="/MainPage" />} />

        <Route path="/MainPage" element={<MainPage />} />
        <Route
          path="/Patients"
          element={<Patients patient={getPatient} loading={loading} />}
        />

        <Route path="/Patients/addPatient" element={<AddPatient />} />
        <Route path="/Patients/:patientId" element={<ViewPatient />} />
        <Route path="/Patients/edit/:patientId" element={<EditPatient />} />

        <Route path="/Appointments" element={<Appointments />} />

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
