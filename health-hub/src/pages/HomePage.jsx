import React from "react";
import { LightTeal, Salmon} from "../helpers/colors";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div>
      <Link to={"./Register"} className="btn rounded m-5 text-white" style={{ backgroundColor: LightTeal }}>
        <i className="fa fa-user-plus"></i> register
      </Link>
      <Link to={"./Login"} className="btn rounded m-5 text-white" style={{ backgroundColor: Salmon }}>
        <i className="fa fa-sign-in"></i> log in
      </Link>
    </div>
  );
};

export default HomePage;
