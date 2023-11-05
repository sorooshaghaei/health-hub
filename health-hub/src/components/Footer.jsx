import React from "react";

import logo from "../assets/logo.png";

const Footer = () => {
  return (
    <footer style={{ background: "linear-gradient(#3AA6B9, #ffffff)" }}>
      <div className="container-fluid py-3">
        <div className="row align-items-center text-white">
          <div className="col-md-3 col-sm-6 d-flex justify-content-center">
            <img
              className="logo mx-2 align-items-left"
              src={logo}
              alt="Logo"
              style={{ height: "50px" }}
            />
          </div>

          <div className="col-md-6 col-sm-6 d-flex justify-content-center">
            <p className="m-0 text-black">All rights reserved</p>
          </div>

          <div className="col-md-3 col-sm-6 d-flex justify-content-center">
            <p className="m-0 text-black">Contact us: 09000000000</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
