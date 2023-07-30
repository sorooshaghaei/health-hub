import React from "react";
import SpinnerGIF from "../assets/Spinner.gif";

const Spinner = () => {
  return (
    <>
      <img
        src={SpinnerGIF}
        alt="spinner"
        className="d-block m-auto"
        style={{ width: "200px", height: "200px" }}
      />
    </>
  );
};

export default Spinner;
