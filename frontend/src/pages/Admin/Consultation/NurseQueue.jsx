import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ClipboardList, CheckCircle, Stethoscope, ListOrdered, Users, UserX, Star, SlidersHorizontal, Square, Play } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import { NurseNoticeModal, NurseToast } from '../../../components/NurseFeedback';
import { queueRowsFrom, consultationPath } from './queueRows';
import QueuePatientModal, { PRIORITY } from './QueuePatientModal';
import QueueOptionsModal, { formatDuration } from './QueueOptionsModal';
import { useNurseTimeGuardBypass } from '../../../services/devTools';

// Queue status shown on each row.
const QUEUE_STATUS = {
  waiting: { label: 'Waiting', className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30' },
  called: { label: 'Now Calling', className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800/30' },
  serving: { label: 'In Consultation', className: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30' },
  skipped: { label: 'Skipped', className: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30' },
  on_hold: { label: 'On Hold', className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-800/30' },
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
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  return Math.min(timeout, Math.max(0, timeout - elapsed));
};
// The table shows priority and status as colored text only: drop the pill's background and border colors.
const textOnly = (className) => className.split(' ').filter(c => !/^(dark:)?(bg|border)-/.test(c)).join(' ');
const clockLeft = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// The queue can only be started during clinic hours, 8:00 AM – 5:00 PM (Manila time).
const CLINIC_OPEN_HOUR = 8;
const CLINIC_CLOSE_HOUR = 17;
const withinClinicHours = (time) => {
  const hour = Number(new Date(time).toLocaleString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', hourCycle: 'h23' }));
  return hour >= CLINIC_OPEN_HOUR && hour < CLINIC_CLOSE_HOUR;
};
// Auto call next stays on for this browser tab until the nurse stops it.
const AUTO_KEY = 'carelink.nurse.autoQueue';
const readAuto = () => { try { return sessionStorage.getItem(AUTO_KEY) === '1'; } catch { return false; } };

/*
 * Nurse → Queue: today's clinic queue. Call next opens the arrival timer; Patient arrived
 * confirms the student and opens their consultation form right away (no extra clicks).
 */
const NurseQueue = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // A visit another nurse already took (HTTP 409) needs acknowledging, so it opens a popup
  const [conflict, setConflict] = useState('');
  const [checkedInStudents, setCheckedInStudents] = useState([]);
  const [stats, setStats] = useState({ completed_today: 0, no_show_today: 0 });
  const [now, setNow] = useState(() => Date.now());
  // The server decides when a called student is skipped; the countdown follows its clock, not this computer's.
  const [clockOffset, setClockOffset] = useState(0);
  const [callTimeout, setCallTimeout] = useState(60);
  const queueRequest = useRef(0);
  // The patient popup: which queue entry it shows.
  const [viewId, setViewId] = useState(null);
  // A called student whose time ran out: the server closes the visit as No Show and the row
  // leaves the list, so the popup keeps the last called row to show "book a new appointment".
  const [missed, setMissed] = useState(null);
  const lastViewed = useRef(null);
  const closeView = useCallback(() => { setViewId(null); setMissed(null); }, []);
  // Queue list → Options: the arrival time a called student has before being skipped.
  const [optionsOpen, setOptionsOpen] = useState(false);
  const closeOptions = useCallback(() => setOptionsOpen(false), []);
  // Start → the queue runs by itself: whenever nobody is being called or seen, the next student is called.
  const [autoQueue, setAutoQueue] = useState(readAuto);
  const autoCalling = useRef(false);
  // Developer Tools → Remove time Guard also lifts the clinic-hours limit (for testing).
  const timeGuardOff = useNurseTimeGuardBypass();
  const toggleAuto = (on) => {
    setAutoQueue(on);
    try { on ? sessionStorage.setItem(AUTO_KEY, '1') : sessionStorage.removeItem(AUTO_KEY); } catch { /* per-tab convenience only */ }
  };

  const queueAction = async (student, action) => {
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post(`/nurse/queue/${student.checkin_id}/${action}`, {}, {
        headers: { 'If-Match': student.sync_version },
      });
      // No success toast: the popup itself moves to the next step. Errors still show.
      if (data.success) await fetchCheckedInStudents(true);
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

  // Arrived confirms the student and goes straight into the consultation form.
  const handleArrived = async (student) => {
    if (loading) return;
    setLoading(true); setMessage('');
    let arrived = false;
    try {
      const { data } = await api.post(`/nurse/queue/${student.checkin_id}/arrived`, {}, { headers: { 'If-Match': student.sync_version } });
      if (!data.success) return;
      arrived = true;
      fetchCheckedInStudents(true).catch(() => {});
    } catch (err) {
      if (err.response?.status === 409) {
        // Usually the arrival time ran out a moment earlier and the server moved them to Skipped.
        setConflict('The arrival time ran out, so this visit was closed. Ask the student to book a new appointment.');
        await fetchCheckedInStudents(true).catch(() => {});
      } else {
        setMessageType('error');
        setMessage(err.response?.data?.message || 'Failed to confirm arrival.');
      }
    } finally {
      setLoading(false);
    }
    // Straight to the form: the Consultation page loads the visit fresh and takes the claim on it.
    // The row is passed along so the form opens without waiting for the queue to load again.
    if (arrived) navigate(consultationPath(student.checkin_id), { state: { visit: { ...student, status: 'serving' } } });
  };


  useEffect(() => {
    fetchCheckedInStudents();
  }, []);
  useEffect(() => {
    if (!viewId) { lastViewed.current = null; return; }
    const row = checkedInStudents.find(s => s.checkin_id === viewId);
    if (row) { lastViewed.current = row; return; }
    if (lastViewed.current?.status === 'called') setMissed({ ...lastViewed.current, status: 'no_show' });
    setViewId(null);
  }, [checkedInStudents, viewId]);
  // Ticks the waiting times and the "now calling" timer.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const serverNow = now + clockOffset;
  const hasOverdueCall = checkedInStudents.some(s => s.status === 'called' && secondsLeft(s.called_at, serverNow, callTimeout) === 0);
  useEffect(() => {
    if (!hasOverdueCall) return undefined;
    // The server skips the student on its next queue request; look until the row changes.
    const timer = setInterval(() => { fetchCheckedInStudents(true).catch(() => {}); }, 2000);
    fetchCheckedInStudents(true).catch(() => {});
    return () => clearInterval(timer);
  }, [hasOverdueCall]);
  useNurseSync(['queue', 'appointments', 'consultations', 'students'], () => fetchCheckedInStudents(true));


  const fetchCheckedInStudents = async (silent = false) => {
    const request = ++queueRequest.current;
    try {
      if (!silent) setPageLoading(true);
      const response = await api.get('/nurse/queue/checkins');
      if (request !== queueRequest.current) return;
      if (response.data.success) {
        const formatted = queueRowsFrom(response);
        // A No Show visit is over: it leaves the list (still counted in "Skipped / No Show";
        // the appointment shows as Expired on the Appointments page).
        setCheckedInStudents(formatted.filter(s => s.status !== 'no_show'));
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

  // Resolves true when someone was called, so the popup can play its success animation.
  const callNext = async () => {
    setLoading(true); setMessage('');
    try {
      const { data } = await api.post('/nurse/queue/call-next');
      const called = data.success ? data.data : null;
      // Show the called row (and its arrival timer) right away; the full list refreshes behind it.
      if (called) {
        setCheckedInStudents(rows => rows.map(r => (r.checkin_id === called.id
          ? { ...r, status: 'called', called_at: called.called_at, sync_version: called.sync_version } : r)));
      }
      fetchCheckedInStudents(true).catch(() => {});
      return called ? called.id : false;
    }
    catch (err) { setMessageType('error'); setMessage(err.response?.data?.message || 'Unable to call next patient.'); return false; }
    finally { setLoading(false); }
  };




  const clinicOpen = timeGuardOff || withinClinicHours(serverNow);
  const deskFree = !checkedInStudents.some(s => ['called', 'serving'].includes(s.status));
  const hasWaiting = checkedInStudents.some(s => s.status === 'waiting');
  // Auto call next: after a called student runs out of time and after a consultation is saved,
  // the desk is free again, so the next student in line is called (while this page is open).
  const autoReady = autoQueue && clinicOpen && deskFree && hasWaiting && !loading && !pageLoading;
  useEffect(() => {
    if (!autoReady || autoCalling.current) return;
    autoCalling.current = true;
    // A failed call stops the automation (its error shows as a toast) instead of retrying in a loop.
    // The called student's popup opens with the arrival timer, ready for Patient arrived.
    callNext().then(id => { if (!id) toggleAuto(false); else { setMissed(null); setViewId(id); } }).finally(() => { autoCalling.current = false; });
  }, [autoReady]); // eslint-disable-line react-hooks/exhaustive-deps

  if (pageLoading) {
    return <NursePageSkeleton label="Loading the queue" />;
  }

  // The queue is already in call order, so the first waiting student is the one Call Next will call.
  const nextInLine = checkedInStudents.find(s => s.status === 'waiting');
  // A patient in consultation stays listed, so a form that was left unsaved can be opened again (Continue).
  const queueRows = checkedInStudents;

  // The popup follows the live queue row, so it moves on as soon as the status changes.
  const viewed = viewId ? checkedInStudents.find(s => s.checkin_id === viewId) || null : null;
  const timeLeftFor = s => secondsLeft(s.called_at, serverNow, callTimeout);
  // Each row's Actions button names the next step; every one opens the patient popup.
  // Minimal flow: Call next calls right away and opens the arrival timer; Arrived opens the
  // consultation form; a patient already in consultation opens the form directly.
  const rowClick = async s => {
    if (loading) return;
    if (s.status === 'waiting' && s.checkin_id === nextInLine?.checkin_id) {
      const id = await callNext();
      if (id) setViewId(id);
      return;
    }
    // In consultation: straight back into their form.
    if (s.status === 'serving') { navigate(consultationPath(s.checkin_id)); return; }
    setViewId(s.checkin_id);
  };

  const rowAction = s => {
    const outline = 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50';
    if (s.status === 'waiting' && s.checkin_id === nextInLine?.checkin_id) return { label: 'Call next', className: 'bg-maroon-800 text-white hover:bg-maroon-900' };
    if (s.status === 'called') return { label: 'Arriving', className: 'bg-green-700 text-white hover:bg-green-800' };
    if (s.status === 'serving') return { label: 'Continue', className: outline };
    if (['skipped', 'on_hold'].includes(s.status)) return { label: 'Close', className: outline };
    return { label: 'View', className: outline };
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/queue" />

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />
      <NurseNoticeModal
        open={Boolean(conflict)}
        title="Visit unavailable"
        message={conflict}
        actionLabel="Got it"
        onClose={() => setConflict('')}
      />

      <>
        {/* Today at a glance */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Waiting', value: checkedInStudents.filter(s => ['waiting', 'called'].includes(s.status)).length, icon: Users, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
            { label: 'In Consultation', value: checkedInStudents.filter(s => s.status === 'serving').length, icon: Stethoscope, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
            { label: 'Completed today', value: stats.completed_today, icon: CheckCircle, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
            { label: 'Skipped / No Show', value: checkedInStudents.filter(s => ['skipped', 'on_hold'].includes(s.status)).length + stats.no_show_today, icon: UserX, tone: 'bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-[10px] border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${tone}`}><Icon className="h-5 w-5" aria-hidden="true" /></span>
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
          title={<>Queue list<CountChip>{queueRows.length}</CountChip></>}
          description={`${new Date(now).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} · Priority students are called first. A called student has ${formatDuration(callTimeout)} to arrive, otherwise their visit is closed${autoQueue ? ', and the next student is called automatically' : ''}.`}
          actions={<div className="flex items-center gap-2">
            {/* Auto call next: on = the next student is called by itself whenever the desk is free (this page open). Off by default. */}
            {!autoQueue && (
              <button type="button" onClick={() => toggleAuto(true)} title="Call the next student automatically whenever no one is being called or seen"
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700/50">
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> Auto call next
              </button>
            )}
            {autoQueue && (
              <button type="button" onClick={() => toggleAuto(false)}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-maroon-200 bg-maroon-50 px-3 py-2 text-xs font-semibold text-maroon-800 transition hover:bg-maroon-100 dark:border-maroon-800/40 dark:bg-maroon-900/20 dark:text-maroon-300">
                <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> {clinicOpen ? 'Stop auto call' : 'Stop auto call (clinic closed)'}
              </button>
            )}
            <button type="button" onClick={() => setOptionsOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700/50">
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> Options
            </button>
          </div>}
        >
          {queueRows.length === 0 ? (
            <div className="py-14 text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50">
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
                  <tr>{['Queue No.', 'Student', 'Priority', 'Appointment Time', 'Waiting Time', 'Status', 'Actions'].map(label => <th scope="col" key={label} className="whitespace-nowrap px-3 py-3 sm:px-4">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {queueRows.map(s => {
                    const priority = PRIORITY[s.priority] || PRIORITY.LOW;
                    const status = QUEUE_STATUS[s.status] || { label: s.status, className: 'bg-gray-100 text-gray-600 border-gray-200' };
                    const left = s.status === 'called' ? timeLeftFor(s) : null;
                    const action = rowAction(s);
                    return (
                      // Hover highlight only; the row itself is not clickable.
                      <tr key={s.checkin_id}
                        className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                        s.status === 'called' ? 'bg-amber-50/50 dark:bg-amber-900/10'
                          : s.status === 'serving' ? 'bg-purple-50/40 dark:bg-purple-900/10'
                          : s.priority === 'HIGH' ? 'bg-red-50/30 dark:bg-red-900/5' : ''
                      }`}>
                        <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-gray-700 sm:px-4 dark:text-gray-200">
                          <span className="inline-flex items-center gap-1">{s.queue_number}{s.priority === 'HIGH' && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-label="Priority" />}</span>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">{s.name}</p>
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs text-gray-400">{s.id}</span>
                            {s.demo && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Demo</span>}
                          </p>
                        </td>
                        <td className="px-3 py-3 sm:px-4">
                          <span className={`text-xs font-semibold ${textOnly(priority.className)}`}>{priority.label}</span>
                          {s.triage?.pain_level != null && <p className="mt-1 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">Pain {s.triage.pain_level}/10</p>}
                          {s.triage?.symptom_duration && <p className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">{s.triage.symptom_duration.replace('-', '–')}</p>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600 sm:px-4 dark:text-gray-300">{s.time_slot}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-gray-600 sm:px-4 dark:text-gray-300">{s.status === 'waiting' ? minutesSince(s.check_in_time, serverNow) : '—'}</td>
                        <td className="px-3 py-3 sm:px-4">
                          <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold ${textOnly(status.className)}`}>
                            {status.label}{left !== null && (
                              <span className="font-mono tabular-nums" aria-label={left === 0 ? 'Time is up' : `${left} seconds left`}>{left === 0 ? 'Time is up' : clockLeft(left)}</span>
                            )}
                          </span>
                        </td>
                        {/* Actions: the queue step, which opens the Call → Arriving → Serve popup. */}
                        <td className="px-3 py-3 sm:px-4">
                          <button type="button" onClick={() => rowClick(s)} disabled={loading}
                            aria-label={`${action.label}: ${s.name}, ${s.queue_number}`}
                            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-[10px] px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${action.className}`}>
                            {action.label}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </NurseListCard>
      </>

      <QueueOptionsModal open={optionsOpen} callTimeout={callTimeout} onClose={closeOptions}
        onSaved={seconds => { setCallTimeout(seconds); setMessageType('success'); setMessage(`Arrival time set to ${formatDuration(seconds)}.`); }}
        onDemoChanged={text => { fetchCheckedInStudents(true); setMessageType('success'); setMessage(text); }} />

      <QueuePatientModal
        student={viewed || missed}
        isNext={viewed?.checkin_id === nextInLine?.checkin_id}
        deskBusy={checkedInStudents.some(s => ['serving', 'called'].includes(s.status) && s.checkin_id !== viewed?.checkin_id)}
        nextName={nextInLine?.name}
        loading={loading}
        timeLeft={viewed?.status === 'called' ? timeLeftFor(viewed) : null}
        onClose={closeView}
        onCall={callNext}
        onArrived={() => handleArrived(viewed)}
        onServe={() => queueAction(viewed, 'serve')}
        onNoShow={() => queueAction(viewed, 'no-show')}
        onGoToConsultation={() => navigate(consultationPath(viewed.checkin_id))}
      />
    </div>
  );
};

export default NurseQueue;
