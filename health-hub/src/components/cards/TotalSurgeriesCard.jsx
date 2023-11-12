import React, { useState, useEffect } from "react";
import { LightTeal, LightWhite, Salmon } from "../../helpers/colors";
import hospitalBedIcon from "../../assets/hospital-bed.svg";
import { getAllPatients } from "../../services/patientService";

const TotalSurgeriesCard = () => {
  const [currentWeekSurgeries, setCurrentWeekSurgeries] = useState(null);
  const [lastWeekSurgeries, setLastWeekSurgeries] = useState(null);
  const [percentageChange, setPercentageChange] = useState(0);
  const [lastUpdated, setLastUpdated] = useState("Last updated: never");

  const fetchWeeklySurgeryCounts = async () => {
    try {
      const allPatientsResponse = await getAllPatients();

      if (allPatientsResponse && allPatientsResponse.data) {
        const allPatients = allPatientsResponse.data;
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - today.getDay());
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

        const lastWeekStart = new Date(currentWeekStart);
        lastWeekStart.setDate(currentWeekStart.getDate() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);

        // Log the surgeries for the current and last week
        console.log(
          "Current Week Surgeries:",
          allPatients.filter(
            (patient) =>
              patient.typeOfSickness === "surgery" &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) >= currentWeekStart &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) <= currentWeekEnd
          ).length
        );
        console.log(
          "Last Week Surgeries:",
          allPatients.filter(
            (patient) =>
              patient.typeOfSickness === "surgery" &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) >= lastWeekStart &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) <= lastWeekEnd
          ).length
        );

        setCurrentWeekSurgeries(
          allPatients.filter(
            (patient) =>
              patient.typeOfSickness === "surgery" &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) >= currentWeekStart &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) <= currentWeekEnd
          ).length
        );

        setLastWeekSurgeries(
          allPatients.filter(
            (patient) =>
              patient.typeOfSickness === "surgery" &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) >= lastWeekStart &&
              new Date(
                `${patient.appointmentDate}T${patient.appointmentTime}:00`
              ) <= lastWeekEnd
          ).length
        );
      } else {
        console.error("Error fetching patients: Response data is undefined.");
      }
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  useEffect(() => {
    fetchWeeklySurgeryCounts();
  }, []);

  useEffect(() => {
    if (currentWeekSurgeries !== null && lastWeekSurgeries !== null) {
      const difference = currentWeekSurgeries - lastWeekSurgeries;
      const percentage =
        lastWeekSurgeries > 0
          ? ((difference / lastWeekSurgeries) * 100).toFixed(2)
          : "N/A";

      const now = new Date();
      const formattedTime = `${now.toLocaleTimeString()}`;
      setLastUpdated(`Last updated ${formattedTime}`);
      setPercentageChange(percentage);
    }
  }, [currentWeekSurgeries, lastWeekSurgeries]);

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
            <b>Total Surgeries</b>
          </h6>
          <img className="mx-3" src={hospitalBedIcon} alt="hospitalBedIcon" />
        </div>

        <div className="row card-body">
          <div className="col">
            <p style={{ textAlign: "left" }}>
              {percentageChange > 0
                ? `Increase of ${percentageChange}%`
                : percentageChange < 0
                ? `Decrease of ${Math.abs(percentageChange)}%`
                : "No change in surgery count"}{" "}
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
          <p className="card-text my-3">{lastUpdated}</p>
        </div>
      </div>
    </div>
  );
};

export default TotalSurgeriesCard;
