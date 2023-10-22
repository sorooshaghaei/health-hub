import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Salmon, Teal } from "../../helpers/colors";

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    number: "",
    email: "",
    address: "",
    password: "",
    rePassword: "",
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
    <div className="container">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="firstName">name:</label>
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
              <label htmlFor="lastName">familyname:</label>
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
              <label htmlFor="number">phone number:</label>
              <input
                type="text"
                className="form-control"
                id="number"
                name="number"
                value={formData.number}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="email">email:</label>
              <input
                type="email"
                className="form-control"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="address">address:</label>
              <input
                type="text"
                className="form-control"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
              />
            </div>
            <div className="mb-3">
              <label htmlFor="password">password</label>
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
            <div className="mb-3">
              <label htmlFor="rePassword">double check password</label>
              <input
                type="password"
                className="form-control"
                id="rePassword"
                name="rePassword"
                value={formData.rePassword}
                onChange={handleChange}
                required
              />
            </div>
            <button
              className="btn text-white"
              type="submit"
              style={{ backgroundColor: Teal }}
            >
              submit
            </button>
          </form>
          <p className="mt-3">
            <span>Have an account?</span>
            <button
              className="btn btn-link"
              style={{ color: Salmon }}
              onClick={() => navigate("/HomePage/login")}
            >
              <b>sign in here</b>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
