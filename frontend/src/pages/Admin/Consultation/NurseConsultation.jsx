import { getToken } from '../../../services/session';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Heart, Save, Loader2, ClipboardList, CheckCircle, RotateCcw, SkipForward, Stethoscope, ListOrdered, BellRing, UserRound, ClipboardPenLine, Activity, ArrowLeft } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageHero from '../../../components/NursePageHero';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import { NurseNoticeModal, NurseToast } from '../../../components/NurseFeedback';

const NurseConsultation = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // A visit another nurse already took (HTTP 409) needs acknowledging, so it opens a popup
  const [conflict, setConflict] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [checkedInStudents, setCheckedInStudents] = useState([]);
  const queueRequest = useRef(0);
  const [form, setForm] = useState({
    chief_complaint: '', bp: '', hr: '', rr: '', temp: '', o2_sat: '',
    general_remarks: '', medical_certificate: false, medical_certificate_ref: '',
    follow_up: false, follow_up_date: '',
  });

  const queueAction = async (student, action) => {
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post(`/nurse/queue/${student.checkin_id}/${action}`, {}, {
        headers: { 'If-Match': student.sync_version },
      });
      if (data.success) {
        setMessageType('success');
        setMessage(data.message);
        await fetchCheckedInStudents(true);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data?.message || 'This queue entry was changed by another nurse.');
        await fetchCheckedInStudents(true).catch(() => {});
      } else {
        setMessageType('error');
        setMessage(err.response?.data?.message || 'Failed to update the queue.');
      }
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchCheckedInStudents();
  }, []);
  useEffect(() => {
    if (step !== 2 || !selectedStudent) return;
    const id = selectedStudent.checkin_id;
    return () => { api.delete(`/nurse/queue/${id}/claim`).catch(() => {}); };
  }, [step, selectedStudent]);
  useNurseSync(['queue', 'appointments', 'consultations', 'students'], async () => {
    await fetchCheckedInStudents(true);
    if (step === 2 && selectedStudent) {
      try { await api.post(`/nurse/queue/${selectedStudent.checkin_id}/claim`); }
      catch (err) {
        if (err.response?.status === 409) setConflict(err.response.data.message);
        throw err;
      }
    }
  });

  const openVisit = async student => {
    if (loading) return;
    setLoading(true); setMessage('');
    try {
      await api.post(`/nurse/queue/${student.checkin_id}/claim`);
      setSelectedStudent(student);
      setForm(current => ({ ...current, chief_complaint: student.complaint }));
      setStep(2);
    } catch (err) {
      if (err.response?.status === 409) setConflict(err.response.data?.message || 'Another nurse is already handling this visit.');
      else { setMessageType('error'); setMessage(err.response?.data?.message || 'Unable to open this visit.'); }
    }
    finally { setLoading(false); }
  };

  const fetchCheckedInStudents = async (silent = false) => {
    const request = ++queueRequest.current;
    try {
      if (!silent) setPageLoading(true);
      const token = getToken('nurse');
      const response = await api.get('/nurse/queue/checkins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (request !== queueRequest.current) return;
      if (response.data.success) {
        const data = response.data.data;
        const checkins = Array.isArray(data) ? data : (data?.data || []);
        const formatted = checkins.map(c => ({
          id: c.user?.student_id || c.student_id || 'N/A',
          user_id: c.user_id,
          name: (c.user?.first_name || '') + ' ' + (c.user?.last_name || ''),
          appointment: c.appointment?.service || 'Scheduled visit',
          status: c.status,
          triage: c.triage,
          complaint: c.triage?.chief_complaint || c.chief_complaint || c.appointment?.concern || '',
          checkin_id: c.id,
          appointment_id: c.appointment_id,
          priority: c.triage?.priority || 'LOW',
          queue_number: c.queue_number || 'N/A',
          called_at: c.called_at || null,
          sync_version: c.sync_version,
        }));
        setCheckedInStudents(formatted);
      }
    } catch (err) {
      console.log('Checkins error:', err);
      if (!silent) { setMessageType('error'); setMessage('Unable to load the clinic queue. Retrying automatically.'); }
      if (silent) throw err;
    } finally {
      if (request === queueRequest.current) setPageLoading(false);
    }
  };

  const callNext = async () => {
    setLoading(true); setMessage('');
    try { const { data } = await api.post('/nurse/queue/call-next'); setMessageType('success'); setMessage(data.message); await fetchCheckedInStudents(true); }
    catch (err) { setMessageType('error'); setMessage(err.response?.data?.message || 'Unable to call next patient.'); }
    finally { setLoading(false); }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;

    setLoading(true);
    setMessage('');

    try {
      const token = getToken('nurse');
      const payload = {
        user_id: selectedStudent.user_id || selectedStudent.id,
        appointment_id: selectedStudent.appointment_id || null,
        appointment_checkin_id: selectedStudent.checkin_id || null,
        chief_complaint: form.chief_complaint,
        vital_signs: { bp: form.bp || null, hr: form.hr || null, rr: form.rr || null, temp: form.temp || null, o2_sat: form.o2_sat || null },
        general_remarks: form.general_remarks || null,
        medical_certificate: form.medical_certificate,
        medical_certificate_ref: form.medical_certificate_ref || null,
        follow_up_required: form.follow_up,
        follow_up_date: form.follow_up ? form.follow_up_date || null : null,
      };

      const response = await api.post('/nurse/consultations', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMessageType('success');
        setMessage('Consultation recorded successfully!');
        setStep(1);
        setSelectedStudent(null);
        setForm({
          chief_complaint: '', bp: '', hr: '', rr: '', temp: '', o2_sat: '',
          general_remarks: '', medical_certificate: false, medical_certificate_ref: '',
          follow_up: false, follow_up_date: '',
        });
        fetchCheckedInStudents();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      if (err.response?.status === 409) setConflict(err.response.data?.message || 'This visit was changed by another nurse.');
      else { setMessageType('error'); setMessage(err.response?.data?.message || 'Failed to save consultation.'); }
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30 dark:focus:border-maroon-300";
  const labelClass = "text-xs font-semibold text-gray-500 dark:text-gray-400 block mb-1.5";

  if (pageLoading) {
    return <NursePageSkeleton label="Loading consultations" />;
  }

  const statusBadge = {
    called: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 animate-pulse',
    serving: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    waiting: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    skipped: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  const linkButton = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50';
  const someoneCalled = checkedInStudents.some(s => ['serving', 'called'].includes(s.status));

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageHero
        id="nurse-consultation-title"
        title="Consultation"
        description="Call students from the clinic queue, then record their consultation."
        art={Stethoscope}
      />

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />
      <NurseNoticeModal
        open={Boolean(conflict)}
        title="Visit unavailable"
        message={conflict}
        actionLabel="Got it"
        onClose={() => setConflict('')}
      />

      {step === 1 && (
        <NurseListCard
          aria-label="Clinic queue"
          icon={ListOrdered}
          title={<>Clinic queue<CountChip>{checkedInStudents.length}</CountChip></>}
          description="Confirm arrival or skip after calling attempts. Skipped students stay in the waiting queue until marked returned or their original check-in deadline passes."
          actions={
            <button type="button" onClick={callNext} disabled={loading || someoneCalled}
              title={someoneCalled ? 'Finish the student who is called or being served first' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Call Next
            </button>
          }
        >
          {checkedInStudents.length === 0 ? (
            <div className="py-14 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50">
                <ClipboardList className="h-8 w-8 text-gray-300 dark:text-gray-500" />
              </span>
              <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No Checked-in Students</h3>
              <p className="mt-1 text-sm text-gray-400">Students who check in via QR will appear here.</p>
            </div>
          ) : (
            <ul className="space-y-2 p-3 sm:p-4">
              {checkedInStudents.map(s => (
                <li key={s.checkin_id} className={`space-y-3 rounded-lg border p-4 ${
                  s.status === 'called' ? 'border-yellow-200 bg-yellow-50/40 dark:border-yellow-800/40 dark:bg-yellow-900/10'
                    : s.status === 'serving' ? 'border-green-200 bg-green-50/40 dark:border-green-800/40 dark:bg-green-900/10'
                    : 'border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 px-2 text-sm font-bold text-maroon-800 tabular-nums dark:bg-maroon-900/20 dark:text-maroon-400">
                        {s.queue_number}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-gray-900 dark:text-white">{s.name}</h3>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{s.id} · {s.appointment}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[s.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {s.status.toUpperCase().replace('_', ' ')}
                    </span>
                  </div>

                  {s.complaint && <p className="text-sm text-gray-600 dark:text-gray-300">{s.complaint}</p>}

                  {s.status === 'called' && (
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => queueAction(s, 'arrived')} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50">
                        <CheckCircle className="h-4 w-4" /> Patient Arrived
                      </button>
                      <button onClick={() => queueAction(s, 'recall')} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500 px-3 py-2 text-sm font-semibold text-yellow-700 transition hover:bg-yellow-50 disabled:opacity-50 dark:text-yellow-400 dark:hover:bg-yellow-900/20">
                        <RotateCcw className="h-4 w-4" /> Recall
                      </button>
                      <button onClick={() => queueAction(s, 'skip')} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-red-500 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20">
                        <SkipForward className="h-4 w-4" /> Skip
                      </button>
                    </div>
                  )}
                  {s.status === 'skipped' && (
                    <button onClick={() => queueAction(s, 'returned')} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-green-600 px-3 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/20">
                      <RotateCcw className="h-4 w-4" /> Mark Returned
                    </button>
                  )}
                  {['waiting', 'serving'].includes(s.status) && (
                    <div className="flex flex-wrap gap-2">
                      <Link className={linkButton} to={`/nurse/students?student=${s.user_id}`}><UserRound className="h-4 w-4" /> Open Student</Link>
                      {s.status === 'serving' && (
                        <button className="inline-flex items-center gap-1.5 rounded-lg bg-maroon-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50" disabled={loading} onClick={() => openVisit(s)}>
                          <ClipboardPenLine className="h-4 w-4" /> Open Visit
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </NurseListCard>
      )}

      {step === 2 && selectedStudent && (
        <section aria-labelledby="consultation-form-title" className="overflow-hidden rounded-lg border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
              <ClipboardPenLine className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="consultation-form-title" className="font-bold text-gray-900 dark:text-white">Consultation for {selectedStudent.name}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{selectedStudent.id} · {selectedStudent.appointment} · Queue {selectedStudent.queue_number}</p>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-5 p-4 lg:p-6">
            <div className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-700/40">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-maroon-800 dark:text-maroon-400" />
              <p className="text-gray-700 dark:text-gray-200">
                <span className="font-semibold">Triage:</span> {selectedStudent.priority} / {selectedStudent.triage?.severity}.{' '}
                <span className="font-semibold">Red flags:</span> {selectedStudent.triage?.red_flags?.join(', ') || 'None'}. {selectedStudent.triage?.notes}
              </p>
            </div>

            <div>
              <label className={labelClass}>Chief Complaint *</label>
              <textarea name="chief_complaint" value={form.chief_complaint} onChange={handleChange} rows={3}
                className={inputClass} placeholder="Describe the student's main concern..." required />
            </div>

            <div>
              <label className={`${labelClass} flex items-center gap-2`}>
                <Heart className="h-4 w-4 text-red-500" /><span>Vital Signs (Optional)</span>
              </label>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {[
                  { name: 'bp', label: 'BP', placeholder: '120/80' },
                  { name: 'hr', label: 'HR', placeholder: '72 bpm' },
                  { name: 'rr', label: 'RR', placeholder: '16' },
                  { name: 'temp', label: 'Temp', placeholder: '36.5°C' },
                  { name: 'o2_sat', label: 'O2 Sat', placeholder: '98%' }
                ].map(v => (
                  <div key={v.name}>
                    <label className="mb-1 block text-[11px] font-medium text-gray-400">{v.label}</label>
                    <input name={v.name} value={form[v.name]} onChange={handleChange} className={inputClass} placeholder={v.placeholder} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>General Remarks</label>
              <textarea name="general_remarks" value={form.general_remarks} onChange={handleChange} rows={3}
                className={inputClass} placeholder="Additional notes..." />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Issue Medical Certificate?</span>
                  <input type="checkbox" name="medical_certificate" checked={form.medical_certificate} onChange={handleChange} className="h-5 w-5 accent-maroon-800" />
                </label>
                {form.medical_certificate && (
                  <div>
                    <label className={labelClass}>Certificate Reference</label>
                    <input name="medical_certificate_ref" value={form.medical_certificate_ref} onChange={handleChange} className={inputClass} placeholder="MED-2024-001" />
                  </div>
                )}
              </div>
              <div className="space-y-3">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/50">
                  <span className="text-sm font-semibold text-gray-800 dark:text-white">Follow-up Required?</span>
                  <input type="checkbox" name="follow_up" checked={form.follow_up} onChange={handleChange} className="h-5 w-5 accent-maroon-800" />
                </label>
                {form.follow_up && (
                  <div>
                    <label className={labelClass}>Follow-up Date</label>
                    <input type="date" name="follow_up_date" value={form.follow_up_date} onChange={handleChange} className={inputClass} />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-700">
              <button type="button" onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50">
                <ArrowLeft className="h-4 w-4" /> Back to Queue
              </button>
              <button type="submit" disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-maroon-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span>{loading ? 'Saving...' : 'Save Consultation'}</span>
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};

export default NurseConsultation;
