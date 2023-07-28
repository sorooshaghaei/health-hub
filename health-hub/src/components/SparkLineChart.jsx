import React from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";
import { Teal } from "../helpers/colors";

const data = [5, 10, 8, 15, 12, 6, 14, 10];

const SparkLineChart = ({ data }) => {

    
  return (
      
      <div> 
      <Sparklines data={data} limit={20} width={400} height={210} margin={5}  >
        <SparklinesLine color={Teal} />
      </Sparklines>
    </div>
  );
};

export default SparkLineChart;
