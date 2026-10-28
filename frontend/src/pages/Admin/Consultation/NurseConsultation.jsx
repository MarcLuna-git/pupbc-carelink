import { getToken } from '../../../services/session';
import { Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { ClipboardList, CheckCircle, RotateCcw, Stethoscope, ListOrdered, BellRing, UserRound, ClipboardPenLine, Users, UserX, Star, LogIn } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import { NurseNoticeModal, NurseToast } from '../../../components/NurseFeedback';
import ConsultationVisit from './ConsultationVisit';

// Triage priority shown in the queue table.
const PRIORITY = {
  HIGH: { label: 'Priority', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30' },
  LOW: { label: 'Regular', className: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30' },
};

// Queue status shown in the table.
const QUEUE_STATUS = {
  waiting: { label: 'Waiting', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30' },
  called: { label: 'Now Calling', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30' },
  serving: { label: 'In Consultation', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30' },
  skipped: { label: 'Skipped', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30' },
  no_show: { label: 'No Show', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30' },
};

// "5 mins" since check-in; "0:42" (m:ss) left before a called student is skipped.
const minutesSince = (value, now) => {
  const start = value ? new Date(value).getTime() : NaN;
  if (Number.isNaN(start)) return '—';
  const minutes = Math.max(0, Math.floor((now - start) / 60000));
  return minutes < 60 ? `${minutes} min${minutes === 1 ? '' : 's'}` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
};
// Seconds a called student still has, counted on the server's clock (`now` is already corrected for it).
const secondsLeft = (calledAt, now, timeout) => {
  const start = calledAt ? new Date(calledAt).getTime() : NaN;
  if (Number.isNaN(start)) return timeout;
  return Math.min(timeout, Math.max(0, timeout - Math.floor((now - start) / 1000)));
};
const clockLeft = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

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
  const [stats, setStats] = useState({ completed_today: 0, no_show_today: 0 });
  const [now, setNow] = useState(() => Date.now());
  // The server decides when a called student is skipped; the countdown follows its clock, not this computer's.
  const [clockOffset, setClockOffset] = useState(0);
  const [callTimeout, setCallTimeout] = useState(60);
  const queueRequest = useRef(0);
  // Set once the open visit is saved, so the sync loop stops re-claiming a finished visit.
  const [visitSaved, setVisitSaved] = useState(false);
  const visitSavedRef = useRef(false);

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

  // Arrived confirms the student and goes straight into their consultation form.
  const handleArrived = async (student) => {
    if (loading) return;
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post(`/nurse/queue/${student.checkin_id}/arrived`, {}, { headers: { 'If-Match': student.sync_version } });
      if (!data.success) return;
      await fetchCheckedInStudents(true).catch(() => {});
      await api.post(`/nurse/queue/${student.checkin_id}/claim`);
      setSelectedStudent({ ...student, status: 'serving' });
      setVisitSaved(false); visitSavedRef.current = false;
      setStep(2);
    } catch (err) {
      if (err.response?.status === 409) {
        setConflict(err.response.data?.message || 'This queue entry was changed. The student may already have been skipped; use Recall if they are here.');
        await fetchCheckedInStudents(true).catch(() => {});
      } else {
        setMessageType('error');
        setMessage(err.response?.data?.message || 'Failed to confirm arrival.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleServe = async (student) => {
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post(`/nurse/queue/${student.checkin_id}/serve`, {}, {
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
        setMessage(err.response?.data?.message || 'Failed to serve patient.');
      }
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchCheckedInStudents();
  }, []);
  // Ticks the waiting times and the "now calling" timer.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const serverNow = now + clockOffset;
  const hasOverdueCall = checkedInStudents.some(s => s.status === 'called' && secondsLeft(s.called_at, serverNow, callTimeout) === 0);
  useEffect(() => {
    if (step !== 1 || !hasOverdueCall) return undefined;
    // The server skips the student on its next queue request; look until the row changes.
    const timer = setInterval(() => { fetchCheckedInStudents(true).catch(() => {}); }, 2000);
    fetchCheckedInStudents(true).catch(() => {});
    return () => clearInterval(timer);
  }, [step, hasOverdueCall]);
  useEffect(() => {
    if (step !== 2 || !selectedStudent || visitSaved) return;
    const id = selectedStudent.checkin_id;
    return () => { api.delete(`/nurse/queue/${id}/claim`).catch(() => {}); };
  }, [step, selectedStudent, visitSaved]);
  useNurseSync(['queue', 'appointments', 'consultations', 'students'], async () => {
    await fetchCheckedInStudents(true);
    if (step === 2 && selectedStudent && !visitSaved) {
      try { await api.post(`/nurse/queue/${selectedStudent.checkin_id}/claim`); }
      catch (err) {
        // Refused because the visit was just saved: nothing to warn about.
        if (err.response?.status === 409 && !visitSavedRef.current) setConflict(err.response.data.message);
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
      setVisitSaved(false);
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
          check_in_time: c.check_in_time || c.checked_in_at || c.created_at || null,
          time_slot: c.appointment?.time_slot || '—',
          appointment_details: c.appointment || {},
          sync_version: c.sync_version,
        }));
        setCheckedInStudents(formatted);
        if (response.data.stats) setStats(response.data.stats);
        if (response.data.server_time) setClockOffset(new Date(response.data.server_time).getTime() - Date.now());
        if (response.data.call_timeout_seconds) setCallTimeout(response.data.call_timeout_seconds);
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



  if (pageLoading) {
    return <NursePageSkeleton label="Loading consultations" />;
  }

  const someoneCalled = checkedInStudents.some(s => ['serving', 'called'].includes(s.status));
  // The queue is already in call order, so the first waiting student is the one Call Next will call.
  const nextInLine = checkedInStudents.find(s => s.status === 'waiting');

  const btn = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50';
  const primary = `${btn} bg-maroon-800 text-white hover:bg-maroon-900`;
  const outline = `${btn} border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50`;
  const queueActions = s => {
    if (s.status === 'called') return (
      <div className="flex gap-1.5">
        <button type="button" onClick={() => handleArrived(s)} disabled={loading} className={`${btn} bg-green-700 text-white hover:bg-green-800`}><CheckCircle className="h-3.5 w-3.5" /> Arrived</button>
        <button type="button" onClick={() => queueAction(s, 'recall')} disabled={loading} title="Call this student again and restart the one-minute timer" className={outline}><RotateCcw className="h-3.5 w-3.5" /> Recall</button>
      </div>
    );
    if (s.status === 'serving') return (
      <div className="flex gap-1.5">
        <button type="button" onClick={() => openVisit(s)} disabled={loading} className={primary}><ClipboardPenLine className="h-3.5 w-3.5" /> Open Visit</button>
        <Link to={`/nurse/students?student=${s.user_id}`} className={outline}><UserRound className="h-3.5 w-3.5" /> Student</Link>
      </div>
    );
    if (s.status === 'skipped') return (
      <button type="button" onClick={() => queueAction(s, 'recall')} disabled={loading || someoneCalled}
        title={someoneCalled ? 'Finish the student who is called or being served first' : 'The student is back: call them again'}
        className={outline}><RotateCcw className="h-3.5 w-3.5" /> Recall</button>
    );
    if (s.status === 'waiting' && s.checkin_id === nextInLine?.checkin_id) return (
      <button type="button" onClick={callNext} disabled={loading || someoneCalled} title={someoneCalled ? 'Finish the student who is called or being served first' : undefined} className={primary}><BellRing className="h-3.5 w-3.5" /> Call Next</button>
    );
    if (s.status === 'waiting') return (
      <button type="button" onClick={() => handleServe(s)} disabled={loading || someoneCalled} className={`${btn} bg-blue-600 text-white hover:bg-blue-700`}><LogIn className="h-3.5 w-3.5" /> Serve</button>
    );
    return <span className="text-xs text-gray-400">—</span>;
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      {step === 1 && <NursePageTitle path="/nurse/consultation" />}

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />
      <NurseNoticeModal
        open={Boolean(conflict)}
        title="Visit unavailable"
        message={conflict}
        actionLabel="Got it"
        onClose={() => setConflict('')}
      />

      {step === 1 && (<>
        {/* Today at a glance */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Waiting', value: checkedInStudents.filter(s => ['waiting', 'called'].includes(s.status)).length, icon: Users, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
            { label: 'In Consultation', value: checkedInStudents.filter(s => s.status === 'serving').length, icon: Stethoscope, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
            { label: 'Completed today', value: stats.completed_today, icon: CheckCircle, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
            { label: 'Skipped / No Show', value: checkedInStudents.filter(s => s.status === 'skipped').length + stats.no_show_today, icon: UserX, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900 tabular-nums dark:text-white">{value}<span className="ml-1 text-xs font-medium text-gray-400">student{value === 1 ? '' : 's'}</span></p>
              </div>
            </div>
          ))}
        </div>

        <NurseListCard
          aria-label="Clinic queue"
          icon={ListOrdered}
          title={<>Queue list<CountChip>{checkedInStudents.length}</CountChip></>}
          description={`${new Date(now).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · Priority students are called first. A called student has 1 minute to arrive, otherwise they are skipped and can be recalled.`}
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Today's clinic queue in call order</caption>
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  <tr>{['#', 'Student', 'Priority', 'Appointment Time', 'Waiting Time', 'Status', 'Actions'].map(label => <th scope="col" key={label} className="whitespace-nowrap px-3 py-3 sm:px-4">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {checkedInStudents.map(s => {
                    const priority = PRIORITY[s.priority] || PRIORITY.LOW;
                    const status = QUEUE_STATUS[s.status] || { label: s.status, className: 'bg-gray-100 text-gray-600 border-gray-200' };
                    return (
                      <tr key={s.checkin_id}
                        onClick={s.status === 'serving' ? () => openVisit(s) : undefined}
                        title={s.status === 'serving' ? 'Open this visit' : undefined}
                        className={`${s.status === 'serving' ? 'cursor-pointer hover:bg-purple-50 dark:hover:bg-purple-900/20' : ''} ${
                        s.status === 'called' ? 'bg-amber-50/50 dark:bg-amber-900/10'
                          : s.status === 'serving' ? 'bg-purple-50/40 dark:bg-purple-900/10'
                          : s.priority === 'HIGH' ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                      }`}>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-gray-700 sm:px-4 dark:text-gray-200">
                          <span className="inline-flex items-center gap-1">{s.queue_number}{s.priority === 'HIGH' && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Priority" />}</span>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">{s.name}</p>
                          <p className="font-mono text-xs text-gray-400">{s.id}</p>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${priority.className}`}>{priority.label}</span>
                          {s.triage?.pain_level != null && <p className="mt-1 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">Pain {s.triage.pain_level}/10</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600 sm:px-4 dark:text-gray-300">{s.time_slot}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600 sm:px-4 dark:text-gray-300">{s.status === 'waiting' ? minutesSince(s.check_in_time, serverNow) : '—'}</td>
                        <td className="px-3 py-3 sm:px-4">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                            {status.label}{s.status === 'called' && (() => {
                              const left = secondsLeft(s.called_at, serverNow, callTimeout);
                              return <span className="font-mono tabular-nums" aria-label={left === 0 ? 'Time is up' : `${left} seconds left`}>{left === 0 ? 'Time is up' : clockLeft(left)}</span>;
                            })()}
                          </span>
                        </td>
                        <td className="px-3 py-3 sm:px-4" onClick={e => e.stopPropagation()}>{queueActions(s)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </NurseListCard>
      </>)}

      {step === 2 && selectedStudent && (
        <ConsultationVisit
          key={selectedStudent.checkin_id}
          visit={selectedStudent}
          onBack={() => { setStep(1); setSelectedStudent(null); fetchCheckedInStudents(true).catch(() => {}); }}
          onSaved={() => { visitSavedRef.current = true; setVisitSaved(true); fetchCheckedInStudents(true).catch(() => {}); }}
          onConflict={setConflict}
          notify={(text, type) => { setMessageType(type); setMessage(text); }}
        />
      )}
    </div>
  );
};

export default NurseConsultation;
