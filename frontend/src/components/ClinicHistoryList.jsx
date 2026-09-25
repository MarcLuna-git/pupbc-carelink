const labels = { bp: 'Blood pressure', hr: 'Heart rate', rr: 'Respiratory rate', temp: 'Temperature', o2_sat: 'Oxygen saturation', agree_privacy: 'Privacy consent', agree_terms: 'Terms consent' };
const label = key => labels[key] || key.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
const display = value => typeof value === 'boolean' ? (value ? 'Yes' : 'No') : Array.isArray(value) ? value.join(', ') || 'None reported' : value === null || value === '' ? 'Not recorded' : String(value);

export const DataFields = ({ data }) => <dl className="grid sm:grid-cols-2 gap-3 text-sm">{Object.entries(data || {}).filter(([key]) => !['id', 'user_id', 'recorded_by', 'created_at', 'updated_at', 'deleted_at'].includes(key)).map(([key, value]) => <div key={key} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-3 break-words"><dt className="text-gray-500 text-xs mb-1">{label(key)}</dt><dd>{value && typeof value === 'object' && !Array.isArray(value) ? <DataFields data={value} /> : display(value)}</dd></div>)}</dl>;

export default function ClinicHistoryList({ records = [] }) {
  if (!records.length) return <p className="text-sm text-gray-500 py-3">No completed encounters recorded.</p>;
  return <div className="space-y-3">{records.map(record => <details key={`${record.record_type}-${record.id}`} className="border rounded-xl p-4 dark:border-gray-700">
    <summary className="cursor-pointer"><b>{record.record_type === 'emergency' ? 'Emergency Encounter' : 'Scheduled Consultation'}</b><span className="ml-3 text-xs text-gray-500">{new Date(record.occurred_at).toLocaleString()}</span><p className="text-sm mt-1">{record.reason || record.chief_complaint}</p></summary>
    <div className="mt-4"><DataFields data={Object.fromEntries(Object.entries(record).filter(([key]) => !['record_type', 'occurred_at', 'incident_datetime'].includes(key)))} /></div>
  </details>)}</div>;
}
