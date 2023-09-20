import React, { useState } from "react";
import { Teal } from "../../helpers/colors";

const SearchNav = () => {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([]);

  const handleInputChange = (event) => {
    const searchText = event.target.value.toLowerCase();
    const searchedPatients = patients.filter((patient) =>
      patient.name.toLowerCase().includes(searchText)
    );
    setQuery(event.target.value);
    setPatients(searchedPatients);
  };

  return (
    <div>
      <form className="d-flex">
        <input
          value={query}
          onChange={handleInputChange}
          className="form-control me-2"
          type="search"
          placeholder="Search patients..."
          aria-label="Search"
        />

        {patients.map((patient) => (
          <div key={patient.id}>{patient.name}</div>
        ))}
        <button
          className="btn text-white"
          style={{ backgroundColor: Teal }}
          type="submit"
        >
          Search
        </button>
      </form>
    </div>
  );
};

export default SearchNav;
