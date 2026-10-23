import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, UsersRound, IdCard } from 'lucide-react';
import NursePageHero from '../../../components/NursePageHero';
import NurseListCard from '../../../components/NurseListCard';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import { StudentDirectory, StudentFilters, Pagination } from './StudentDirectory';
import { StudentDetailsModal, EmergencyModal } from './StudentDetailsModal';
import { StudentFilesModal } from './StudentFilesModal';
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
  const [filesStudent, setFilesStudent] = useState(null);
  const filtered = Object.values(filters).some(Boolean);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  useNurseSync(['students', 'academic', 'appointments', 'consultations'], async signal => {
    const listId = ++listRequest.current;
    const list = await api.get('/nurse/students', { params: { ...filters, page }, signal });
    if (signal.aborted || listId !== listRequest.current) return;
    setStudents(list.data.data.data);
    const latest = list.data.data;
    setMeta({ total: latest.total, last_page: latest.last_page, from: latest.from, to: latest.to });
    setListError('');
    if (selectedId) {
      const detailId = ++detailRequest.current;
      const [detail, visits, records] = await Promise.all([
        api.get(`/nurse/students/${selectedId}`, { signal }),
        api.get(`/nurse/students/${selectedId}/appointments`, { signal }),
        api.get(`/nurse/students/${selectedId}/clinic-history`, { signal }),
      ]);
      if (signal.aborted || detailId !== detailRequest.current) return;
      setSelected(detail.data.data); setAppointments(visits.data.data); setHistory(records.data.data);
    }
  }, JSON.stringify([filters, page, selectedId]));

  useEffect(() => {
    const request = ++listRequest.current;
    const controller = new AbortController();
    setLoading(true); setListError('');
    const timer = setTimeout(() => {
      api.get('/nurse/students', { params: { ...filters, page }, signal: controller.signal })
        .then(({ data }) => {
          if (controller.signal.aborted || request !== listRequest.current) return;
          setStudents(data.data.data);
          setMeta({ total: data.data.total, last_page: data.data.last_page, from: data.data.from, to: data.data.to });
        })
        .catch(err => { if (!controller.signal.aborted && err.code !== 'ERR_CANCELED') setListError('Unable to load students. Please try again.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [filters, page, listRefresh]);

  useEffect(() => {
    const request = ++detailRequest.current;
    if (!selectedId) { setSelected(null); return; }
    const controller = new AbortController();
    setDetailLoading(true); setSelected(null); setHistory([]); setAppointments([]); setDetailError('');
    Promise.all([
      api.get(`/nurse/students/${selectedId}`, { signal: controller.signal }),
      api.get(`/nurse/students/${selectedId}/appointments`, { signal: controller.signal }),
      api.get(`/nurse/students/${selectedId}/clinic-history`, { signal: controller.signal }),
    ]).then(([detail, visits, records]) => {
      if (controller.signal.aborted || request !== detailRequest.current) return;
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

  return <div className="mx-auto max-w-[1440px] space-y-5 text-gray-900 dark:text-gray-100">
    <NursePageHero id="nurse-students-title" title="Students" description="Manage and view registered student records." art={Users}>
      <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-700/50">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-400"><UsersRound size={16} aria-hidden="true" /></span>
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{filtered ? 'Matching students' : 'Total students'}</p>
          {loading
            ? <span role="status" className="mt-1 block h-5 w-12 animate-pulse rounded-md bg-gray-200 dark:bg-gray-600"><span className="sr-only">Loading student count</span></span>
            : <p className="text-lg font-bold leading-tight tabular-nums" aria-live="polite">{listError ? <span className="text-sm font-semibold text-gray-400">Unavailable</span> : meta.total.toLocaleString()}</p>}
        </div>
      </div>
    </NursePageHero>
    <NurseListCard
      aria-label="Student directory"
      aria-busy={loading}
      icon={IdCard}
      title="Student directory"
      description="Registered students sorted by last name, A–Z. Open a student to see their health record."
      toolbar={<StudentFilters embedded filters={filters} onChange={changeFilter} onClear={clearFilters} />}
    >
      {listError ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600">{listError}</p><button className={secondary} onClick={() => setListRefresh(value => value + 1)}>Try again</button></div> : <><StudentDirectory students={students} loading={loading} filtered={filtered} onClear={clearFilters} onView={id => { setSelectedId(id); setTab('Overview'); }} onFiles={setFilesStudent} /><Pagination meta={meta} page={page} onPage={setPage} loading={loading} /></>}
    </NurseListCard>
    {selectedId && <StudentDetailsModal student={selected} loading={detailLoading} error={detailError} appointments={appointments} history={history} tab={tab} onTab={setTab} onClose={close} emergencyOpen={emergencyOpen} onEmergency={() => { setEmergencyError(''); setEmergencyOpen(true); }} onArchive={archiveStudent} onRestore={restoreStudent} statusSaving={statusSaving} />}
    {filesStudent && <StudentFilesModal student={filesStudent} onClose={() => setFilesStudent(null)} />}
    {emergencyOpen && selectedId && <EmergencyModal emergency={emergency} onChange={(field, value) => setEmergency(previous => ({ ...previous, [field]: value }))} onSubmit={submitEmergency} onClose={() => setEmergencyOpen(false)} saving={saving} error={emergencyError} />}
  </div>;
}
