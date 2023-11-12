import React, { useState, useEffect } from "react";
import Appointments from "./Appointments";
import { getAllPatients } from "../services/patientService";
import OveralVisitorsCard from "../components/cards/OveralVisitorsCard";
import TotalPatientsCard from "../components/cards/TotalPatientsCard";
import TotalSurgeriesCard from "../components/cards/TotalSurgeriesCard";
import SparkLineChart from "../components/SparkLineChart";

const Dashboard = ({ patients }) => {
  const [patientCount, setPatientCount] = useState([]);

  const fetchAllPatients = async () => {
    try {
      const response = await getAllPatients();
      if (response.data) {
        const patientsData = response.data;
        const monthlyCounts = Array(12).fill(0);

        patientsData.forEach((patient) => {
          if (patient.appointmentDate) {
            const date = new Date(patient.appointmentDate);
            const month = date.getMonth();
            monthlyCounts[month]++;
          } else {
            console.warn(
              "Patient data missing 'appointmentDate' property:",
              patient
            );
          }
        });

        console.log("Patients count by month:", monthlyCounts);
        return monthlyCounts;
      } else {
        console.error("Response data is undefined.");
      }

      return Array(12).fill(0);
    } catch (error) {
      console.error("Error fetching patients:", error);
      return Array(12).fill(0);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const monthlyCounts = await fetchAllPatients();
        if (monthlyCounts.every((count) => count !== -1)) {
          setPatientCount(monthlyCounts);
        } else {
          console.log("Failed to retrieve patient counts by month.");
          // Handle the case where data retrieval failed.
        }
      } catch (error) {
        console.error("Error in fetchData:", error);
        // Handle the error, e.g., show an error message to the user.
      }
    };

    fetchData();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="container">
      <div className="row">
        <div className="col-lg-8 col-md-12">
          <Appointments patients={patients} />
        </div>
        <div className="col-lg-4 col-md-12 d-none d-lg-block">
          <div className="card rounded shadow border-0 my-5">
            <SparkLineChart data={patientCount} />
          </div>
        </div>
      </div>

      <div className="row my-5">
        <div className="col-lg-4 col-md-6 visitor-card">
          <OveralVisitorsCard />
        </div>
        <div className="col-lg-4 col-md-6 visitor-card">
          <TotalPatientsCard />
        </div>
        <div className="col-lg-4 col-md-6 visitor-card">
          <TotalSurgeriesCard getAllPatients={patients} />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
