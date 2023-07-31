import { Teal } from "../helpers/colors";

const SearchNav = () => {
  return (
    <div>
      <form className="d-flex">
        <input
          className="form-control me-2"
          type="search"
          placeholder="Search patients..."
          aria-label="Search"
        />
        <button className="btn text-white" style={{ backgroundColor: Teal }} type="submit">
           Search
        </button>
      </form>
    </div>
  );
};

export default SearchNav;
