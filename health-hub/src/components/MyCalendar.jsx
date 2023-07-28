import Calendar from "react-calendar"; // Import the Calendar component from react-calendar
import "react-calendar/dist/Calendar.css"; // Import the default stylesheet for react-calendar

import React from "react";
import { useState } from "react";

const MyCalendar = () => {
  const [selectedDate, setSelectedDate] = useState(new Date()); // State to keep track of selected date

  return (
    <div>
      <Calendar
        className="rounded shadow border-0"
        onChange={setSelectedDate} // Set the selected date on change
        value={selectedDate} // Use the selected date state
      />
    </div>
  );
};

export default MyCalendar;
