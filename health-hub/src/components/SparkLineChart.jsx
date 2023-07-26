import React from "react";
import { Sparklines, SparklinesLine } from "react-sparklines";

const SparkLineChart = ({ data, color }) => {

    


  return (
      
      <div>
      <Sparklines data={data} limit={20} width={100} height={30} margin={5}>
        <SparklinesLine color={color} />
      </Sparklines>
    </div>
  );
};

export default SparkLineChart;
