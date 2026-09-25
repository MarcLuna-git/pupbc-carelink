import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../../../services/api';
import { StudentDirectory, StudentFilters, Pagination } from './StudentDirectory';
import { StudentDetailsModal, EmergencyModal } from './StudentDetailsModal';
import { emptyFilters, secondary } from './directoryOptions';

const emptyEmergency = { incident_datetime: '', reason: '', symptoms: '', assessment: '', intervention: '', disposition: '', notes: '' };
export default function NurseStudents() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, from: 0, to: 0 });
  const [students, setStudents] = useState([]);
  const [selectedId, setSelectedId] = useState(params.get('student'));
  const [selected, setSelected] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('Overview');
  const [listError, setListError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [emergencyError, setEmergencyError] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergency, setEmergency] = useState(emptyEmergency);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [listRefresh, setListRefresh] = useState(0);
  const [statusSaving, setStatusSaving] = useState(false);
  const filtered = Object.values(filters).some(Boolean);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setListError('');
    const timer = setTimeout(() => {
      api.get('/nurse/students', { params: { ...filters, page }, signal: controller.signal })
        .then(({ data }) => {
          if (controller.signal.aborted) return;
          setStudents(data.data.data);
          setMeta({ total: data.data.total, last_page: data.data.last_page, from: data.data.from, to: data.data.to });
        })
        .catch(err => { if (!controller.signal.aborted && err.code !== 'ERR_CANCELED') setListError('Unable to load students. Please try again.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, page, listRefresh]);

  useEffect(() => {
    if (!selectedId) { setSelected(null); return; }
    const controller = new AbortController();
    setDetailLoading(true); setSelected(null); setHistory([]); setAppointments([]); setDetailError('');
    Promise.all([
      api.get(`/nurse/students/${selectedId}`, { signal: controller.signal }),
      api.get(`/nurse/students/${selectedId}/appointments`, { signal: controller.signal }),
      api.get(`/nurse/students/${selectedId}/clinic-history`, { signal: controller.signal }),
    ]).then(([detail, visits, records]) => {
      if (controller.signal.aborted) return;
      setSelected(detail.data.data); setAppointments(visits.data.data); setHistory(records.data.data);
    }).catch(err => { if (!controller.signal.aborted && err.code !== 'ERR_CANCELED') setDetailError('Unable to load student record. Close and try again.'); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
    return () => controller.abort();
  }, [selectedId, refresh]);

  const changeFilter = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({ ...emptyFilters }); setPage(1); };
  const submitEmergency = async event => {
    event.preventDefault(); if (saving) return; setSaving(true); setEmergencyError('');
    try { await api.post('/nurse/emergency-encounters', { ...emergency, student_id: selectedId }); setEmergencyOpen(false); setEmergency(emptyEmergency); setTab('Clinic History'); setRefresh(value => value + 1); }
    catch (err) { setEmergencyError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Unable to save emergency encounter.'); }
    finally { setSaving(false); }
  };
  const archiveStudent = async () => {
    const reason = window.prompt('Reason for archiving this student:');
    if (!reason?.trim() || statusSaving) return;
    setStatusSaving(true); setDetailError('');
    try {
      await api.patch(`/nurse/students/${selectedId}/archive`, { reason: reason.trim() });
      setRefresh(value => value + 1); setListRefresh(value => value + 1);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Unable to archive student.');
    } finally { setStatusSaving(false); }
  };
  const restoreStudent = async () => {
    if (statusSaving || !window.confirm('Restore this student account?')) return;
    setStatusSaving(true); setDetailError('');
    try {
      await api.patch(`/nurse/students/${selectedId}/restore`);
      setRefresh(value => value + 1); setListRefresh(value => value + 1);
    } catch (err) {
      setDetailError(err.response?.data?.message || 'Unable to restore student.');
    } finally { setStatusSaving(false); }
  };
  const close = () => { setSelectedId(null); setEmergencyOpen(false); setEmergency(emptyEmergency); setDetailError(''); setEmergencyError(''); };

  return <div className="mx-auto max-w-7xl space-y-5 text-gray-900 dark:text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><div className="mb-2 h-1 w-9 rounded-full bg-yellow-400" /><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Students</h1><p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">Manage and view registered student records.</p></div><div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"><span className="rounded-lg bg-maroon-50 p-2 text-maroon-800"><Users size={20} aria-hidden="true" /></span><div><p className="text-xs text-gray-500">{filtered ? 'Matching students' : 'Total students'}</p><p className="text-xl font-semibold tabular-nums" aria-live="polite">{loading || listError ? '—' : meta.total.toLocaleString()}</p></div></div></header>
    <StudentFilters filters={filters} onChange={changeFilter} onClear={clearFilters} />
    <section aria-label="Student directory" aria-busy={loading} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700"><h2 className="text-sm font-semibold">Student directory</h2><span className="text-xs text-gray-500">Last name, A–Z</span></div>
      {listError ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600">{listError}</p><button className={secondary} onClick={() => setListRefresh(value => value + 1)}>Try again</button></div> : <><StudentDirectory students={students} loading={loading} filtered={filtered} onClear={clearFilters} onView={id => { setSelectedId(id); setTab('Overview'); }} /><Pagination meta={meta} page={page} onPage={setPage} loading={loading} /></>}
    </section>
    {selectedId && <StudentDetailsModal student={selected} loading={detailLoading} error={detailError} appointments={appointments} history={history} tab={tab} onTab={setTab} onClose={close} emergencyOpen={emergencyOpen} onEmergency={() => { setEmergencyError(''); setEmergencyOpen(true); }} onArchive={archiveStudent} onRestore={restoreStudent} statusSaving={statusSaving} />}
    {emergencyOpen && selectedId && <EmergencyModal emergency={emergency} onChange={(field, value) => setEmergency(previous => ({ ...previous, [field]: value }))} onSubmit={submitEmergency} onClose={() => setEmergencyOpen(false)} saving={saving} error={emergencyError} />}
  </div>;
}
