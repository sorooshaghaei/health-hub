import React from "react";
import { VeryLightPink } from "../helpers/colors";
import assignment from "../assets/assignment.svg";
import date_range from "../assets/date_range.svg";
import alarm from "../assets/alarm.svg";

const Patient = () => {
  return (
    <div>
      <div
        className="card shadow border-0"
        style={{
          backgroundColor: VeryLightPink,
          width: "18rem",
          textAlign: "left",
        }}
      >
        <div className="card-body">
          <h5 className="card-title m-3">
            {" "}
            <i className="fa fa-user-circle"></i> Name Of Patient
          </h5>
          <div className="card-text m-3 mt-5">
            <div className="d-block mt-2">
              <img src={assignment} alt="assignment" /> Type Of sickness
            </div>
            <div className="d-block mt-2">
              <img src={date_range} alt="date_range" /> Day of the Appointment
            </div>
            <div className="d-block mt-2">
              <img src={alarm} alt="alarm" /> Time of the Appointment
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Patient;
