import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

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
    <div className="">
      <div className=" top-0">
        <form onSubmit={handleSubmit}>
          <div className="">
            <label>نام:</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="">
            <label>نام خانوادگی:</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="">
            <label>شماره تماس:</label>
            <input
              type="text"
              name="number"
              value={formData.number}
              onChange={handleChange}
              required
            />
          </div>
          <div className="">
            <label>ایمیل:</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="">
            <label>آدرس:</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          <div className="">
            <label>رمز عبور:</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="">
            <label>تکرار رمز عبور:</label>
            <input
              type="password"
              name="rePassword"
              value={formData.rePassword}
              onChange={handleChange}
              required
            />
          </div>
          <button className="" type="submit">
            ثبت
          </button>
        </form>
        <p className="" onClick={() => navigate("/HomePage/login")}>
          وارد حساب کاربری شوید
        </p>
      </div>
      <div className="">
        {/* <img className="auth_img" src="https://img.freepik.com/free-photo/flat-lay-medicinal-spices-herbs_23-2148776461.jpg?w=1380&t=st=1693006414~exp=1693007014~hmac=8825f8f79ef1f2a96e55bf2efeeef6dbe0f26d53e2b4606a3dbbf282bedb5116" alt="" /> */}
      </div>
    </div>
  );
};

export default Register;
