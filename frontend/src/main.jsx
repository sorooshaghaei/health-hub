import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import "./styles.css";
import "./phase2.css";
import "./phase3.css";
import "./phase4.css";
import "./patientProfileRefresh.css";
import "./appointmentFlowRefresh.css";
import "./phase6.css";
import "./phase7.css";
import "./workspaceUsability.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
