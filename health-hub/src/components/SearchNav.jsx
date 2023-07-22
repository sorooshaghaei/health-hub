import React, { useState } from "react";
import { Teal } from "../helpers/colors";

const SearchNav = () => {
  const [selectedCity, setSelectedCity] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const cities = [
    "All Cities",
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Miami",
  ];

  const handleCityChange = (event) => {
    setSelectedCity(event.target.value);
  };

  const handleSearch = () => {
    // Perform the search based on the selected city and search query
    console.log("Searching for:", searchQuery, "in city:", selectedCity);
    // Your search logic goes here...
  };

  return (
    <div className="search-nav">
      <div className="input-group">
        {/* City dropdown */}
        <div className="dropdown">
          <button
            className="btn dropdown-toggle text-white"
            type="button"
            id="dropdownMenuButton"
            data-toggle="dropdown"
            aria-haspopup="true"
            aria-expanded="false"
            style={{ backgroundColor: Teal }}
            onClick={handleCityChange}
          >
            {selectedCity}  <i className="fa fa-map-marker text-white"></i> All City
          </button>
          <div className="dropdown-menu" aria-labelledby="dropdownMenuButton">
            {cities.map((city) => (
              <button key={city} onClick={() => handleCityChange(city)}>
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <input
          type="text"
          className="form-control"
          id="basic-url"
          placeholder="Search..."
          aria-describedby="basic-addon3"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClick={handleSearch}
        />
      </div>
    </div>
  );
};

export default SearchNav;
