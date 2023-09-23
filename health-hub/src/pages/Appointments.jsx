import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { Teal } from "../helpers/colors";

const Appointments = ({ patients }) => {
  // Create events from the list of patients
  const events = patients.map((patient) => ({
    title: `${patient.name} (${patient.idNumber})`, // Display the patient's name and idNumber as the event title
    start: new Date(patient.appointmentDate), // Use the patient's appointment date as the event start date
    backgroundColor: Teal, // Set the event background color to Teal
  }));

  const renderEventContent = ({ event }) => {
    return (
      <>
        <b>{event.title}</b>
      </>
    );
  };

  return (
    <div>
      <div className="m-5">
        <FullCalendar
          headerToolbar={{
            start: "today prev next",
            end: "dayGridMonth dayGridWeek dayGridDay",
          }}
          plugins={[dayGridPlugin]}
          views={["dayGridMonth", "dayGridWeek", "dayGridDay"]}
          initialView="dayGridMonth"
          weekends={true}
          events={events}
          eventContent={renderEventContent}
          eventDisplay="block" // Ensure that event display is set to "block" to allow background color to take effect
        />
      </div>
    </div>
  );
};

export default Appointments;
