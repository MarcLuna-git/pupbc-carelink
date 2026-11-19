import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import academics from '../../../data/registration-academics.json';
import useAcademicCatalog from '../../../hooks/useAcademicCatalog';

/*
 * Batch Release → "Group / Section": a search box with a dropdown of the courses and sections from
 * Course Management, plus the older catalog (the same two sources as the Students page filters).
 * The nurse may still type a group that is not a section, such as an organization or a team.
 */
const byText = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

export const sectionOptions = (catalog) => {
  const courses = new Map(); // code → { name, sections: Map(section → year) }
  const add = (code, name, section, year) => {
    if (!code) return;
    if (!courses.has(code)) courses.set(code, { name: name || '', sections: new Map() });
    const course = courses.get(code);
    if (name && !course.name) course.name = name;
    if (section && !course.sections.has(section)) course.sections.set(section, year || '');
  };
  catalog.forEach(({ code, name, sections = [] }) => {
    add(code, name);
    sections.forEach((entry) => add(code, name, entry.section, entry.year));
  });
  academics.forEach(({ code, name, sections = [] }) => {
    add(code, name);
    sections.forEach((section) => add(code, name, section));
  });

  return [...courses.entries()].sort(([a], [b]) => byText(a, b)).flatMap(([code, { name, sections }]) => [
    { label: code, hint: name },
    ...[...sections.entries()].sort(([a], [b]) => byText(a, b)).map(([section, year]) => ({ label: `${code} ${section}`, hint: year || name })),
  ]);
};

export default function BatchSectionField({ id, name, value, onChange, className, placeholder, maxLength, ...aria }) {
  const catalog = useAcademicCatalog();
  const options = useMemo(() => sectionOptions(catalog), [catalog]);
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false); // only narrow the list once the nurse types
  const [active, setActive] = useState(-1);

  const query = filtering ? String(value || '').trim().toLowerCase() : '';
  const shown = query ? options.filter((option) => `${option.label} ${option.hint}`.toLowerCase().includes(query)) : options;
  const listId = `${id}-options`;

  const close = () => { setOpen(false); setActive(-1); };
  const pick = (option) => { onChange(name, option.label); setFiltering(false); close(); };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!shown.length) return;
      setOpen(true);
      setActive((current) => (current + (e.key === 'ArrowDown' ? 1 : -1) + shown.length) % shown.length);
    } else if (e.key === 'Enter' && open && shown[active]) {
      e.preventDefault();
      pick(shown[active]);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div className="relative">
      <input
        {...aria}
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={(e) => { onChange(name, e.target.value); setFiltering(true); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => { close(); setFiltering(false); }, 150)}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        className={`${className} pr-9`}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
      {open && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
          {shown.length ? shown.map((option, index) => (
            <li
              key={option.label}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={option.label === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(option)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50 ${index === active ? 'bg-gray-50 dark:bg-gray-700/50' : ''} ${option.label === value ? 'font-semibold text-maroon-800 dark:text-maroon-200' : ''}`}
            >
              <span className="shrink-0">{option.label}</span>
              <span className="min-w-0 truncate text-xs font-normal text-gray-500 dark:text-gray-400">{option.hint}</span>
            </li>
          )) : (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No matching section. What you typed will be used as the group name.</li>
          )}
        </ul>
      )}
    </div>
  );
}
