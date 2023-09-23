import React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";

const Appointments = ({ patient }) => {
  // Assuming patient.appointmentDate is a valid Date object, you can use it to set the appointment date on the calendar.
  const events = [
    {
      title: patient.name, // Display the patient's name as the event title
      start: new Date(patient.appointmentDate), // Use the patient's appointment date as the event start date
    },
  ];

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
        />
      </div>
    </div>
  );
};

export default Appointments;
