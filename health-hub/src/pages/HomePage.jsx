import React, { useState, useEffect } from "react";
import { LightTeal, Salmon } from "../helpers/colors";
import { Link } from "react-router-dom";

import mainpage1 from "../assets/File-5.png";
import mainpage2 from "../assets/File-6.png";
import "../styles/HomePage.css"; // Import your CSS file for styling

const HomePage = () => {
  // Define your images and current image index using the state.
  const images = [mainpage1, mainpage2];
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Function to show the next image.
  const nextImage = () => {
    setCurrentImageIndex((currentImageIndex + 1) % images.length);
  };

  // Function to show the previous image.
  const previousImage = () => {
    setCurrentImageIndex(
      (currentImageIndex - 1 + images.length) % images.length
    );
  };

  // Use the useEffect hook to create an interval for image rotation.
  useEffect(() => {
    const interval = setInterval(nextImage, 6000);

    // Cleanup the interval when the component unmounts.
    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line
  }, []);

  return (
    <div className="carousel slide">
      <div className="carousel-inner p-5">
        {images.map((image, index) => (
          <div
            className={`carousel-item ${index === currentImageIndex ? "active" : ""}`}
            key={index}
          >
            <img src={image} alt={`Slide ${index}`} className="d-block w-100" />
          </div>
        ))}
      </div>
      <a
        className="carousel-control-prev"
        href="#myCarousel"
        role="button"
        data-slide="prev"
        onClick={previousImage}
      >
        <span className="carousel-control-prev-icon" aria-hidden="true" />
        <span className="sr-only">Previous</span>
      </a>
      <a
        className="carousel-control-next"
        href="#myCarousel"
        role="button"
        data-slide="next"
        onClick={nextImage}
      >
        <span className="carousel-control-next-icon" aria-hidden="true" />
        <span className="sr-only">Next</span>
      </a>
      <div className="carousel-content">
        <h2 className="text-center">
          We Provide a Better Care Experience For Patients And Providers
        </h2>
        <div className="text-center m-5">
          <Link
            to={"./Register"}
            className="btn rounded text-white mx-2"
            style={{ backgroundColor: LightTeal }}
          >
            <i className="fa fa-user-plus"></i> Register
          </Link>
          <Link
            to={"./Login"}
            className="btn rounded text-white mx-2"
            style={{ backgroundColor: Salmon }}
          >
            <i className="fa fa-sign-in"></i> Log In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
