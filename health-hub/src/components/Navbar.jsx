import React from "react";
// import { Routes, Route, Navigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { SearchNav, Avatar } from "../components";



import "../styles/HeaderStyle.css";
import { LightPink } from "../helpers/colors";



const Navbar = () => {
  return (
    <nav className="navbar frosted-glass" style={{backgroundColor: LightPink}} >
      <div className="container-fluid">
        <div className="col-md-1 col-2 mx-2">
          <img className="logo img-fluid" src={logo} alt="Logo" />
        </div>

        <div className="col-md-4 col-5">
          <SearchNav />
        </div>

        <div className="mx-2">
          <Avatar />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
