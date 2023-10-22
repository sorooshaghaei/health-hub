import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Salmon, Teal } from "../../helpers/colors";

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
              <label htmlFor="password">password:</label>
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
              login
            </button>
          </form>
          <p className="mt-3">
            do not have an account?
            <button
              className="btn btn-link"
              style={{ color: Salmon }}
              onClick={() => navigate("/HomePage/Register")}
            >
              <b>register here</b>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
