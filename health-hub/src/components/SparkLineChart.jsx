import React from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { Teal } from "../helpers/colors";


const SparkLineChart = ({ data }) => {
  
  return (
      
      <div> 
      <Sparklines data={data} limit={20} width={400} height={310} margin={5}  >
        <SparklinesLine color={Teal} />
      </Sparklines>
    </div>
  );
};

export default SparkLineChart;
