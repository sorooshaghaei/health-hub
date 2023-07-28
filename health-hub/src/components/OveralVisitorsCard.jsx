import React from "react";
import { LightTeal, LightWhite, Salmon } from "../helpers/colors";
import barchartIcon from "../assets/bar_chart.svg";

const OveralVisitorsCard = () => {
  return (
    <div>
    <div className="card text-white shadow border-0" style={{ backgroundColor: LightTeal }}>
      <div className="d-flex align-items-center justify-content-between">
        <h6
          className="card-title col-md-7 my-3 mx-3"
          style={{ textAlign: "left" }}
        >
          <b>Total Patients</b>
        </h6>
        <img className="mx-3" src={barchartIcon} alt="barchartIcon" />
      </div>

      <div className="row card-body">
        <div className="col">
          <p style={{ textAlign: "left" }}>
            Increase in data by 500+ inpatients in the last 7 days
          </p>
        </div>
        <div className="col">
          <div>
            <b style={{ color: LightWhite }}>2.77%</b>
          </div>
          <div
            class="col badge rounded-pill "
            style={{ backgroundColor: Salmon }}
          >
            <span>New</span>
          </div>
        </div>
      </div>

      <p className="card-text my-3">Last updated 3 mins ago</p>
    </div>
  </div>
  );
};

export default OveralVisitorsCard;
