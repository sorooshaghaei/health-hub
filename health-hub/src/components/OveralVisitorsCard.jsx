import React from "react";
import { LightTeal } from "../helpers/colors";
import barchartIcon from "../assets/bar_chart.svg";

const OveralVisitorsCard = () => {
  return (
    <div>
      <div className="card text-white" style={{ backgroundColor: LightTeal }}>
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="card-title col-md-7 my-3 mx-3" style={{ textAlign: "left" }}>
            <b>Overall visitors</b>
          </h6>
          <img className="mx-3" src={barchartIcon} alt="barchartIcon" />
        </div>
        <p className="card-text my-5 mx-3" style={{ textAlign: "left" }}>
          Increase in data by
          <br />
          500+ inpatients in the
          <br />
          last 7 days
        </p>
        <p className="card-text my-3">Last updated 3 mins ago</p>
      </div>
    </div>
  );
};

export default OveralVisitorsCard;
