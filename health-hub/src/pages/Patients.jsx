import React from "react";
import { Navbar } from "../components";

const Patients = () => {
  return (
    <div>
      <Navbar />









































      <div className="container mt-5 mb-5 ">
        <table class="table table-hover dropshadow">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">NAME</th>
              <th scope="col">AGE</th>
              <th scope="col">TIME</th>
              <th scope="col">CREATED DAY</th>
              <th scope="col">STATUS</th>
              <th scope="col">ACTION</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    value=""
                    id="flexCheckIndeterminate"
                  />
                  <label
                    className="form-check-label"
                    for="flexCheckIndeterminate"
                  ></label>
                </div>
              </th>
              <td>Mark</td>
              <td>Otto</td>
              <td>@mdo</td>
            </tr>
            <tr>
              <th scope="row">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    value=""
                    id="flexCheckIndeterminate"
                  />
                  <label
                    className="form-check-label"
                    for="flexCheckIndeterminate"
                  ></label>
                </div>
              </th>
              <td>Jacob</td>
              <td>Thornton</td>
              <td>@fat</td>
            </tr>
            <tr>
              <th scope="row">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    value=""
                    id="flexCheckIndeterminate"
                  />
                  <label
                    className="form-check-label"
                    for="flexCheckIndeterminate"
                  ></label>
                </div>
              </th>
              <td colspan="2">Larry the Bird</td>
              <td>@twitter</td>
            </tr>
          </tbody>
        </table>
      </div>



















































    </div>
  );
};

export default Patients;
