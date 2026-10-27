import { getToken } from '../../../services/session';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle, XCircle, Search, User, Loader2, X, FileText, Stethoscope, ListChecks, Inbox, List, Table2, Users, Phone, Eye, CheckCircle2, LogIn } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageHero from '../../../components/NursePageHero';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import { formatAppointmentDate } from '../../../utils/appointmentDate';
import { Pagination } from '../Students/StudentDirectory';
import { NurseToast } from '../../../components/NurseFeedback';

// Same services students can book on their Appointments page.
const SERVICES = ['Consultation', 'Medical Certificate', 'Medical Clearance', 'Follow-up Checkup', 'Vaccination', 'Other'];
const fieldClass = 'w-full rounded-lg border border-gray-200 bg-white py-2.5 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const PER_PAGE = 5;

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'in_consultation', label: 'In consultation' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

// An approved appointment's stage follows its kiosk check-in: in the queue, or being served.
const QUEUE_STAGES = { waiting: 'waiting', called: 'waiting', skipped: 'waiting', serving: 'in_consultation' };
const stageOf = app => {
  const checkin = app.latest_checkin;
  return app.status === 'approved' && checkin && !checkin.is_walk_in ? QUEUE_STAGES[checkin.status] || app.status : app.status;
};
const stageLabel = stage => stage.replace('_', ' ');

// Status badge text per stage.
const STAGE_LABELS = {
  pending: 'Pending Approval',
  approved: 'Approved / For Check-in',
  waiting: 'Waiting Queue',
  in_consultation: 'In Consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  expired: 'Expired',
};
const badgeLabel = stage => STAGE_LABELS[stage] || stageLabel(stage);

// List (cards) or table view, remembered per browser.
const VIEW_KEY = 'nurse-appointments-view';
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === 'table' ? 'table' : 'list'; } catch { return 'list'; } };

const NurseAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [page, setPage] = useState(1);
  const [view, setView] = useState(readView);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, from: 0, to: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // The list is fetched with this, so typing does not send a request per keystroke.
  const searchTerm = useDebouncedValue(search, 300);
  const [service, setService] = useState('');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [cancelModal, setCancelModal] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const actionLoadingRef = useRef(0);
  const requestId = useRef(0);

  const fetchAppointments = useCallback(async signal => {
    if (document.visibilityState === 'hidden') return;
    const request = ++requestId.current;
    try {
      const token = getToken('nurse');
      const res = await api.get('/nurse/appointments', {
        signal: signal instanceof AbortSignal ? signal : undefined,
        headers: { Authorization: `Bearer ${token}` },
        params: {
          status: filter !== 'all' ? filter : undefined,
          search: searchTerm || undefined,
          service: service || undefined,
          date: date || undefined,
          page,
          per_page: PER_PAGE,
        },
      });
      if (request !== requestId.current) return;
      const data = res.data.data;
      const latest = Array.isArray(data) ? data : (data?.data || []);
      // An action or sync can empty the last page; step back to the new last page.
      if (data?.last_page && page > data.last_page) { setPage(data.last_page); return; }
      setAppointments(latest);
      setMeta({ total: data?.total ?? latest.length, last_page: data?.last_page || 1, from: data?.from || 0, to: data?.to || 0 });
      if (res.data.counts) setCounts(res.data.counts);
      setSelectedAppointment(previous => previous ? latest.find(item => item.id === previous.id) || previous : null);
    } catch (err) {
      if (err.code !== 'ERR_CANCELED') console.error(err);
    } finally {
      if (request === requestId.current) { setLoading(false); }
    }
  }, [filter, searchTerm, service, date, page]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchAppointments(controller.signal);
    return () => controller.abort();
  }, [filter, fetchAppointments]);

  useNurseSync(['appointments', 'students'], fetchAppointments, JSON.stringify([filter, searchTerm, service, date, page]));

  const handleApprove = async (id) => {
    const loadingId = ++actionLoadingRef.current;
    try {
      const token = getToken('nurse');
      await api.patch(`/nurse/appointments/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (loadingId !== actionLoadingRef.current) return;
      showMessage('Appointment approved successfully!', 'success');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      if (loadingId !== actionLoadingRef.current) return;
      showMessage(err.response?.data?.message || 'Failed to approve', 'error');
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    const loadingId = ++actionLoadingRef.current;
    try {
      const token = getToken('nurse');
      await api.patch(`/nurse/appointments/${rejectModal}/reject`,
        { reason: rejectReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (loadingId !== actionLoadingRef.current) return;
      showMessage('Appointment rejected.', 'success');
      setRejectModal(null);
      setRejectReason('');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      if (loadingId !== actionLoadingRef.current) return;
      showMessage(err.response?.data?.message || 'Failed to reject', 'error');
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) return;
    const loadingId = ++actionLoadingRef.current;
    try {
      const token = getToken('nurse');
      await api.patch(`/nurse/appointments/${cancelModal}/cancel`, { reason: cancelReason }, { headers: { Authorization: `Bearer ${token}` } });
      if (loadingId !== actionLoadingRef.current) return;
      showMessage('Appointment cancelled.', 'success');
      setCancelModal(null);
      setCancelReason('');
      setSelectedAppointment(null);
      fetchAppointments();
    } catch (err) {
      if (loadingId !== actionLoadingRef.current) return;
      showMessage(err.response?.data?.message || 'Failed to cancel', 'error');
    }
  };

  const handleComplete = () => { window.location.assign('/nurse/consultation'); };
const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatDate = (value) => formatAppointmentDate(value, { weekday: 'short' });

  const changeView = next => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* view still switches for this visit */ }
  };

  // When the student booked it — the list is ordered newest booking first.
  const formatBooked = (value) => {
    const booked = new Date(value);
    if (!value || Number.isNaN(booked.getTime())) return '';
    const minutes = Math.floor((Date.now() - booked.getTime()) / 60000);
    if (minutes < 1) return 'Booked just now';
    if (minutes < 60) return `Booked ${minutes} min ago`;
    if (minutes < 24 * 60) return `Booked ${Math.floor(minutes / 60)} hr ago`;
    return `Booked ${booked.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`;
  };

  const filtered = Array.isArray(appointments) ? appointments : [];

  const statusColors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30',
    approved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30',
    waiting: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30',
    in_consultation: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/30',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/30',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    expired: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-700',
  };

  const statusConfig = {
    pending: { icon: Clock },
    approved: { icon: CheckCircle },
    waiting: { icon: Users },
    in_consultation: { icon: Stethoscope },
    completed: { icon: CheckCircle2 },
    cancelled: { icon: XCircle },
    rejected: { icon: XCircle },
    expired: { icon: XCircle },
  };

  // On phones the badge and the action buttons shrink to their icons; the label stays as a tooltip and for screen readers.
  const statusBadge = app => {
    const stage = stageOf(app);
    const StatusIcon = (statusConfig[stage] || statusConfig.pending).icon;
    const label = badgeLabel(stage);
    return (
      <span title={label} aria-label={label} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border p-1.5 text-[11px] font-semibold sm:px-2.5 sm:py-1 ${statusColors[stage] || statusColors.expired}`}>
        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
      </span>
    );
  };

  const btnBase = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg p-2 text-xs font-semibold transition disabled:opacity-50 sm:px-3 sm:py-1.5';
  const primaryBtn = `${btnBase} bg-maroon-800 text-white hover:bg-maroon-900`;
  const outlineBtn = `${btnBase} border border-maroon-200 bg-white text-maroon-800 hover:bg-maroon-50 dark:border-maroon-800/50 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20`;
  const declineBtn = `${btnBase} bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30`;
  const approvedBtn = `${btnBase} bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30`;
  const serveBtn = `${btnBase} bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900`;
  const declinedBtn = `${btnBase} bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-900/20 dark:text-gray-300 dark:hover:bg-gray-900/30`;
  const actionBtn = (className, Icon, label, onClick, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className} title={label} aria-label={label}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
    </button>
  );

  /*
   * One set of actions per stage, shared by the list cards and the table rows:
   * Pending / Waiting / In Consultation / Completed / Cancelled: Approve / Decline.
   * Approved: Approved (view-only). Rejected / Expired: Declined (view-only).
   * View Details available via modal for all statuses.
   */
  const rowActions = app => {
    const stage = stageOf(app);
    const checkin = app.latest_checkin;
    const details = actionBtn(outlineBtn, Eye, 'View Details', () => setSelectedAppointment(app));
    let main;
    if (app.status === 'pending') {
      main = <>
        {actionBtn(primaryBtn, CheckCircle, 'Approve', () => handleApprove(app.id))}
        {actionBtn(declineBtn, X, 'Decline', () => setRejectModal(app.id))}
      </>;
    } else if (stage === 'waiting') {
      main = <>
        {actionBtn(primaryBtn, CheckCircle, 'Approve', () => handleApprove(app.id))}
        {actionBtn(declineBtn, X, 'Decline', () => setRejectModal(app.id))}
      </>;
    } else if (app.status === 'completed') {
      main = actionBtn(primaryBtn, CheckCircle2, 'Completed', () => setSelectedAppointment(app));
    } else if (app.status === 'approved') {
      main = actionBtn(approvedBtn, CheckCircle2, 'Approved', () => setSelectedAppointment(app));
    } else if (app.status === 'rejected' || app.status === 'expired') {
      main = actionBtn(declinedBtn, XCircle, 'Declined', () => setSelectedAppointment(app));
    } else {
      main = details;
    }
    return (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {main}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-6">
      <NursePageHero
        id="nurse-appointments-title"
        title="Appointments"
        description="Review student bookings, approve or reject requests, and send approved visits to the clinic queue."
        art={Calendar}
      />

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      {/* Search and filters card, right under the hero: heading, then a nested panel with search on row 1 and filters on row 2. */}
      <section aria-labelledby="appointment-filters-title" className="rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:p-6">
        <h2 id="appointment-filters-title" className="font-bold text-gray-900 dark:text-white">Search and filters</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Find a student's booking, or narrow the requests by service and appointment date.</p>
        <div className="mt-4 space-y-3 rounded-lg border border-gray-100 p-3 dark:border-gray-700 sm:p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              aria-label="Search appointments"
              className={`${fieldClass} pl-10 pr-4`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search student name or student number..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <select aria-label="Filter by service" className={`${fieldClass} px-3`} value={service} onChange={(e) => { setService(e.target.value); setPage(1); }}>
              <option value="">All services</option>
              {SERVICES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <input type="date" aria-label="Filter by appointment date" className={`${fieldClass} px-3`} value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
            <button type="button" onClick={() => { setSearch(''); setService(''); setDate(''); setPage(1); }} disabled={!search && !service && !date}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {/* Status tabs: their own card under the search, filtering the requests below. */}
      <section aria-label="Appointment status" className="rounded-lg border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <div role="group" aria-label="Filter appointments by status" className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map(f => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`flex-1 shrink-0 whitespace-nowrap rounded-md px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${
                filter === f.key
                  ? 'bg-maroon-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
              }`}>
              {f.label}
              <span className="ml-1.5 text-[10px] opacity-75">({counts[f.key] ?? 0})</span>
            </button>
          ))}
        </div>
      </section>

      {/* Requests card: its own heading, and the bookings in a nested panel. */}
      <NurseListCard
        aria-label="Appointment requests"
        aria-busy={loading}
        icon={ListChecks}
        title={<>Appointment requests<CountChip>{loading ? '…' : meta.total}</CountChip></>}
        description="Newest bookings first. Open one to review it, or approve and reject pending requests right here."
        actions={
          <div role="group" aria-label="Choose how to view appointments" className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700/60">
            {[{ key: 'list', label: 'List', icon: List }, { key: 'table', label: 'Table', icon: Table2 }].map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                  view === key ? 'bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="p-3 sm:p-4"><NursePageSkeleton contentOnly label="Loading appointments" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-14 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50"><Inbox className="h-8 w-8 text-gray-300 dark:text-gray-500" /></span>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No appointments found</p>
            <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
              {filter !== 'all' ? `No ${stageLabel(filter)} appointments.` : 'All clear!'}
            </p>
          </div>
        ) : (
          view === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Appointment requests, newest booking first</caption>
                <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                  <tr>{['Student', 'Appointment Reason', 'Appointment', 'Status', 'Actions'].map(label => <th scope="col" key={label} className="whitespace-nowrap px-3 py-3 sm:px-4">{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(app => (
                    <tr key={app.id} onClick={() => setSelectedAppointment(app)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="px-3 py-3 sm:px-4">
                        <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">{app.user?.first_name} {app.user?.last_name}</p>
                        <p className="font-mono text-xs text-gray-400">{app.user?.student_id || ''}</p>
                        <p className="whitespace-nowrap text-xs text-gray-400"><span className="font-mono">{app.reference_number}</span>{app.created_at && ` · ${formatBooked(app.created_at)}`}</p>
                      </td>
                      {/* Reason: the student's stated concern, with the booked service underneath. */}
                      <td className="px-3 py-3 sm:px-4">
                        <div className="min-w-[150px] max-w-[240px]">
                          <p className={`line-clamp-1 font-medium ${app.concern ? 'text-gray-900 dark:text-white' : 'italic text-gray-400'}`} title={app.concern || undefined}>{app.concern || 'No concern specified'}</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400">{app.service}</p>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-gray-600 sm:px-4 dark:text-gray-300">{formatDate(app.appointment_date)}<span className="block text-xs text-gray-400">{app.time_slot}</span></td>
                      <td className="px-3 py-3 sm:px-4">{statusBadge(app)}</td>
                      <td className="px-3 py-3 sm:px-4">{rowActions(app)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-2 p-3 sm:p-4">
              {filtered.map(app => {
                return (
                  <motion.div key={app.id} layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setSelectedAppointment(app)}
                    className="cursor-pointer rounded-lg border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/40">

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-maroon-50 dark:bg-maroon-900/20">
                          <User className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                              {app.user?.first_name} {app.user?.last_name}
                            </h3>
                            <span className="text-xs text-gray-400 font-mono">{app.user?.student_id || ''}</span>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{app.service}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">
                            <span className="font-mono">{app.reference_number}</span>
                            {app.created_at && <span> · {formatBooked(app.created_at)}</span>}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-400 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{formatDate(app.appointment_date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />{app.time_slot}
                            </span>
                          </div>
                          {app.concern && (
                            <p className="text-xs text-gray-400 dark:text-gray-400 mt-1.5 line-clamp-1">{app.concern}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        {statusBadge(app)}
                        {rowActions(app)}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        )}
        {meta.total > 0 && <Pagination meta={meta} page={page} onPage={setPage} loading={loading} entity="appointments" />}
      </NurseListCard>

      <AnimatePresence>
        {selectedAppointment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedAppointment(null)}>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
              style={{ maxHeight: '90vh' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[stageOf(selectedAppointment)]}`}>
                  {(() => { const Icon = (statusConfig[stageOf(selectedAppointment)] || statusConfig.pending).icon; return <Icon className="w-3.5 h-3.5" />; })()}
                  {badgeLabel(stageOf(selectedAppointment))}
                </span>
                <button onClick={() => setSelectedAppointment(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 pb-5" style={{ WebkitOverflowScrolling: 'touch' }}>

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-maroon-50 dark:bg-maroon-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-maroon-800 dark:text-maroon-400" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      {selectedAppointment.user?.first_name} {selectedAppointment.user?.last_name}
                    </h3>
                    <p className="text-xs text-gray-400 dark:text-gray-400 font-mono">
                      {selectedAppointment.user?.student_id} · {selectedAppointment.reference_number}
                    </p>
                    {selectedAppointment.created_at && (
                      <p className="text-xs text-gray-400 dark:text-gray-400 mt-0.5">{formatBooked(selectedAppointment.created_at)}</p>
                    )}
                  </div>
                </div>

                {selectedAppointment.status === 'pending' && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/20 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">⏳ Pending Review</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">This appointment needs your approval or rejection.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider">Service</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppointment.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedAppointment.appointment_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider">Time</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppointment.time_slot}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-400 uppercase tracking-wider">Concern</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAppointment.concern || 'No concern specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedAppointment.status === 'pending' ? (
                    <>
                      <button
                        onClick={() => handleApprove(selectedAppointment.id)}
                        className="w-full py-3 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                        {<CheckCircle className="w-4 h-4" />}
                        Approve Appointment
                      </button>
                      <button
                        onClick={() => { setRejectModal(selectedAppointment.id); }}
                        className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm border border-red-200 dark:border-red-800/20">
                        Reject Appointment
                      </button>
                    </>
                  ) : stageOf(selectedAppointment) === 'waiting' ? (
                    <>
                      <button
                        onClick={() => handleApprove(selectedAppointment.id)}
                        className="w-full py-3 bg-green-500 text-white font-semibold rounded-2xl hover:bg-green-600 transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                        {<CheckCircle className="w-4 h-4" />}
                        Approve Appointment
                      </button>
                      <button
                        onClick={() => { setRejectModal(selectedAppointment.id); }}
                        className="w-full py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold rounded-2xl hover:bg-red-100 dark:hover:bg-red-900/30 transition text-sm border border-red-200 dark:border-red-800/20">
                        Reject Appointment
                      </button>
                    </>
                  ) : selectedAppointment.status === 'completed' ? (
                    <button
                      onClick={() => setSelectedAppointment(null)}
                      className="w-full py-3 bg-maroon-800 text-white font-semibold rounded-2xl hover:bg-maroon-900 transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                      {<CheckCircle2 className="w-4 h-4" />}
                      Completed
                    </button>
                  ) : selectedAppointment.status === 'approved' ? (
                    <button
                      onClick={() => setSelectedAppointment(null)}
                      className="w-full py-3 bg-green-100 text-green-700 font-semibold rounded-2xl hover:bg-green-200 transition flex items-center justify-center gap-1.5 text-sm disabled:opacity-50">
                      {<CheckCircle2 className="w-4 h-4" />}
                      Approved
                    </button>
                  ) : (
                    <button
                      onClick={() => setSelectedAppointment(null)}
                      className="w-full py-3 bg-gray-100 text-gray-600 font-semibold rounded-2xl hover:bg-gray-200 transition flex items-center justify-center gap-1.5 text-sm">
                      Declined
                    </button>
                  )}
                  <button onClick={() => setSelectedAppointment(null)}
                    className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setRejectModal(null)}>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6"
              onClick={e => e.stopPropagation()}>

              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">Reject Appointment</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">Please provide a reason for rejection.</p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="w-full mt-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl hover:bg-gray-200 dark:hover:bg-gray-600 transition text-sm">
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-2xl hover:bg-red-600 transition text-sm disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {<XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cancelModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setCancelModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-sm shadow-2xl p-6"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">Cancel Appointment</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">Please provide a cancellation reason.</p>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full mt-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500/20 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setCancelModal(null); setCancelReason(''); }} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl text-sm">Back</button>
                <button onClick={handleCancel} disabled={!cancelReason.trim()} className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-2xl text-sm disabled:opacity-50">Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default NurseAppointments;
