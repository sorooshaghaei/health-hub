import OveralVisitorsCard from "../components/cards/OveralVisitorsCard";
import TotalPatientsCard from "../components/cards/TotalPatientsCard";
import TotalSurgeriesCard from "../components/cards/TotalSurgeriesCard";
import SparkLineChart from "../components/SparkLineChart";
import MyCalendar from "../components/MyCalendar";

const MainPage = () => {
  const data = [5, 10, 8, 15, 12, 6, 14, 18];

  return (
    <div>
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
    </div>
  );
};

export default MainPage;
