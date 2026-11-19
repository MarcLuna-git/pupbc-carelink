import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter, Search } from 'lucide-react';

/*
 * The one search box + "Filter" menu used across the student portal
 * (Health Records, Appointment History, Announcements) so every list
 * is searched and filtered the same way.
 */

export const SearchField = ({ value, onChange, placeholder = 'Search...', label = 'Search', className = '' }) => (
  <div className={`relative min-w-0 flex-1 ${className}`}>
    <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={label}
      className="h-10 w-full rounded-[10px] border border-[var(--sp-border)] bg-gray-50 pl-10 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:bg-gray-900/30 dark:text-white"
    />
  </div>
);

/*
 * `fields`: [[key, label, [[value, text], ...]], ...]. `defaults` holds each
 * key's "no filter" value; the badge counts the keys that differ from it.
 */
export const FilterMenu = ({ fields, values, defaults, onChange, onReset }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const activeCount = fields.filter(([key]) => values[key] !== defaults[key]).length;

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--sp-border)] px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700 sm:w-auto"
      >
        <Filter className="h-4 w-4" />
        Filter
        {activeCount > 0 && <span className="rounded-full bg-maroon-800 px-1.5 text-xs text-white">{activeCount}</span>}
        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 space-y-3 rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-4 shadow-lg sm:left-auto sm:w-64">
          {fields.map(([key, label, options]) => (
            <label key={key} className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</span>
              <select
                value={values[key]}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>
            </label>
          ))}
          {activeCount > 0 && (
            <button type="button" onClick={onReset} className="text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300">
              Reset filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};
