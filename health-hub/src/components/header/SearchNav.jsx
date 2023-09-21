import React, { useState } from "react";
import { Teal } from "../../helpers/colors";
import { Link } from "react-router-dom";

const SearchNav = ({ patient }) => {
  const [query, setQuery] = useState({ text: "" });
  const [filteredPatients, setFilteredPatients] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

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
          {/* Here you should specify which patient you want to link to */}
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
