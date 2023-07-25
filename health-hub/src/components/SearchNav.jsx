import { Teal } from "../helpers/colors";

const SearchNav = () => {
  return (
    <div>
      <form class="d-flex">
        <input
          class="form-control me-2"
          type="search"
          placeholder="Search patients..."
          aria-label="Search"
        />
        <button class="btn text-white" style={{ backgroundColor: Teal }} type="submit">
           Search
        </button>
      </form>
    </div>
  );
};

export default SearchNav;
