import React from "react";
import { Link } from "react-router-dom"; // Import the Link component
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { Teal, LightPink, DarkGray } from "../helpers/colors";

const Appointments = ({ patients }) => {
  // Create events from the list of patients
  const events = patients.map((patient) => ({
    title: `${patient.name} (${patient.idNumber})`,
    start: new Date(patient.appointmentDate),
    backgroundColor: Teal,
    id: patient.id, // Assign the patient's ID to the 'id' property
  }));

  const renderDayCellContent = ({ date }) => {
    return (
      <div className="btn" style={{ color: DarkGray }}>
        {date.getDate()}
      </div>
    );
  };

  const renderDayHeaderContent = ({ text }) => {
    return (
      <div style={{ padding: "5px", color: DarkGray }}>
        <span className="text-decoration-none">{text}</span>
      </div>
    );
  };

  const renderEventContent = ({ event }) => {
    // Create a Link to the patient's page using the patient's ID
    return (
      <Link to={`/Patients/${event.id}`}>
        <div className="btn btn-sm text-white">
          <p>{event.title}</p>
        </div>
      </Link>
    );
  };

  return (
    <div>
      <style>
        {`
          .fc-dayGridMonth-view .fc-scrollgrid-section-header {
            background-color: ${LightPink};
          }
        `}
      </style>
      <div className="m-5">
        <FullCalendar
          headerToolbar={{
            start: "prev today next",
            end: "dayGridMonth dayGridWeek dayGridDay",
          }}
          plugins={[dayGridPlugin]}
          views={["dayGridMonth", "dayGridWeek", "dayGridDay"]}
          initialView="dayGridMonth"
          weekends={true}
          events={events}
          eventContent={renderEventContent}
          eventDisplay="block"
          dayCellContent={renderDayCellContent}
          dayHeaderFormat={{ weekday: "short" }}
          dayHeaderClassNames="text-dark font-weight-bold"
          dayHeaderContent={renderDayHeaderContent}
        />
      </div>
    </div>
  );
};

export default Appointments;
