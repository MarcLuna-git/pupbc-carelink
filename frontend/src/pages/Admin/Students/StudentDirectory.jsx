import { useState } from 'react';
import { Eye, Search, SlidersHorizontal, Users, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../../services/api';
import { academic, courses, years, sections, fullName, focus, inputStyle, secondary } from './directoryOptions';

export function Avatar({ student }) {
  const path = student?.student_profile?.profile_picture;
  const [failedPath, setFailedPath] = useState(null);
  const base = new URL(api.defaults.baseURL, window.location.origin);
  const src = path && (/^https?:\/\//.test(path) ? path : new URL(path.startsWith('/') ? path : `/storage/${path}`, base.origin).href);
  return <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-50 text-sm font-semibold text-maroon-800">
    {src && failedPath !== path ? <img src={src} alt="" className="h-full w-full object-cover" onError={() => setFailedPath(path)} /> : `${student?.first_name?.[0] || ''}${student?.last_name?.[0] || ''}` || '?'}
  </span>;
}
export function StatusBadge({ status }) {
  const colors = { approved: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300', completed: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300', inactive: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', pending: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', archived: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', expired: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  const label = status || 'normal';
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium capitalize ${colors[status] || 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{label.replaceAll('_', ' ')}</span>;
}
export function StudentFilters({ filters, onChange, onClear }) {
  const active = Object.values(filters).some(Boolean);
  const definitions = [
    ['course', 'Course', 'All Courses', courses.map(([value, label]) => [value, `${value} — ${label}`])],
    ['year', 'Year', 'All Years', years.map(value => [value, value])],
    ['section', 'Section', 'All Sections', sections.map(value => [value, value])],
    ['status', 'Status', 'All Status', [['inactive', 'Inactive'], ['archived', 'Archived']]],
  ];
  return <section aria-label="Student filters" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-[minmax(240px,2fr)_repeat(4,minmax(110px,1fr))]">
      <label className="col-span-2 lg:col-span-4 xl:col-span-1"><span className="sr-only">Search students</span><span className="relative block"><Search size={18} aria-hidden="true" className="absolute left-3 top-3 text-gray-400" /><input type="search" className={`${inputStyle} pl-10`} placeholder="Search by name or student ID" value={filters.search} onChange={e => onChange('search', e.target.value)} /></span></label>
      {definitions.map(([key, label, all, options]) => <label key={key}><span className="sr-only">{label}</span><select aria-label={label} value={filters[key]} onChange={e => onChange(key, e.target.value)} className={`${inputStyle} ${filters[key] ? 'border-maroon-500 bg-maroon-50 dark:bg-maroon-950' : ''}`}><option value="">{all}</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}
    </div>
    {active && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700"><SlidersHorizontal size={14} aria-hidden="true" className="text-gray-400" />{Object.entries(filters).filter(([, value]) => value).map(([key, value]) => <button key={key} onClick={() => onChange(key, '')} aria-label={`Remove ${key} filter: ${value}`} className={`inline-flex max-w-full items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-200 ${focus}`}><span className="truncate">{key === 'search' ? `Search: ${value}` : key === 'section' ? `Section ${value}` : value}</span><X size={12} className="shrink-0" /></button>)}<button onClick={onClear} className={`ml-auto rounded px-2 py-1 text-sm font-medium text-maroon-800 dark:text-maroon-300 ${focus}`}>Clear filters</button></div>}
  </section>;
}
export function StudentDirectory({ students, loading, filtered, onClear, onView }) {
  if (loading) return <div role="status" className="space-y-4 p-6"><span className="sr-only">Loading students</span>{Array.from({ length: 5 }, (_, i) => <div key={i} className="flex animate-pulse gap-4 border-b border-gray-100 pb-4 dark:border-gray-700"><div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-700" /><div className="flex-1 space-y-2"><div className="h-4 w-1/3 rounded bg-gray-100 dark:bg-gray-700" /><div className="h-3 w-2/3 rounded bg-gray-100 dark:bg-gray-700" /></div></div>)}</div>;
  if (!students.length) return <div className="px-6 py-16 text-center"><Users size={30} aria-hidden="true" className="mx-auto mb-4 text-gray-400" /><h2 className="font-semibold">{filtered ? 'No students match your current filters.' : 'No students found yet.'}</h2><p className="mt-2 text-sm text-gray-500">{filtered ? 'Try a different name, student ID, or filter.' : 'Registered students will appear here.'}</p>{filtered && <button className={`${secondary} mt-5 text-maroon-800 dark:text-maroon-300`} onClick={onClear}>Clear filters</button>}</div>;
  const view = student => <button onClick={() => onView(student.id)} aria-label={`View ${fullName(student)}`} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-950 ${focus}`}><Eye size={16} aria-hidden="true" />View</button>;
  return <>
    <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Registered student directory, ordered by last name</caption><thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50"><tr>{['Student', 'Student ID', 'Course', 'Year', 'Section', 'Status', 'Action'].map(label => <th scope="col" key={label} className="px-4 py-3.5">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{students.map(student => <tr key={student.id} className="hover:bg-maroon-50/40 dark:hover:bg-gray-700/30"><td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar student={student} /><div className="min-w-0"><p className="font-semibold">{fullName(student)}</p><p className="mt-0.5 break-all text-xs text-gray-500 dark:text-gray-400">{student.email || 'Not provided'}</p></div></div></td><td className="whitespace-nowrap px-4 py-4 text-gray-500 dark:text-gray-400">{student.student_id || '—'}</td>{['course', 'year', 'section'].map(field => <td key={field} className="whitespace-nowrap px-4 py-4">{academic(student, field) || '—'}</td>)}<td className="px-4 py-4"><StatusBadge status={student.status} /></td><td className="px-3 py-4">{view(student)}</td></tr>)}</tbody></table></div>
    <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{students.map(student => <article key={student.id} className="p-4"><div className="flex items-start gap-3"><Avatar student={student} /><div className="min-w-0 flex-1"><h2 className="font-semibold">{fullName(student)}</h2><p className="mt-1 text-xs text-gray-500">{student.student_id || '—'}</p></div><StatusBadge status={student.status} /></div><div className="mt-3 flex items-end justify-between gap-2"><div className="text-sm"><p>{academic(student, 'course') || 'Course not provided'}</p><p className="mt-1 text-xs text-gray-500">{academic(student, 'year') || 'Year not provided'} · {academic(student, 'section') ? `Section ${academic(student, 'section')}` : 'Section not provided'}</p></div>{view(student)}</div></article>)}</div>
  </>;
}
export function Pagination({ meta, page, onPage, loading }) {
  const last = meta.last_page || 1;
  const pages = [...new Set([1, page - 1, page, page + 1, last])].filter(value => value > 0 && value <= last).sort((a, b) => a - b);
  return <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-gray-200 px-4 py-4 dark:border-gray-700"><p className="text-sm text-gray-500" aria-live="polite">{loading ? 'Loading students…' : `Showing ${meta.from || 0}–${meta.to || 0} of ${meta.total || 0}`}<span className="ml-2 text-xs">Page {page} of {last}</span></p><nav aria-label="Student pages" className="flex items-center gap-1"><button className={secondary} disabled={loading || page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={16} /><span className="hidden sm:inline">Previous</span></button>{pages.map((value, index) => <span key={value} className="hidden items-center sm:inline-flex">{index > 0 && value - pages[index - 1] > 1 && <span className="px-1 text-gray-400">…</span>}<button disabled={loading} aria-label={`Page ${value}`} aria-current={page === value ? 'page' : undefined} onClick={() => onPage(value)} className={`h-9 min-w-9 rounded-lg text-sm ${page === value ? 'bg-maroon-800 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} ${focus}`}>{value}</button></span>)}<button className={secondary} disabled={loading || page >= last} onClick={() => onPage(page + 1)} aria-label="Next page"><span className="hidden sm:inline">Next</span><ChevronRight size={16} /></button></nav></footer>;
}
