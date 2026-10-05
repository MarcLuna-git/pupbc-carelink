const labels = { bp: 'Blood pressure', hr: 'Heart rate', rr: 'Respiratory rate', temp: 'Temperature', o2_sat: 'Oxygen saturation', agree_privacy: 'Privacy consent', agree_terms: 'Terms consent' };
const label = key => labels[key] || key.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const display = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join(', ') || 'None reported' : value === null || value === '' ? 'Not recorded' : String(value);

export const DataFields = ({ data }) => <dl className="grid sm:grid-cols-2 gap-3 text-sm">{Object.entries(data || {}).filter(([key]) => !['id', 'user_id', 'recorded_by', 'created_at', 'updated_at', 'deleted_at'].includes(key)).map(([key, value]) => <div key={key} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 break-words"><dt className="text-gray-500 text-xs mb-1">{label(key)}</dt><dd>{value && typeof value === 'object' && !Array.isArray(value) ? <DataFields data={value} /> : display(value)}</dd></div>)}</dl>;

export default function ClinicHistoryList({ records = [], variant = 'compact' }) {
  if (!records.length) return <p className="text-sm text-gray-500 py-3">No completed encounters recorded.</p>;
  if (variant === 'compact') return <div className="space-y-3">{records.map(record => <details key={`${record.record_type}-${record.id}`} className="border rounded-xl p-4 dark:border-gray-700">
    <summary className="cursor-pointer"><b>{record.record_type === 'emergency' ? 'Emergency Encounter' : 'Scheduled Consultation'}</b><span className="ml-3 text-xs text-gray-500">{new Date(record.occurred_at).toLocaleString()}</span><p className="text-sm mt-1">{record.reason || record.chief_complaint}</p></summary>
    <div className="mt-4"><DataFields data={Object.fromEntries(Object.entries(record).filter(([key]) => !['record_type', 'occurred_at', 'incident_datetime'].includes(key)))} /></div>
  </details>)}</div>;
  return <div className="space-y-3">{records.map(record => <details key={`${record.record_type}-${record.id}`} className="group rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-800">
    <summary className="flex cursor-pointer list-none items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-300 [&::-webkit-details-marker]:hidden">
      <span className={`shrink-0 rounded-xl p-2.5 ${record.record_type === 'emergency' ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300' : 'bg-maroon-50 text-maroon-800 dark:bg-maroon-950/40 dark:text-maroon-300'}`}>{record.record_type === 'emergency' ? <HeartPulse size={20} /> : <Stethoscope size={20} />}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{record.record_type === 'emergency' ? 'Emergency Encounter' : 'Scheduled Consultation'}</span><time dateTime={record.occurred_at} className="text-xs text-gray-500 dark:text-gray-400">{record.occurred_at ? new Date(record.occurred_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date not recorded'}</time></div>
        {record.student && <><h3 className="mt-2 break-words text-sm font-semibold">{[record.student.first_name, record.student.last_name].filter(Boolean).join(' ') || 'Student'}<span className="ml-2 inline-block text-xs font-normal text-gray-500 dark:text-gray-400">{record.student.student_id}</span></h3><p className="mt-1 break-words text-xs text-gray-500 dark:text-gray-400">{[recordAcademic(record, 'course'), yearLabel(yearValue(recordAcademic(record, 'year'))), recordAcademic(record, 'section') && `Section ${recordAcademic(record, 'section')}`].filter(Boolean).join(' · ')}</p></>}
        <p className="mt-2 break-words text-sm text-gray-700 dark:text-gray-200">{record.reason || record.chief_complaint || 'No complaint recorded'}</p>
        <p className="mt-2 text-xs font-medium text-maroon-800 dark:text-maroon-300"><span className="group-open:hidden">View record details</span><span className="hidden group-open:inline">Hide record details</span></p>
      </div>
      <ChevronDown size={18} className="mt-1 shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
    </summary>
    <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700"><DataFields data={Object.fromEntries(Object.entries(record).filter(([key]) => !['record_type', 'occurred_at', 'incident_datetime', 'student'].includes(key)))} /></div>
  </details>)}</div>;
}
import { ChevronDown, Stethoscope, HeartPulse } from 'lucide-react';
import { recordAcademic, yearLabel, yearValue } from '../utils/clinicRecordFilters';
