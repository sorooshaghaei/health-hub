import { Footer, Navbar } from "../components";


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
      <div className="container-fluid ">
        <div className="row my-5 justify-content-center">
          <div className="col-3 mx-5">
            <MyCalendar />
          </div>
          <div className="col-4 mx-5">
            <div className="card rounded shadow border-0 ">
              <SparkLineChart data={data} />
            </div>
          </div>
        </div>

        <div className="row justify-content-center my-5">
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