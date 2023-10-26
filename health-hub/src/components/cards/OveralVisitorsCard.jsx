import React, { useState, useEffect } from "react";
import { LightTeal, LightWhite, Salmon } from "../../helpers/colors";
import barchartIcon from "../../assets/bar_chart.svg";
import { getAllPatients } from "../../services/patientService";

const OveralVisitorsCard = () => {
  const [currentWeekPatients, setCurrentWeekPatients] = useState(0);
  const [lastWeekPatients, setLastWeekPatients] = useState(0);
  const [percentageChange, setPercentageChange] = useState(0);

  // Function to fetch patients for the current week
  const getAllPatientsCurrentWeek = async () => {
    const today = new Date();
    const currentWeekEnd = new Date(today);
    currentWeekEnd.setDate(today.getDate() - today.getDay() + 6); // End of the current week
    const currentWeekStart = new Date(today);
    currentWeekStart.setDate(today.getDate() - today.getDay()); // Start of the current week

    // Filter patients with appointment dates in the current week
    const response = await getAllPatients(currentWeekStart, currentWeekEnd);

    return {
      data: response.data.filter((patient) => {
        const appointmentDate = new Date(patient.appointmentDate);
        return (
          appointmentDate >= currentWeekStart &&
          appointmentDate <= currentWeekEnd
        );
      }),
    };
  };

  // Function to fetch patients for the week before the current week
  const getAllPatientsLastWeek = async () => {
    const today = new Date();
    const lastWeekEnd = new Date(today);
    lastWeekEnd.setDate(today.getDate() - today.getDay() - 1); // Go back to the end of the previous week
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekStart.getDate() - 6); // Go back to the start of the previous week

    // Filter patients with appointment dates in the last week
    const response = await getAllPatients(lastWeekStart, lastWeekEnd);

    return {
      data: response.data.filter((patient) => {
        const appointmentDate = new Date(patient.appointmentDate);
        return (
          appointmentDate >= lastWeekStart && appointmentDate <= lastWeekEnd
        );
      }),
    };
  };

  const fetchWeeklyPatientCounts = async () => {
    try {
      // Fetch patients for the current week
      const currentWeekResponse = await getAllPatientsCurrentWeek();
      if (currentWeekResponse.data) {
        setCurrentWeekPatients(currentWeekResponse.data.length);
      } else {
        console.error("Response data for the current week is undefined.");
      }

      // Fetch patients for the week before the current week
      const lastWeekResponse = await getAllPatientsLastWeek();
      if (lastWeekResponse.data) {
        setLastWeekPatients(lastWeekResponse.data.length);
      } else {
        console.error(
          "Response data for the week before the current week is undefined."
        );
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  useEffect(() => {
    fetchWeeklyPatientCounts();
    // eslint-disable-next-line 
  }, []);

  useEffect(() => {
    if (currentWeekPatients >= 2 && lastWeekPatients >= 2) {
      // Calculate the percentage change
      const difference = currentWeekPatients - lastWeekPatients;
      const percentage = ((difference / lastWeekPatients) * 100).toFixed(2);

      console.log("currentweek:", currentWeekPatients);
      console.log("lastweek:", lastWeekPatients);
      setPercentageChange(percentage);
    }
  }, [currentWeekPatients, lastWeekPatients]);

  return (
    <div>
      <div
        className="card text-white shadow border-0"
        style={{ backgroundColor: LightTeal }}
      >
        <div className="d-flex align-items-center justify-content-between">
          <h6
            className="card-title col-md-7 my-3 mx-3"
            style={{ textAlign: "left" }}
          >
            <b>Overall Visitors A Week</b>
          </h6>
          <img className="mx-3" src={barchartIcon} alt="barchartIcon" />
        </div>

        <div className="row card-body">
          <div className="col">
            <p style={{ textAlign: "left" }}>
              {percentageChange > 0
                ? `Increase of ${percentageChange}%`
                : percentageChange < 0
                ? `Decrease of ${Math.abs(percentageChange)}%`
                : "No change in patient count"}{" "}
              in the last 7 days
            </p>
          </div>
          <div className="col">
            <div>
              <b style={{ color: LightWhite }}>
                {percentageChange > 0
                  ? `+${percentageChange}%`
                  : percentageChange < 0
                  ? percentageChange
                  : "0%"}
              </b>
            </div>
            <div
              className="col badge rounded-pill "
              style={{ backgroundColor: Salmon }}
            >
              <span>New</span>
            </div>
          </div>

          <p className="card-text my-3">Last updated 3 mins ago</p>
        </div>
      </div>
    </div>
  );
};

export default OveralVisitorsCard;
