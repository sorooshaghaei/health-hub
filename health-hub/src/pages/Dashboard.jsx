import React, { useState, useEffect } from "react";
import Appointments from "./Appointments";
import { getAllPatients } from "../services/patientService";
import OveralVisitorsCard from "../components/cards/OveralVisitorsCard";
import TotalPatientsCard from "../components/cards/TotalPatientsCard";
import TotalSurgeriesCard from "../components/cards/TotalSurgeriesCard";
import SparkLineChart from "../components/SparkLineChart";

const Dashboard = ({ patients }) => {
  const [patientCount, setPatientCount] = useState();

  const fetchAllPatients = async () => {
    try {
      const response = await getAllPatients();
      if (response.data) {
        if (response) {
          const count = response.data.length;
          console.log("Patients count:", count);
          return count;
        } else {
          console.error("Patients data is undefined.");
        }
      } else {
        console.error("Response data is undefined.");
      }
      // Handle these cases gracefully, e.g., return a default value or show an error message.
      return -1;
    } catch (error) {
      console.error("Error fetching patients:", error);
      // Handle the error, e.g., show an error message to the user.
      return -1;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const count = await fetchAllPatients();
        if (count !== -1) {
          setPatientCount(count);
        } else {
          console.log("Failed to retrieve patient count.");
          // Handle the case where data retrieval failed.
        }
      } catch (error) {
        console.error("Error in fetchData:", error);
        // Handle the error, e.g., show an error message to the user.
      }
    };

    fetchData();
  }, []);

  const data = [5, 10, 8, 15, 12, 6, 14, 18];

  return (
    <div>
      <div className="">
        <div className="row justify-content-center">
          <div className="col-6 ">
            <Appointments patients={patients} />
          </div>
          <div className="col-4 my-5 py-5 mx-5">
            <div className="card rounded shadow border-0">
              <SparkLineChart data={data} />
            </div>
          </div>
        </div>

        <div className="row justify-content-center my-5">
          <div className="col-3 visitor-card">
            <OveralVisitorsCard />
          </div>
          <div className="col-3 visitor-card">
            <TotalPatientsCard patientCount={patientCount} />
          </div>
          <div className="col-3 visitor-card">
            <TotalSurgeriesCard />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
