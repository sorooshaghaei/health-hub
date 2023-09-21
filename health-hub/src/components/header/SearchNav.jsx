import React, { useState } from "react";
import { Teal } from "../../helpers/colors";
import { Link } from "react-router-dom";

const SearchNav = ({ patient }) => {
  const [query, setQuery] = useState({ text: "" });
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const handleInputChange = (event) => {
    const searchText = event.target.value;
    setQuery({ text: searchText });

    // Filter patients based on the search text
    const filteredPatients = patient.filter((patient) => {
      return patient.name.toLowerCase().includes(searchText.toLowerCase());
    });

    setFilteredPatients(filteredPatients);

    // Check if the input is null and set showDropdown accordingly
    setShowDropdown(searchText !== "");
  };

  const handlePatientClick = (selectedPatient) => {
    setQuery({ text: selectedPatient.name });
    setShowDropdown(false); // Hide the dropdown when a patient is selected.
    setSelectedPatient(selectedPatient); // Set the selected patient
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

          {showDropdown && filteredPatients.length > 0 && (
            <div className="dropdown">
              <ul className="dropdown-menu" style={{ display: "block" }}>
                {filteredPatients.map((patient) => (
                  <li
                    key={patient.id}
                    className="dropdown-item patient-item"
                    onClick={() => handlePatientClick(patient)}
                  >
                    <div className="row ">
                      <div className="col" style={{ fontSize: "14px" }}>
                        {patient.name}
                      </div>
                      <div className="col" style={{ fontSize: "14px" }}>
                        {patient.phone}
                      </div>

                      <hr
                        style={{
                          borderTop: "2px solid ",
                          margin: "5px 0",
                          color: Teal,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="col-3">
          {/* Always render the search button ===> ba komak in: ?.id || ""  */}
          <Link
            to={`patients/${selectedPatient?.id || ""}`}
            className="btn text-white"
            style={{ backgroundColor: Teal }}
          >
            Search
          </Link>
        </div>
      </form>
    </div>
  );
};

export default SearchNav;
