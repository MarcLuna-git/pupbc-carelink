import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IdCard, ListChecks } from 'lucide-react';
import MasterlistPanel from '../Academic/MasterlistPanel';
import NursePageTitle from '../../../components/NursePageTitle';
import { NurseToast } from '../../../components/NurseFeedback';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import { StudentDirectory, StudentFilters, Pagination } from './StudentDirectory';
import { StudentDetailsModal, ArchiveStudentModal, DeleteStudentModal, EmergencyModal } from './StudentDetailsModal';
import { appliedDirectoryFilters, directoryDefaultFilters, nextDirectoryFilters, secondary } from './directoryOptions';
import { archiveReasonError } from './archiveReason';

const emptyEmergency = { incident_datetime: '', reason: '', symptoms: '', assessment: '', intervention: '', disposition: '', notes: '' };
export default function NurseStudents() {
  const [params, setParams] = useSearchParams();
  // Inner tabs: Student Directory (registered students) and Masterlist (the school's list of enrolled students).
  const tabView = params.get('tab') === 'masterlist' ? 'masterlist' : 'directory';
  const chooseView = id => setParams(id === 'masterlist' ? { tab: 'masterlist' } : {}, { replace: true });
  const [filters, setFilters] = useState(directoryDefaultFilters);
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
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [archiveError, setArchiveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [listRefresh, setListRefresh] = useState(0);
  const [statusSaving, setStatusSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState('');
  const filtered = appliedDirectoryFilters(filters).length > 0;
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const archiveSubmitting = useRef(false);
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

  const changeFilter = (key, value) => { setFilters(previous => nextDirectoryFilters(previous, key, value)); setPage(1); };
  const clearFilters = () => { setFilters({ ...directoryDefaultFilters }); setPage(1); };
  const submitEmergency = async event => {
    event.preventDefault(); if (saving) return; setSaving(true); setEmergencyError('');
    try { await api.post('/nurse/emergency-encounters', { ...emergency, student_id: selectedId }); setEmergencyOpen(false); setEmergency(emptyEmergency); setTab('Clinic History'); setRefresh(value => value + 1); }
    catch (err) { setEmergencyError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Unable to save emergency encounter.'); }
    finally { setSaving(false); }
  };
  const resetArchive = () => { setArchiveOpen(false); setArchiveReason(''); setArchiveError(''); };
  const openArchive = () => { if (statusSaving) return; setArchiveReason(''); setArchiveError(''); setDetailError(''); setArchiveOpen(true); };
  const closeArchive = () => { if (!statusSaving && !archiveSubmitting.current) resetArchive(); };
  const archiveStudent = async event => {
    event.preventDefault();
    if (statusSaving || archiveSubmitting.current) return;
    const error = archiveReasonError(archiveReason);
    if (error) { setArchiveError(error); return; }
    archiveSubmitting.current = true;
    setStatusSaving(true); setDetailError('');
    try {
      await api.patch(`/nurse/students/${selectedId}/archive`, { reason: archiveReason.trim() });
      resetArchive();
      setRefresh(value => value + 1); setListRefresh(value => value + 1);
    } catch (err) {
      const reasonErrors = err.response?.status === 422 ? err.response.data?.errors?.reason : null;
      const reasonError = Array.isArray(reasonErrors) ? reasonErrors[0] : reasonErrors;
      if (reasonError) setArchiveError(reasonError);
      else { resetArchive(); setDetailError(err.response?.data?.message || 'Unable to archive student.'); }
    } finally { archiveSubmitting.current = false; setStatusSaving(false); }
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
  // Delete for good (row button → pop-up → admin password).
  const openDelete = student => { setDeleteTarget(student); setDeletePassword(''); setDeleteError(''); };
  const closeDelete = () => { if (!deleting) { setDeleteTarget(null); setDeletePassword(''); setDeleteError(''); } };
  const deleteStudent = async event => {
    event.preventDefault();
    if (deleting || !deleteTarget) return;
    if (!deletePassword) { setDeleteError('Enter the admin password.'); return; }
    setDeleting(true); setDeleteError('');
    try {
      const { data } = await api.delete(`/nurse/students/${deleteTarget.id}`, { data: { password: deletePassword } });
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null); setDeletePassword('');
      setDeleteNotice(data?.message || 'Student deleted.');
      setListRefresh(value => value + 1);
    } catch (err) {
      const passwordErrors = err.response?.data?.errors?.password;
      setDeleteError((Array.isArray(passwordErrors) ? passwordErrors[0] : passwordErrors)
        || (err.response?.status === 429 ? 'Too many tries. Please wait a minute and try again.' : err.response?.data?.message)
        || 'Unable to delete student. Please try again.');
    } finally { setDeleting(false); }
  };
  const close = () => { setSelectedId(null); setEmergencyOpen(false); setEmergency(emptyEmergency); resetArchive(); setDetailError(''); setEmergencyError(''); };

  return <div className="mx-auto max-w-[1440px] space-y-5 text-gray-900 dark:text-gray-100">
    <NursePageTitle path="/nurse/students" />
    {/* Delete result shows as a floating toast */}
    <NurseToast message={deleteNotice} type="success" onClose={() => setDeleteNotice('')} />
    <section aria-label="Students view" className="rounded-[10px] border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 lg:px-4">
      <div role="tablist" aria-label="Students view" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {[['directory', 'Student Directory', IdCard], ['masterlist', 'Masterlist', ListChecks]].map(([id, title, Icon]) => (
          <button key={id} type="button" role="tab" id={`students-tab-${id}`} aria-selected={tabView === id} aria-controls={`students-panel-${id}`} onClick={() => chooseView(id)}
            className={`flex w-full items-center gap-2 rounded-[10px] border px-4 py-2.5 text-sm font-semibold transition sm:inline-flex sm:w-auto ${tabView === id
              ? 'border-maroon-800 bg-maroon-800 text-white'
              : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-900/30'}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />{title}
          </button>
        ))}
      </div>
    </section>
    {tabView === 'masterlist' ? <div role="tabpanel" id="students-panel-masterlist" aria-labelledby="students-tab-masterlist"><MasterlistPanel /></div> : <div role="tabpanel" id="students-panel-directory" aria-labelledby="students-tab-directory">
    <NurseListCard
      aria-label="Student directory"
      aria-busy={loading}
      icon={IdCard}
      title={<>Student directory<CountChip>{loading ? '…' : listError ? '—' : meta.total.toLocaleString()}</CountChip></>}
      description={`${filtered ? 'Students matching your filters, sorted' : 'Registered students, sorted'} by last name, A–Z. Open a student to see their health record.`}
      toolbar={<StudentFilters embedded filters={filters} onChange={changeFilter} onClear={clearFilters} dateLabel="Registered" />}
    >
      {listError ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600">{listError}</p><button className={secondary} onClick={() => setListRefresh(value => value + 1)}>Try again</button></div> : <><StudentDirectory students={students} loading={loading} filtered={filtered} onClear={clearFilters} onView={id => { setSelectedId(id); setTab('Overview'); }} onDelete={openDelete} /><Pagination meta={meta} page={page} onPage={setPage} loading={loading} summary="pages" /></>}
    </NurseListCard>
    </div>}
    {selectedId && <StudentDetailsModal student={selected} loading={detailLoading} error={detailError} appointments={appointments} history={history} tab={tab} onTab={setTab} onClose={close} emergencyOpen={emergencyOpen} archiveOpen={archiveOpen} onEmergency={() => { setEmergencyError(''); setEmergencyOpen(true); }} onArchive={openArchive} onRestore={restoreStudent} statusSaving={statusSaving} />}
    {archiveOpen && selectedId && <ArchiveStudentModal reason={archiveReason} reasonError={archiveError} onReasonChange={value => { setArchiveReason(value); setArchiveError(''); }} onSubmit={archiveStudent} onClose={closeArchive} saving={statusSaving} />}
    {deleteTarget && <DeleteStudentModal student={deleteTarget} password={deletePassword} error={deleteError} onPasswordChange={value => { setDeletePassword(value); setDeleteError(''); }} onSubmit={deleteStudent} onClose={closeDelete} saving={deleting} />}
    {emergencyOpen && selectedId && <EmergencyModal emergency={emergency} onChange={(field, value) => setEmergency(previous => ({ ...previous, [field]: value }))} onSubmit={submitEmergency} onClose={() => setEmergencyOpen(false)} saving={saving} error={emergencyError} />}
  </div>;
}
