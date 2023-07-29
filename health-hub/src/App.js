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
    </div>
  );
}

export default App;
