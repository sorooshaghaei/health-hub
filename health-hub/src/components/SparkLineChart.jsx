import React from "react";
import { Sparklines, SparklinesLine, SparklinesSpots } from "react-sparklines";
import { Salmon, Teal } from "../helpers/colors";
import "../styles/SparklineChart.css";

const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const SparkLineChart = ({ data, title }) => {
  const xValues = monthNames; // Month names for x-axis
  const yValues = data; // Patient counts for y-axis

  return (
    <div className="sparkline-container">
      {title && <h2>{title}</h2>}
      <div className="chart-wrapper">
        <Sparklines data={yValues} height={80} width={120} lineColor={Teal} xvalues={xValues} yvalues={yValues}>
          <SparklinesLine color={Salmon} />
          <SparklinesSpots style={{ fill: Salmon }} />
        </Sparklines>
      </div>
      <div className="month-list">
        {monthNames.map((month, index) => (
          <div className="month-item" key={index}>
            <span className="month-name">{month}</span>
            <span className="patient-count">{data[index]}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SparkLineChart;
