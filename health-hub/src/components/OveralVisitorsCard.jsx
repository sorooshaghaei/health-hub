import React from "react";
import { LightTeal, LightWhite, Salmon } from "../helpers/colors";
import barchartIcon from "../assets/bar_chart.svg";

const OveralVisitorsCard = () => {
  return (
    <div>
      <div className="card text-white shadow " style={{ backgroundColor: LightTeal }}>
        <div className="d-flex align-items-center justify-content-between">
          <h6
            className="card-title col-md-7 my-3 mx-3"
            style={{ textAlign: "left" }}
          >
            <b>Overall visitors</b>
          </h6>
          <img className="mx-3" src={barchartIcon} alt="barchartIcon" />
        </div>

        <div className="row">
          <div className="col">
            <p className=" mx-3 my-3 " style={{ textAlign: "left" }}>
              Increase in data by 500+ inpatients in the last 7 days
            </p>
          </div>
          <div className="col">
            <div className=" card-body">
              <b style={{ color: LightWhite }}>3.54%</b>
            </div>
            <div
              class=" badge rounded-pill "
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
