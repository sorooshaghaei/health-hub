import React from 'react';

import logo from "../assets/logo.png";




const Footer = () => {
  return (
    <footer style={{ background: 'linear-gradient(#3AA6B9, #ffffff)' }}>
      <div className="container-fluid py-3" >
        <div className="row">
          

          <div className="col">
          <img className="logo col-3 mx-2 align-items-left d-flex" src={logo} alt="Logo" />
          </div>

          <div className="col" >
          All rights reserved
           </div>

          <div className="col" >
          Contact us : 09000000000
           </div>
            


          </div>
        </div>
     
    </footer>
  );
};

export default Footer;
