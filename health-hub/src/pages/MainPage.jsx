import { Footer, Navbar } from "../components";
import { Routes, Route, Navigate } from "react-router-dom";

import OveralVisitorsCard from "../components/OveralVisitorsCard";
import TotalPatientsCard from "../components/TotalPatientsCard";
import TotalSurgeriesCard from "../components/TotalSurgeriesCard";
import SparkLineChart from "../components/SparkLineChart";
import MyCalendar from "../components/MyCalendar";

const MainPage = () => {
  const data = [5, 10, 8, 15, 12, 6, 14, 18];

  return (
    <div>
      <Navbar />
      {/* Routes section */}
      <Routes>
        <Route path="/" element={<Navigate to="/Home" />} />
      </Routes>

      <div className="row my-5">
        <div className="col-6" style={{ justifyContent: "center" }}>
          <MyCalendar />
        </div>
        <div className="col-5" style={{ justifyContent: "center" }}>
          <h4>Sparkline Chart Example</h4>
          <SparkLineChart data={data} />
        </div>
      </div>

      <div className="content">
        <div className="cards-container row justify-content-center my-5">
          <div className=" visitor-card col-3 ">
            <OveralVisitorsCard />
          </div>
          <div className=" visitor-card col-3 ">
            <TotalPatientsCard />
          </div>
          <div className=" visitor-card col-3 ">
            <TotalSurgeriesCard />
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default MainPage;
