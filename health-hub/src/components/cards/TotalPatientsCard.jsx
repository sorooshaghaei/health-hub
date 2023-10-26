import React, { useState, useEffect } from "react";
import { LightTeal, LightWhite, Salmon } from "../../helpers/colors";
import patientIcon from "../../assets/ActorsIcon.svg";
import { getAllPatients } from "../../services/patientService";

const TotalPatientsCard = () => {
  const [currentYearPatients, setCurrentYearPatients] = useState(0);
  const [lastYearPatients, setLastYearPatients] = useState(null);
  const [percentageChange, setPercentageChange] = useState(null);
  const [lastUpdated, setLastUpdated] = useState("Last updated: never");

  // Function to fetch patients for the current year
  const getAllPatientsCurrentYear = async () => {
    const response = await getAllPatients();
    return response.data;
  };

  // Fetch all patients using the same function
  const getAllPatientsLastYear = async () => {
    const response = await getAllPatients();//--------------------------------------not working correct
    return response.data;
  };
  

  const fetchYearlyPatientCounts = async () => {
    try {
      const currentYearResponse = await getAllPatientsCurrentYear();
      setCurrentYearPatients(currentYearResponse.length);

      const lastYearResponse = await getAllPatientsLastYear();
      if (lastYearResponse) {
        setLastYearPatients(lastYearResponse.length);
      } else {
        // Set "No data available" when there's no data for the last year
        setLastYearPatients(0);
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  useEffect(() => {
    fetchYearlyPatientCounts();
  }, []);

  useEffect(() => {
    if (currentYearPatients >= 2 && lastYearPatients !== null) {
      if (lastYearPatients === 0) {
        setPercentageChange("No data available");
      } else {
        const difference = currentYearPatients - lastYearPatients;
        const percentage = ((difference / lastYearPatients) * 100).toFixed(2);
        setPercentageChange(percentage);
      }

      const now = new Date();
      const formattedTime = `${now.toLocaleTimeString()}`;
      setLastUpdated(`Last updated ${formattedTime}`);
    }
  }, [currentYearPatients, lastYearPatients]);

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
            <b>Total Patients</b>
          </h6>
          <img className="mx-3" src={patientIcon} alt="patientIcon" />
        </div>

        <div className="row card-body">
          <div className="col">
            <p style={{ textAlign: "left" }}>
              {percentageChange === "No data available"
                ? "No data available for the last year"
                : percentageChange > 0
                ? `Increase of ${percentageChange}%`
                : percentageChange < 0
                ? `Decrease of ${Math.abs(percentageChange)}%`
                : "No change in patient count"}{" "}
              in the last year
            </p>
          </div>
          <div className="col">
            <div>
              <b style={{ color: LightWhite }}>
                {percentageChange === "No data available"
                  ? "N/A"
                  : percentageChange > 0
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

          <p className="card-text my-3">{lastUpdated}</p>
        </div>
      </div>
    </div>
  );
};

export default TotalPatientsCard;
