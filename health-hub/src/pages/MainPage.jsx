import React, { useState } from "react";
import { Footer, Navbar } from "../components";
import { Routes, Route, Navigate } from "react-router-dom";

import Calendar from "react-calendar"; // Import the Calendar component from react-calendar
import "react-calendar/dist/Calendar.css"; // Import the default stylesheet for react-calendar
import OveralVisitorsCard from "../components/OveralVisitorsCard";

const MainPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date()); // State to keep track of selected date

  return (
    <div>
      <Navbar />
      {/* Routes section */}
      <Routes>
        <Route path="/" element={<Navigate to="/Home" />} />
      </Routes>

      <div className="content">
        <div className="calendar">
          <h3>July 2023</h3>
          <Calendar
            onChange={setSelectedDate} // Set the selected date on change
            value={selectedDate} // Use the selected date state
          />
        </div>
        <div className="cards-container row justify-content-center">
          <div className=" visitor-card col-3 ">
            <OveralVisitorsCard />
          </div>
          <div className=" visitor-card col-3 ">
            <OveralVisitorsCard />
          </div>
          <div className=" visitor-card col-3 ">
            <OveralVisitorsCard />
          </div>
        </div>
        <div className="increase-decrease-table">
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
      <Footer />
    </div>
  );
};

export default MainPage;
