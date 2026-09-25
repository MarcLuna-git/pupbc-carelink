import { useEffect, useState } from 'react';
import api from '../../../services/api';
import ClinicHistoryList from '../../../components/ClinicHistoryList';
export default function NurseRecords() {
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/nurse/clinic-history').then(({ data }) => setRecords(data.data)).catch(() => setError('Unable to load clinic history.')).finally(() => setLoading(false)); }, []);
  const filtered = records.filter(record => [record.student?.first_name, record.student?.last_name, record.student?.student_id, record.chief_complaint, record.reason].filter(Boolean).join(' ').toLowerCase().includes(search.toLowerCase()));
  return <div className="max-w-6xl mx-auto space-y-4 text-gray-900 dark:text-gray-100"><h1 className="text-2xl font-bold">Clinic History</h1><p>Completed consultations and emergency encounters.</p><input className="border rounded-xl p-3 w-full dark:bg-gray-800" aria-label="Search clinic history" placeholder="Search student or complaint..." value={search} onChange={e => setSearch(e.target.value)} />{error && <p role="alert">{error}</p>}{loading ? <p>Loading history...</p> : <ClinicHistoryList records={filtered} />}</div>;
}
