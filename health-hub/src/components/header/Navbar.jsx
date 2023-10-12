import React from "react";
import logo from "../../assets/logo.png";

import "../../styles/HeaderStyle.css";
import { LightPink } from "../../helpers/colors";
import SearchNav from "./SearchNav";
import Avatar from "./Avatar";
import { Link } from "react-router-dom";

const Navbar = ({ patient }) => {
  return (
    <nav
      className="navbar frosted-glass"
      style={{ backgroundColor: LightPink }}
    >
      <div className="container-fluid">
        <Link to={"./HomePage"} className="col-md-1 col-2 mx-2">
          <img className="logo img-fluid" src={logo} alt="Logo" />
        </Link>

        <div className="col-md-4 col-5">
          <SearchNav patient={patient} />
        </div>

        <div className="mx-2">
          <Avatar />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
