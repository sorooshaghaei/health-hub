import React, { useState } from "react";
import { Teal } from "../../helpers/colors";
import { Link } from "react-router-dom";

const SearchNav = ({ patient }) => {
  const [query, setQuery] = useState({ text: "" });
  const [patients, setPatients] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // const handleInputChange = (event) => {
  //   setQuery({ ...query, text: event.target.value });
  //   const allPatients = patient.filter((p) => {
  //     return p.name.toLowerCase().includes(event.target.value.toLowerCase());
  //   });

  //   setPatients(allPatients);
  //   setShowDropdown(true); // Show the dropdown when there are search results.
  // };
  const handleInputChange = (event) => {
    setQuery({ ...query, text: event.target.value });
    const allPatients = patient.filter((p) => {
      return p.name.toLowerCase().includes(event.target.value.toLowerCase());
    });
  
    setPatients(allPatients);
  
    // Add the conditional check here to hide the dropdown when input is null.
    if (event.target.value === null) {
      setShowDropdown(false);
    } else {
      setShowDropdown(true); // Show the dropdown when there are search results.
    }
  };

  const handlePatientClick = (selectedPatient) => {
    setQuery({ text: selectedPatient.name });
    setShowDropdown(false); // Hide the dropdown when a patient is selected.
    
  };

  return (
    <div>
      <form className="row">
        <div className="col-9">
          <input
            value={query.text}
            onChange={handleInputChange}
            className="form-control"
            type="search"
            placeholder="Search patients..."
            aria-label="Search"
          />

          {showDropdown && patients.length > 0 && (
            <div className="dropdown">
              <ul className="dropdown-menu" style={{ display: "block" }}>
                {patients.map((patient) => (
                  <li
                    key={patient.id}
                    className="dropdown-item "
                    onClick={() => handlePatientClick(patient)}
                  >
                    {patient.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="col-3">
          <Link
            to={`/Patients/${patient.id}`}
            className="btn text-white"
            style={{ backgroundColor: Teal }}
            type="submit"
          >
            Search
          </Link>
        </div>
      </form>
    </div>
  );
};

export default SearchNav;
