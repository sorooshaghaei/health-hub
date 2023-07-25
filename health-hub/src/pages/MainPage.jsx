import React, { useState } from "react";
import { Footer, Navbar } from "../components";
import { Routes, Route, Navigate } from "react-router-dom";

import Calendar from "react-calendar"; // Import the Calendar component from react-calendar
import "react-calendar/dist/Calendar.css"; // Import the default stylesheet for react-calendar
import OveralVisitorsCard from "../components/OveralVisitorsCard";
import TotalPatientsCard from "../components/TotalPatientsCard";
import TotalSurgeriesCard from "../components/TotalSurgeriesCard";

const MainPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date()); // State to keep track of selected date

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
            <h3>Increase/Decrease Table</h3>
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Increase</th>
                  <th>Decrease</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Patients</td>
                  <td>25</td>
                  <td>10</td>
                </tr>
                <tr>
                  <td>Surgeries</td>
                  <td>15</td>
                  <td>5</td>
                </tr>
                {/* Add more rows as needed */}
              </tbody>
            </table>
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
