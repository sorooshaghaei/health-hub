import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LightPink, Salmon, Teal } from "../../helpers/colors";

import image from "../../assets/File-1.png";

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Here you can handle the form submission, validation, etc.
    console.log(formData);
  };

  return (
    <div className="row justify-content-center m-5">
      <div className="col-12 col-md-6 col-lg-5 d-flex"> {/* Adjust column sizes */}
        <img src={image} alt="img" />
      </div>
      <div className="col-12 col-md-6 col-lg-4 rounded p-5" style={{ backgroundColor: LightPink }}> {/* Adjust column sizes */}
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="firstName">Name:</label> {/* Changed label text to be capitalized */}
            <input
              type="text"
              className="form-control"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="lastName">Family Name:</label> {/* Changed label text to be capitalized */}
            <input
              type="text"
              className="form-control"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="mb-3">
            <label htmlFor="password">Password:</label> {/* Changed label text to be capitalized */}
            <input
              type="password"
              className="form-control"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <button
            type="submit"
            className="btn text-white rounded"
            style={{ backgroundColor: Teal }}
          >
            Login
          </button>
        </form>
        <p className="mt-3">
          Do not have an account?
          <button
            className="btn btn-link"
            style={{ color: Salmon }}
            onClick={() => navigate("/HomePage/Register")}
          >
            <b>Register here</b>
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
