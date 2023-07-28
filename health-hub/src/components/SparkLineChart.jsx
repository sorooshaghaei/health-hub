import React from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { Teal } from "../helpers/colors";


const SparkLineChart = ({ data }) => {
  
  return (
      
      <div className="mt-3"> 
      <Sparklines data={data} height={120} width={180} lineColor={Teal}  >
        <SparklinesLine color={Teal} />
      </Sparklines>
    </div>
  );
};

export default SparkLineChart;
