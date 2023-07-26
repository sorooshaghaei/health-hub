import React, { useState } from "react";
import { Footer, Navbar } from "../components";
import { Routes, Route, Navigate } from "react-router-dom";

import Calendar from "react-calendar"; // Import the Calendar component from react-calendar
import "react-calendar/dist/Calendar.css"; // Import the default stylesheet for react-calendar
import OveralVisitorsCard from "../components/OveralVisitorsCard";
import TotalPatientsCard from "../components/TotalPatientsCard";
import TotalSurgeriesCard from "../components/TotalSurgeriesCard";
import SparkLineChart from "../components/SparkLineChart";

const MainPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date()); // State to keep track of selected date

  const data = [5, 10, 8, 15, 12, 6, 14, 10];
    const color = '#007bff'; // Replace this with the desired color


  return (
    <div>
      <Navbar />
      {/* Routes section */}
      <Routes>
        <Route path="/" element={<Navigate to="/Home" />} />
      </Routes>

      <div className="content ">
        <div className="row my-5  " style={{ justifyContent: "center" }}>
          <div className="col-5">
            <h5>
              <b>July 2023</b>
            </h5>
            <Calendar
              className="rounded shadow border-0"
              onChange={setSelectedDate} // Set the selected date on change
              value={selectedDate} // Use the selected date state
            />
          </div>

          <div className="col-4">
          
      <h1>Sparkline Chart Example</h1>
      <div className="row">
        <div className="col">
          <SparkLineChart data={data} color={color} />
        </div>
     
    </div>
          </div>
        </div>

        <div className="cards-container row justify-content-center my-5">
          <div className=" visitor-card col-3 ">
            <OveralVisitorsCard />
          </div>
          <div className=" visitor-card col-3 ">
            <TotalPatientsCard />
          </div>
          <div className=" visitor-card col-3 ">
            <TotalSurgeriesCard />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MainPage;
