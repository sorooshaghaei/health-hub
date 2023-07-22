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

// for using spinner:

// 1- import { useState } from 'react';
// import spinner from '../assets/Spinner.gif';
// 2- const [loading, setLoading] = useState(false);
// 3- <Login loading={loading} />

// 4- in Login(), give it the loading prop
// import spinner from '../assets/Spinner.gif';
// koja ejra beshe? --> unja ke mikhad taqir kone. qablesh ye {} baz mikonim 
// va toosh minevisi-->  loading ? <sponner /> : (inja kole code miad ke age load ejra nashe bayad ejra beshe)
