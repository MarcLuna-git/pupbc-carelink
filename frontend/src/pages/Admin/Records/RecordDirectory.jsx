import { useEffect, useRef } from 'react';
import { Eye, X } from 'lucide-react';
import { Avatar } from '../Students/StudentDirectory';
import { focus, fullName, secondary } from '../Students/directoryOptions';
import { ClinicRecordSheet } from '../../../components/ClinicRecordList';
import { recordAcademic, yearLabel, yearValue } from '../../../utils/clinicRecordFilters';

const recordType = record => record.record_type === 'emergency' ? 'Emergency' : 'Consultation';
const date = record => record.occurred_at ? new Date(record.occurred_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
const badge = record => <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${record.record_type === 'emergency' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{recordType(record)}</span>;

// Table columns that can be sorted, and what each one sorts by.
const text = value => String(value || '').toLowerCase();
export const RECORD_COLUMNS = [['student', 'Student'], ['student_id', 'Student ID'], ['course', 'Course'], ['year', 'Year'], ['section', 'Section'], ['type', 'Record type'], ['date', 'Date']];
export const RECORD_SORTS = {
  student: record => text(fullName(record.student || {})),
  student_id: record => text(record.student?.student_id),
  course: record => text(recordAcademic(record, 'course')),
  year: record => text(yearValue(recordAcademic(record, 'year'))),
  section: record => text(recordAcademic(record, 'section')),
  type: record => text(record.record_type),
  date: record => new Date(record.occurred_at).getTime() || 0,
};

// Stacked ▲/▼: both hollow until the column is sorted, then the active direction fills maroon.
const SortCaret = ({ direction }) => (
  <svg viewBox="0 0 10 14" aria-hidden="true" className="h-[13px] w-[9px] text-gray-400">
    {[['asc', 'M1.5 5.5h7L5 1.5z'], ['desc', 'M1.5 8.5h7L5 12.5z']].map(([dir, d]) => (
      <path key={dir} d={d} strokeWidth="1.1" strokeLinejoin="round"
        className={direction === dir ? 'fill-maroon-700 stroke-maroon-700 dark:fill-maroon-300 dark:stroke-maroon-300' : 'fill-none stroke-current'} />
    ))}
  </svg>
);

export default function RecordDirectory({ records, onView, sort = null, onSort = () => {} }) {
  const view = record => <button type="button" onClick={() => onView(record)} aria-label={`View ${recordType(record).toLowerCase()} record for ${fullName(record.student || {}) || 'student'}`} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-950 ${focus}`}><Eye size={16} aria-hidden="true" />View</button>;
  return <>
    <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Clinic history, newest encounters first</caption><thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50"><tr>{RECORD_COLUMNS.map(([key, label]) => { const active = sort?.key === key ? sort.dir : null; return <th scope="col" key={key} aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : 'none'} className="px-4 py-3.5"><button type="button" onClick={() => onSort(key)} className={`inline-flex items-center gap-1 transition hover:text-gray-900 dark:hover:text-white${active ? ' text-gray-900 dark:text-white' : ''}`}>{label}<SortCaret direction={active} /></button></th>; })}<th scope="col" className="px-4 py-3.5">Action</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{records.map(record => <tr key={`${record.record_type}-${record.id}`} className="hover:bg-maroon-50/40 dark:hover:bg-gray-700/30">
      <td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar student={record.student || {}} /><div className="min-w-0"><p className="font-semibold">{fullName(record.student || {}) || 'Student not available'}</p><p className="mt-0.5 max-w-56 truncate text-xs text-gray-500 dark:text-gray-400" title={record.reason || record.chief_complaint}>{record.reason || record.chief_complaint || 'Not recorded'}</p></div></div></td>
      <td className="whitespace-nowrap px-4 py-4 text-gray-500 dark:text-gray-400">{record.student?.student_id || '—'}</td>
      {['course', 'year', 'section'].map(key => <td key={key} className="whitespace-nowrap px-4 py-4">{(key === 'year' ? yearLabel(yearValue(recordAcademic(record, key))) : recordAcademic(record, key)) || '—'}</td>)}
      <td className="px-4 py-4">{badge(record)}</td><td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{date(record)}</td><td className="px-3 py-4">{view(record)}</td>
    </tr>)}</tbody></table></div>
    <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{records.map(record => <article key={`${record.record_type}-${record.id}`} className="p-4"><div className="flex items-start gap-3"><Avatar student={record.student || {}} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{fullName(record.student || {}) || 'Student not available'}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{record.student?.student_id || 'ID not recorded'}</p></div>{badge(record)}</div><p className="mt-3 break-words text-sm">{[recordAcademic(record, 'course'), recordAcademic(record, 'section')].filter(Boolean).join(' ') || 'Academic details not recorded'}</p><p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">{record.reason || record.chief_complaint || 'No complaint recorded'}</p><div className="mt-2 flex items-center justify-between gap-2"><time dateTime={record.occurred_at} className="text-xs text-gray-500 dark:text-gray-400">{date(record)}</time>{view(record)}</div></article>)}</div>
  </>;
}

export function RecordDetailsModal({ record, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby="clinic-record-title" onCancel={event => { event.preventDefault(); onClose(); }} className="m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-3xl overflow-y-auto rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-gray-950/60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
    <header className="flex items-start gap-3 border-b border-gray-200 p-5 dark:border-gray-700"><div className="min-w-0 flex-1"><p className="text-xs text-gray-500 dark:text-gray-400">{recordType(record)} · {date(record)}</p><h2 id="clinic-record-title" className="mt-1 break-words text-xl font-semibold">{fullName(record.student || {}) || 'Clinic record'}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{record.student?.student_id}</p></div><button type="button" aria-label="Close record details" onClick={onClose} className={`rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button></header>
    <div className="p-5"><ClinicRecordSheet record={record} /></div>
    <footer className="flex justify-end border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" onClick={onClose} className={secondary}>Close</button></footer>
  </dialog>;
}
