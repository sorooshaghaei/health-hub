import React, { useState, useEffect } from "react";
import { LightTeal, LightWhite, Salmon } from "../../helpers/colors";
import barchartIcon from "../../assets/bar_chart.svg";
import { getAllPatients } from "../../services/patientService";

const OveralVisitorsCard = () => {
  const [weeklyPatientCounts, setWeeklyPatientCounts] = useState([]);

  const fetchWeeklyPatientCounts = async () => {
    try {
      const response = await getAllPatients();
      if (response.data) {
        const patientsData = response.data;
        const weeklyCounts = Array(7).fill(0); // Assuming you want data for the last 7 days

        patientsData.forEach((patient) => {
          if (patient.appointmentDate) {
            const date = new Date(patient.appointmentDate);
            const daysAgo = daysBetween(new Date(), date);
            if (daysAgo >= 0 && daysAgo < 7) {
              weeklyCounts[daysAgo]++;
            }
          }
        });

        console.log("Patients count by week:", weeklyCounts);
        setWeeklyPatientCounts(weeklyCounts);
      } else {
        console.error("Response data is undefined.");
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  // Function to calculate the number of days between two dates
  function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((date1 - date2) / oneDay));
  }

  useEffect(() => {
    fetchWeeklyPatientCounts();
    // eslint-disable-next-line
  }, []);

  const [percentageChange, setPercentageChange] = useState(0);

  useEffect(() => {
    if (weeklyPatientCounts.length >= 2) {
      const currentWeekPatients = weeklyPatientCounts[weeklyPatientCounts.length - 1];
      const previousWeekPatients = weeklyPatientCounts[weeklyPatientCounts.length - 2];

      const difference = currentWeekPatients - previousWeekPatients;
      const percentage = ((difference / previousWeekPatients) * 100).toFixed(2);

      setPercentageChange(percentage);
    }
  }, [weeklyPatientCounts]);

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
            <b>Overal Visitors A Week</b>
          </h6>
          <img className="mx-3" src={barchartIcon} alt="barchartIcon" />
        </div>

        <div className="row card-body">
          <div className="col">
            <p style={{ textAlign: "left" }}>
              Increase in data by {percentageChange > 0 ? `+${percentageChange}%` : `${percentageChange}%`} inpatients in the last 7 days
            </p>
          </div>
          <div className="col">
            <div>
              <b style={{ color: LightWhite }}>{percentageChange > 0 ? `+${percentageChange}%` : `${percentageChange}%`}</b>
            </div>
            <div
              className="col badge rounded-pill "
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
