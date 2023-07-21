import React from "react";
import { Route, Routes } from "react-router-dom";
import "../styles/HeaderStyle.css";
import logo from "../assets/logo.png";

const Navbar = () => {
  return (
    <nav
      className="navbar navbar-light frosted-glass"
      style={{ backgroundColor: "#FFD0D0" }}
    >
      <div className="container">
        <div className="row w-100">
          {/* Logo and tagline section */}
          <div className="col-3 mt-3">
          <img className="logo w-50 " src={logo} alt="Logo" />
            <h3 className="tagline mt-5">
              We Provide Better Care Experience For Patients And Providers
            </h3>
          </div>

          {/* Search bar and dropdown section */}
          <div
            className="p-3 rounded mt-5 mb-5"
            style={{ backgroundColor: "#ffffff" }}
          >
            {/* Search label */}
            <label htmlFor="basic-url" className="search-label p-2">
              <i className="fa fa-search search-icon"></i>
              <span className="search-text">
                <b>Search physicians, specialists, or clinics</b>
              </span>
            </label>

            <div className="input-group mb-3">
              <div className="input-group-prepend">
                {/* Dropdown */}
                <div className="dropdown">
                  <button
                    className="btnColor btn dropdown-toggle text-white"
                    type="button"
                    id="dropdownMenuButton"
                    data-toggle="dropdown"
                    aria-haspopup="true"
                    aria-expanded="false"
                  >
                    <i className="fa fa-map-marker text-white"></i> All Cities
                  </button>
                  {/* Dropdown menu */}
                  <div
                    className="dropdown-menu"
                    aria-labelledby="dropdownMenuButton"
                  ></div>
                </div>
              </div>
              {/* Search input */}
              <input
                type="text"
                className="form-control"
                id="basic-url"
                placeholder="Search..."
                aria-describedby="basic-addon3"
              />
            </div>
          </div>

          {/* Routes section */}
          <div className="col-10">
            {/* Define routes for sign in, contact us, about, and expertise */}
            <Routes>
              <Route path="/signIn" element={<h1>Sign In</h1>} />
              <Route path="/contact" element={<h1>Contact us</h1>} />
              <Route path="/about" element={<h1>About</h1>} />
              <Route path="/experties" element={<h1>Expertise</h1>} />
            </Routes>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
