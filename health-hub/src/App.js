import MainPage from "./pages/MainPage";
import { Routes, Route } from "react-router-dom";
import Patients from "./pages/Patients";
import Appointments from "./pages/Appointments";

import "./App.css";

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/Patients" element={<Patients />} />
        <Route path="/Appointments" element={<Appointments />} />
      </Routes>
    </div>
  );
}

export default App;
