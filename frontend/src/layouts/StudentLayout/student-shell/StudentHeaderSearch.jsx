import { Search } from 'lucide-react';

/*
 * Header search field (with the Ctrl/⌘-K hint).
 *
 * Shared by the desktop header and the mobile header. On mobile the field is
 * hidden by CSS until `searchOpen` adds the `is-open` class, at which point it
 * drops below the header as an overlay.
 */
const StudentHeaderSearch = ({
  query,
  setQuery,
  searchOpen,
  setSearchOpen,
  searchRef,
  onSubmit,
}) => (
  <form
    className={`student-header-search ${searchOpen ? 'is-open' : ''}`}
    onSubmit={onSubmit}
    role="search"
  >
    <Search aria-hidden="true" />

    <input
      ref={searchRef}
      type="search"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      aria-label="Search appointments"
      placeholder="Search services or appointments…"
    />

    <kbd>Ctrl K</kbd>

    <button
      type="button"
      className="student-search-close"
      onClick={() => setSearchOpen(false)}
      aria-label="Close search"
    >
      ×
    </button>
  </form>
);

export default StudentHeaderSearch;
