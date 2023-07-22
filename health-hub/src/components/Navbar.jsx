import { React } from "react";

import { Route, Routes, Navigate } from "react-router-dom";

import "../styles/HeaderStyle.css";
import logo from "../assets/logo.png";

// importing colors
import { SlightlyDarkerGray, White } from "../helpers/colors";
import SearchNav from "./SearchNav";

const Navbar = () => {
  return (
    <nav
      className="navbar navbar-light frosted-glass"
      style={{ backgroundColor: "#FFD0D0" }}
    >
      {/* Routes section */}
      <Routes>
        <Route path="/" element={<Navigate to="/Home" />} />
      </Routes>

      <div className="container">
        <div className="row">
          {/* Logo and tagline section */}
          <div className="col-md-3 col-12 mt-3 ">
            <img
              className="logo col-9"
              src={logo}
              alt="Logo"
              style={{ float: "left" }}
            />
          </div>

          <div>
            <h3
              className="tagline mt-5 col-5"
              style={{ textAlign: "left", color: SlightlyDarkerGray }}
            >
              We Provide Better Care Experience For Patients And Providers
            </h3>
          </div>

          {/* Search bar and dropdown section */}
          <div
            className="p-3 rounded mt-5 mb-5"
            style={{ backgroundColor: White }}
          >
            {/* Search label */}
            <label htmlFor="basic-url" className="search-label p-2">
              <i
                className="fa fa-search search-icon"
                style={{ color: SlightlyDarkerGray }}
              ></i>
              <span
                className="search-text"
                style={{ color: SlightlyDarkerGray }}
              >
                <b>Search physicians, specialists, or clinics</b>
              </span>
            </label>
            <div className="p-2">
              <SearchNav />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
