import React from "react";
import { Route, Routes } from "react-router-dom";
import "../styles/HeaderStyle.css";

const Navbar = () => {
  return (
    <nav className="navbar navbar-light frosted-glass" style={{ backgroundColor: "#FFD0D0" }}>
      <div className="container">
        <div className="row w-100">
          <div className="col-2">
            <div className="row">
              <i className="fa fa-hard-of-hearing p-5">LOGO IS HERE</i>
            </div>
            <div className="row">
              {/* a user icon */}
              <i className="fa fa-user p-5">
                We Provide Better Care Experience For Patients And Providers
              </i>
            </div>
          </div>
          <div className="col-10">
            {/* routes for sign in and contact us and about and experties */}
            <Routes>
              <Route
                path="/signIn"
                element={<h1>Sign In</h1>} // replace this with Sign In component
              />
              <Route
                path="/contact"
                element={<h1>Contact us</h1>} // replace this with Contact component
              />
              <Route
                path="/about"
                element={<h1>About</h1>} // replace this with About component
              />
              <Route
                path="/experties"
                element={<h1>Expertise</h1>} // replace this with Expertise component
              />
            </Routes>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
