import { useState } from 'react';
import { CalendarDays, Eye, Trash2, Search, SlidersHorizontal, Users, X, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { mediaUrl } from '../../../utils/mediaUrl';
import { pageWindow } from '../../../utils/pageWindow';
import { academic, appliedDirectoryFilters, directoryCourses, directoryDefaultFilters, directoryStatusOptions, years, directorySectionsForYear, fullName, focus, inputStyle, secondary } from './directoryOptions';
import useAcademicCatalog from '../../../hooks/useAcademicCatalog';

export function Avatar({ student }) {
  const path = student?.student_profile?.profile_picture;
  const [failedPath, setFailedPath] = useState(null);
  const src = mediaUrl(path);
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-50 text-sm font-semibold text-maroon-800">
    {src && failedPath !== path ? <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setFailedPath(path)} /> : `${student?.first_name?.[0] || ''}${student?.last_name?.[0] || ''}` || '?'}
  </span>;
}
export function StatusBadge({ status }) {
  const colors = { approved: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300', completed: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300', inactive: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', pending: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  const label = status || 'normal';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${colors[status] || 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{label.replaceAll('_', ' ')}</span>;
}
const dateChip = value => new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const chipLabel = (key, value, dateLabel) => key === 'search' ? `Search: ${value}` : key === 'section' ? `Section ${value}`
  : key === 'date_from' ? `${dateLabel} from ${dateChip(value)}` : key === 'date_to' ? `${dateLabel} to ${dateChip(value)}` : value;
// `dateLabel` names what the From / To calendar filters (e.g. "Registered", "Visit date"); the fields show when filters has date_from.
export function StudentFilters({ filters, onChange, onClear, filterDefinitions, label = 'Student filters', searchLabel = 'Search students', searchPlaceholder = 'Search by name or student ID', embedded = false, dateLabel = 'Date' }) {
  const applied = appliedDirectoryFilters(filters);
  const active = applied.length > 0;
  const isApplied = key => applied.some(([field]) => field === key);
  // Course Management entries plus the older catalog, so students registered under either stay filterable.
  const catalog = useAcademicCatalog();
  const courseOptions = [...new Map([...catalog.map(({ code, name }) => [code, name]), ...directoryCourses].map(([code, name]) => [code, name])).entries()]
    .sort(([a], [b]) => a.localeCompare(b));
  const catalogSections = catalog.flatMap(({ sections }) => sections).filter(entry => !filters.year || entry.year === filters.year).map(entry => entry.section);
  const sectionOptions = [...new Set([...directorySectionsForYear(filters.year), ...catalogSections])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const definitions = filterDefinitions || [
    ['course', 'Course', 'All Courses', courseOptions.map(([value, label]) => [value, `${value} — ${label}`])],
    ['year', 'Year', 'All Years', years.map(value => [value, value])],
    ['section', 'Section', 'All Sections', sectionOptions.map(value => [value, value])],
    ['status', 'Status', null, directoryStatusOptions],
  ];
  return <section aria-label={label} className={embedded ? "" : "rounded-[10px] border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"}>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-[minmax(240px,2fr)_repeat(4,minmax(110px,1fr))]">
      <label className="col-span-2 lg:col-span-4 xl:col-span-1"><span className="sr-only">{searchLabel}</span><span className="relative block"><Search size={18} aria-hidden="true" className="absolute left-3 top-3 text-gray-400" /><input type="search" className={`${inputStyle} pl-10`} placeholder={searchPlaceholder} value={filters.search} onChange={e => onChange('search', e.target.value)} /></span></label>
      {definitions.map(([key, label, all, options]) => <label key={key} className="relative block"><span className="sr-only">{label}</span><select aria-label={label} value={filters[key]} onChange={e => onChange(key, e.target.value)} className={`${inputStyle} cursor-pointer appearance-none truncate pr-10 ${isApplied(key) ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-950' : ''}`}>{all !== null && <option value="">{all}</option>}{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><ChevronDown size={16} aria-hidden="true" className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 ${isApplied(key) ? 'text-maroon-700 dark:text-maroon-300' : 'text-gray-400'}`} /></label>)}
    </div>
    {'date_from' in filters && <div className="mt-3 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center">
      <span className="col-span-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 sm:col-span-1"><CalendarDays size={14} aria-hidden="true" />{dateLabel}</span>
      {[['date_from', 'From', { max: filters.date_to || undefined }], ['date_to', 'To', { min: filters.date_from || undefined }]].map(([key, text, limits]) => <label key={key} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
        <span className="shrink-0 text-xs">{text}</span>
        <input type="date" aria-label={`${dateLabel} ${text.toLowerCase()}`} value={filters[key]} {...limits} onChange={e => onChange(key, e.target.value)} className={`${inputStyle} py-2 sm:w-44 ${filters[key] ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-950' : ''}`} />
      </label>)}
    </div>}
    {active && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700"><SlidersHorizontal size={14} aria-hidden="true" className="text-gray-400" />{applied.map(([key, value]) => <button key={key} onClick={() => onChange(key, key === 'status' ? directoryDefaultFilters.status : '')} aria-label={`Remove ${key} filter: ${value}`} className={`inline-flex max-w-full items-center gap-1 rounded-[10px] bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200 ${focus}`}><span className="truncate">{chipLabel(key, value, dateLabel)}</span><X size={12} className="shrink-0" /></button>)}<button onClick={onClear} className={`ml-auto rounded px-2 py-1 text-sm font-medium text-maroon-800 dark:text-maroon-300 ${focus}`}>Clear filters</button></div>}
  </section>;
}
export function StudentDirectory({ students, loading, filtered, onClear, onView, onDelete }) {
  if (loading) return <div role="status" className="space-y-4 p-6"><span className="sr-only">Loading students</span>{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex animate-pulse gap-4 border-b border-gray-100 pb-4 dark:border-gray-700"><div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700" /><div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-700" /><div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" /></div></div>)}</div>;
  if (!students.length) return <div className="px-6 py-16 text-center"><Users size={30} aria-hidden="true" className="mx-auto mb-4 text-gray-400" /><h2 className="font-semibold">{filtered ? 'No students match your current filters.' : 'No students found yet.'}</h2><p className="mt-2 text-sm text-gray-500">{filtered ? 'Try a different name, student ID, or filter.' : 'Registered students will appear here.'}</p>{filtered && <button className={`${secondary} mt-5 text-maroon-800 dark:text-maroon-300`} onClick={onClear}>Clear filters</button>}</div>;
  const view = student => <button onClick={() => onView(student.id)} aria-label={`View ${fullName(student)}`} className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-950 ${focus}`}><Eye size={16} aria-hidden="true" />View</button>;
  // The student's documents (x-rays, lab results, prescriptions) are in the Documents tab of their record.
  // Delete asks for the admin password in a pop-up before anything is removed.
  const remove = student => <button onClick={() => onDelete(student)} aria-label={`Delete ${fullName(student)}`} className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 ${focus}`}><Trash2 size={16} aria-hidden="true" />Delete</button>;
  const actions = student => <div className="flex items-center gap-1">{view(student)}{onDelete && remove(student)}</div>;
  return <>
    <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Registered student directory, ordered by last name</caption><thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50"><tr>{['Student', 'Student ID', 'Course', 'Year', 'Section', 'Status', 'Action'].map(label => <th scope="col" key={label} className="px-4 py-3.5">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{students.map(student => <tr key={student.id} className="hover:bg-maroon-50/40 dark:hover:bg-gray-700/30"><td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar student={student} /><div className="min-w-0"><p className="font-semibold">{fullName(student)}</p><p className="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">{student.email || 'Not provided'}</p></div></div></td><td className="whitespace-nowrap px-4 py-4 text-gray-500 dark:text-gray-400">{student.student_id || '—'}</td>{['course', 'year', 'section'].map(field => <td key={field} className="whitespace-nowrap px-4 py-4">{academic(student, field) || '—'}</td>)}<td className="px-4 py-4"><StatusBadge status={student.status} /></td><td className="px-3 py-4">{actions(student)}</td></tr>)}</tbody></table></div>
    <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{students.map(student => <article key={student.id} className="p-4"><div className="flex items-start gap-3"><Avatar student={student} /><div className="min-w-0 flex-1"><h2 className="font-semibold">{fullName(student)}</h2><p className="mt-1 text-xs text-gray-500">{student.student_id || '—'}</p></div><StatusBadge status={student.status} /></div><div className="mt-3 flex items-end justify-between gap-2"><div className="text-sm"><p>{academic(student, 'course') || 'Course not provided'}</p><p className="mt-1 text-xs text-gray-500">{academic(student, 'year') || 'Year not provided'} · {academic(student, 'section') ? `Section ${academic(student, 'section')}` : 'Section not provided'}</p></div>{actions(student)}</div></article>)}</div>
  </>;
}
// `numbered` shows the page numbers (1 2 3) between the arrows, instead of only the current page.
// `summary="pages"` reads "Page 1 of 16 · 152 total" instead of "Showing 1–10 of 152".
export function Pagination({ meta, page, onPage, loading, entity = 'students', hideShowingText = false, numbered = false, summary = 'range', centered = false }) {
  const last = meta.last_page || 1;
  // Arrows around the current page number only, so the bar stays the same width however many pages there are.
  const arrow = `flex h-9 w-9 items-center justify-center rounded-[10px] border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-transparent dark:text-gray-300 dark:hover:bg-gray-700 ${focus}`;
  return <footer className={`flex flex-wrap items-center ${centered ? 'justify-center gap-2' : 'justify-between gap-4'} border-t border-gray-200 px-4 py-3 dark:border-gray-700`}>{!hideShowingText && <p className="text-sm text-gray-500" aria-live="polite">{loading ? `Loading ${entity}…` : summary === 'pages' ? `Page ${Math.min(page, last)} of ${last} · ${(meta.total || 0).toLocaleString()} total` : `Showing ${meta.from || 0}–${meta.to || 0} of ${meta.total || 0} ${entity}`}</p>}<nav aria-label={`${entity} pages`} className={hideShowingText && !centered ? 'ml-auto flex items-center gap-2' : 'flex items-center gap-2'}><button className={arrow} disabled={loading || page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>{numbered
    ? pageWindow(page, last).map((number, index) => number === null
      ? <span key={`gap-${index}`} className="px-1 text-gray-400" aria-hidden="true">…</span>
      : number === page
        ? <span key={number} className="flex h-9 min-w-9 items-center justify-center rounded-[10px] bg-maroon-800 px-2 text-sm font-semibold text-white tabular-nums" aria-current="page" aria-label={`Page ${page} of ${last}`}>{number}</span>
        : <button key={number} className={`${arrow} min-w-9 px-2 text-sm tabular-nums`} disabled={loading} onClick={() => onPage(number)} aria-label={`Go to page ${number}`}>{number}</button>)
    : <span className="flex h-9 min-w-9 items-center justify-center rounded-[10px] bg-maroon-800 px-2 text-sm font-semibold text-white tabular-nums" aria-current="page" aria-label={`Page ${page} of ${last}`} title={`Page ${page} of ${last}`}>{page}</span>}<button className={arrow} disabled={loading || page >= last} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={16} /></button></nav>{centered && meta.total > 0 && <span className="text-xs font-medium text-gray-500 dark:text-gray-400" aria-live="polite">{loading ? '…' : `${meta.to ?? meta.total} of ${meta.total}`}</span>}</footer>;
}
