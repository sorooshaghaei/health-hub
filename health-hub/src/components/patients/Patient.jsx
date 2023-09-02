import React from "react";
import { LightRed, VeryLightPink } from "../../helpers/colors";
import assignment from "../../assets/assignment.svg";
import date_range from "../../assets/date_range.svg";
import alarm from "../../assets/alarm.svg";
import warning from "../../assets/warning.svg";
import { Link } from "react-router-dom";

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
      <Link
        to={`/Patients/${patient.id}`}
        className="btn"
        style={{ display: "block", textDecoration: "none" }}
      >
        <div className="card-body">
          <h5 className="card-title m-3 d-flex align-items-start">
            <i className="fa fa-user-circle mx-2 mt-1"></i> {patient.name}
          </h5>
          <div className="card-text m-3 mt-5">
            <div className="d-flex align-items-start mt-2">
              <img src={assignment} alt="assignment" className="mx-2" />
              <span>{patient.typeOfSickness}</span>
            </div>
            <div className="d-flex align-items-start mt-2">
              <img src={date_range} alt="date_range" className="mx-2" />
              <span>{patient.appointmentDate}</span>
            </div>
            <div className="d-flex align-items-start mt-2">
              <img src={alarm} alt="alarm" className="mx-2" />
              <span>{patient.appointmentTime}</span>
            </div>
            <div className="d-flex align-items-start mt-5">
              <img
                src={warning}
                alt="warning"
                className="mx-2 rounded-pill p-1 "
                style={{ backgroundColor: LightRed }}
              />
              <span>{patient.levelOfUrgency}</span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default Patient;
