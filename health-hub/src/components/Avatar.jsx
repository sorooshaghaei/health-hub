import React from "react";
import avatar from "../assets/Avatar.png";

const Avatar = () => {
  return (
    // Wrap the Avatar component inside a navbar container
    <nav className="navbar navbar-expand-lg">
 
        {/* <!-- Avatar --> */}
        <ul className="navbar-nav">
          <li className="nav-item dropstart">
            <a
              className="nav-link dropdown-toggle  "
              href="#"
              id="avatarDropdown"
              role="button"
              data-bs-toggle="dropdown"
            
            >
              <img src={avatar} height="48" alt="Avatar" loading="lazy" />
            </a>
            <ul className="dropdown-menu " aria-labelledby="avatarDropdown">
              <li>
                <a className="dropdown-item" href="#">
                  My profile
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="#">
                  Patients
                </a>
              </li>
              <li>
                <a className="dropdown-item" href="#">
                  Appointments
                </a>
              </li>
            </ul>
          </li>
        </ul>
     
    </nav>
  );
};

export default Avatar;
