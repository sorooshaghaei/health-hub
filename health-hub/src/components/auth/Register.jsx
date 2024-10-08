import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LightPink, Salmon, Teal } from "../../helpers/colors";
import { saveRegistrationData } from "../../services/patientService";
import WarningMessage from "../WarningMessage"; // Import your warning message component

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    number: "",
    email: "",

    password: "",
    rePassword: "",
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

    if (formData.password !== formData.rePassword) {
      // Passwords do not match, show a warning
      setWarningMessage("Passwords do not match.");
      setShowWarning(true);
      return;
    }

    try {
      const response = await saveRegistrationData(formData);
      if (response.status === 201) {
        // Successful registration
        console.log("Registration successful:", response.data);
        navigate("/HomePage/login");
      } else {
        console.error("Registration failed:", response.data);
      }
    } catch (error) {
      console.error("Error during registration:", error);
    }

    // Clear the form data if needed
    setFormData({
      firstName: "",
      lastName: "",
      number: "",
      email: "",
      address: "",
      password: "",
      rePassword: "",
    });
  };

  return (
    <div className="container-fluid">
      <div className="row justify-content-center m-5">
        <div
          className="col-12 col-md-6 col-lg-4 rounded p-5"
          style={{ backgroundColor: LightPink }}
        >
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
              <label htmlFor="lastName">family name:</label>
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
              <label htmlFor="rePassword">Double check password:</label>
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
            {showWarning && (
              <WarningMessage
                message={warningMessage}
                onClose={() => setShowWarning(false)}
              />
            )}
            <button
              className="btn text-white"
              type="submit"
              style={{ backgroundColor: Teal }}
            >
              Submit
            </button>
          </form>
          <p className="mt-3">
            <span>Have an account?</span>
            <button
              className="btn btn-link"
              style={{ color: Salmon }}
              onClick={() => navigate("/HomePage/login")}
            >
              <b>Sign in here</b>
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
