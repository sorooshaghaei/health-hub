import React from "react";
import { VeryLightPink } from "../helpers/colors";
import assignment from "../assets/assignment.svg";
import date_range from "../assets/date_range.svg";
import alarm from "../assets/alarm.svg";

const Patient = ({ patient }) => {
  return (
    <div
      className="card shadow border-0 m-3"
      style={{
        backgroundColor: VeryLightPink,
        width: "18rem",
        textAlign: "left",
      }}
    >
      <div className="card-body">
        <h5 className="card-title m-3">
          {" "}
          <i className="fa fa-user-circle"></i> {patient.name}
        </h5>
        <div className="card-text m-3 mt-5">
          <div className="d-block mt-2">
            <img src={assignment} alt="assignment" /> {patient.sickness}
          </div>
          <div className="d-block mt-2">
            <img src={date_range} alt="date_range" /> {patient.appointmentDate}
          </div>
          <div className="d-block mt-2">
            <img src={alarm} alt="alarm" /> {patient.appointmentTime}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Patient;
