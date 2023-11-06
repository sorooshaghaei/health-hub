import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LightPink, Salmon, Teal } from "../../helpers/colors";
import image from "../../assets/File-1.png";
import axios from "axios";
import WarningMessage from "../WarningMessage"; // Import your warning message component

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
  });

  const [showWarning, setShowWarning] = useState(false); // State to control the visibility of the warning message
  const [warningMessage, setWarningMessage] = useState(""); // Warning message content

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      
      const response = await axios.get("http://localhost:9000/users");
      const users = response.data;

      const { firstName, lastName, password } = formData;

      const user = users.find(
        (u) => u.firstName === firstName && u.lastName === lastName && u.password === password
      );

      if (user) {
        // Validation successful, navigate to Dashboard
        console.log("Login successful. Redirecting...");
        navigate("/Dashboard");
      } else {
        // Validation failed, show an error message
        setWarningMessage("User not found or incorrect password.");
        setShowWarning(true);
      }
    } catch (error) {
      console.error("Error during login:", error);
    }
  };

  return (
    <div className="row justify-content-center m-5">
      <div className="col-12 col-md-6 col-lg-5 d-flex">
        <img src={image} alt="img" />
      </div>
      <div className="col-12 col-md-6 col-lg-4 rounded p-5" style={{ backgroundColor: LightPink }}>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label htmlFor="firstName">Name:</label>
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
            <label htmlFor="lastName">Family Name:</label>
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
            <label htmlFor="password">Password:</label>
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
      {showWarning && <WarningMessage message={warningMessage} onClose={() => setShowWarning(false)} />}
    </div>
  );
};

export default Login;
