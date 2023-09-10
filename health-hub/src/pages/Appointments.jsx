import React from "react";
import FullCalendar from "@fullcalendar/react";
import daygridPlugin from "@fullcalendar/daygrid";

const Appointments = () => {
  return (
    <div>
      <div className="m-5">
        <FullCalendar
          headerToolbar={{
            start: "today prev next",
            end: "dayGridMonth dayGridWeek dayGridDay",
          }}
          plugins={[daygridPlugin]}
          views={["dayGridMonth", "dayGridWeek", "dayGridDay"]}
        />
      </div>
    </div>
  );
};

export default Appointments;
