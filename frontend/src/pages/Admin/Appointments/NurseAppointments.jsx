import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, CheckCircle, XCircle, Search, User, X, FileText, Stethoscope, ListChecks, Inbox, List, Table2 } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import { formatAppointmentDate } from '../../../utils/appointmentDate';
import NursePageTitle from '../../../components/NursePageTitle';
import { Pagination } from '../Students/StudentDirectory';
import { NurseToast } from '../../../components/NurseFeedback';

// Same services students can book on their Appointments page.
const SERVICES = ['Consultation', 'Medical Certificate', 'Medical Clearance', 'Follow-up Checkup', 'Vaccination', 'Other'];
const fieldClass = 'w-full rounded-[10px] border border-gray-200 bg-white py-2.5 text-sm focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

const PER_PAGE = 5;

// Default action button: border, light shadow, hover, a darker shade while pressed, and a focus ring.
const BTN = 'inline-flex cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] border text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 disabled:cursor-not-allowed disabled:opacity-50';
const BTN_PRIMARY = 'border-maroon-800 bg-maroon-800 text-white hover:border-maroon-900 hover:bg-maroon-900 active:bg-maroon-950 focus-visible:ring-maroon-500 dark:border-gray-500 dark:bg-gray-700 dark:hover:bg-gray-600 dark:active:bg-gray-500';
const BTN_DANGER = 'border-red-300 bg-white text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:ring-red-400 dark:border-red-700 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20 dark:active:bg-red-900/40';
const BTN_DANGER_SOLID = 'border-red-600 bg-red-600 text-white hover:border-red-700 hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-400';
const BTN_SECONDARY = 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100 focus-visible:ring-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:active:bg-gray-600';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'completed', label: 'Completed' },
  { key: 'rejected', label: 'Declined' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'expired', label: 'Expired' },
];

// This page shows the state of the booking request, plus Completed once the visit's
// consultation is saved. Where a visit is in the queue is on the Consultation page.
const stageOf = app => {
  // Approved, but the student never made it to the clinic: the slot is over, so it reads as expired.
  if (app.status === 'approved' && app.no_show) return 'expired';
  return app.status;
};

// Status badge text per stage.
const STAGE_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Declined',
  cancelled: 'Cancelled',
  expired: 'Expired',
};
const badgeLabel = stage => STAGE_LABELS[stage] || stage;

const NurseAppointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [page, setPage] = useState(1);
  // Table view every time the page opens; List is a switch for this visit only.
  const [view, setView] = useState('table');
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
      const res = await api.get('/nurse/appointments', {
        signal: signal instanceof AbortSignal ? signal : undefined,
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
      await api.patch(`/nurse/appointments/${id}/approve`, {});
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
      await api.patch(`/nurse/appointments/${rejectModal}/reject`,
        { reason: rejectReason });
      if (loadingId !== actionLoadingRef.current) return;
      showMessage('Appointment declined.', 'success');
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
      await api.patch(`/nurse/appointments/${cancelModal}/cancel`, { reason: cancelReason });
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

  const showMessage = (msg, type) => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatDate = (value) => formatAppointmentDate(value, { weekday: 'short' });

  const changeView = next => setView(next);

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
    completed: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30',
    cancelled: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/30',
    expired: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:border-gray-700',
  };

  const statusConfig = {
    pending: { icon: Clock },
    approved: { icon: CheckCircle },
    completed: { icon: CheckCircle },
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
      <span title={label} aria-label={label} className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border p-1.5 text-xs font-semibold sm:px-2.5 sm:py-1 ${statusColors[stage] || statusColors.expired}`}>
        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
      </span>
    );
  };

  // Row buttons: a normal button size on desktop, icon only on phones.
  const primaryBtn = `${BTN} ${BTN_PRIMARY} p-2 sm:px-3.5 sm:py-2`;
  const declineBtn = `${BTN} ${BTN_DANGER} p-2 sm:px-3.5 sm:py-2`;
  const actionBtn = (className, Icon, label, onClick, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className} title={label} aria-label={label}>
      <Icon className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
    </button>
  );

  /*
   * Shared by the list cards and the table rows. Only a pending request has buttons (Approve / Decline);
   * every other row just shows its status. The row itself opens the details.
   */
  const rowActions = app => {
    if (app.status !== 'pending') return null;
    return (
      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
        {actionBtn(primaryBtn, CheckCircle, 'Approve', () => handleApprove(app.id))}
        {actionBtn(declineBtn, X, 'Decline', () => setRejectModal(app.id))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-6">
      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      <NursePageTitle path="/nurse/appointments" />
      {/* Search and filters: one row, search first, then the service, the date and Clear filters. */}
      <section aria-label="Search and filters" className="rounded-[10px] border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden="true" />
            <input
              aria-label="Search appointments"
              className={`${fieldClass} pl-10 pr-4`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search student name or student number..."
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:flex lg:shrink-0">
            <select aria-label="Filter by service" className={`${fieldClass} px-3 lg:w-52`} value={service} onChange={(e) => { setService(e.target.value); setPage(1); }}>
              <option value="">All services</option>
              {SERVICES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <input type="date" aria-label="Filter by appointment date" className={`${fieldClass} px-3 lg:w-44`} value={date} onChange={(e) => { setDate(e.target.value); setPage(1); }} />
            <button type="button" onClick={() => { setSearch(''); setService(''); setDate(''); setPage(1); }} disabled={!search && !service && !date}
              className="cursor-pointer whitespace-nowrap rounded-[10px] border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {/* Status tabs: their own card under the search, filtering the requests below. */}
      <section aria-label="Appointment status" className="rounded-[10px] border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <div role="group" aria-label="Filter appointments by status" className="flex gap-1 overflow-x-auto">
          {STATUS_TABS.map(f => (
            <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setPage(1); }}
              className={`flex-1 shrink-0 whitespace-nowrap rounded-[10px] px-3 py-2.5 text-sm font-semibold capitalize transition-colors ${
                filter === f.key
                  ? 'bg-maroon-800 text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
              }`}>
              {f.label}
              <span className="ml-1.5 text-xs opacity-75">({counts[f.key] ?? 0})</span>
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
        description="Newest bookings first. Open one to review it, or approve and decline pending requests right here."
        actions={
          <div role="group" aria-label="Choose how to view appointments" className="flex rounded-[10px] bg-gray-100 p-1 dark:bg-gray-700/60">
            {[{ key: 'table', label: 'Table', icon: Table2 }, { key: 'list', label: 'List', icon: List }].map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" aria-pressed={view === key} onClick={() => changeView(key)}
                className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-colors ${
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
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50"><Inbox className="h-8 w-8 text-gray-300 dark:text-gray-500" /></span>
            <p className="text-gray-500 dark:text-gray-400 font-medium">No appointments found</p>
            <p className="text-sm text-gray-400 dark:text-gray-400 mt-1">
              {filter !== 'all' ? `No ${badgeLabel(filter).toLowerCase()} appointments.` : 'All clear!'}
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
                    className="cursor-pointer rounded-[10px] border border-gray-100 bg-white p-4 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700/40">

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 dark:bg-maroon-900/20">
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
              className="bg-white dark:bg-gray-800 rounded-[10px] w-full max-w-md shadow-2xl overflow-hidden"
              style={{ maxHeight: '90vh' }}
              onClick={e => e.stopPropagation()}>

              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[stageOf(selectedAppointment)]}`}>
                  {(() => { const Icon = (statusConfig[stageOf(selectedAppointment)] || statusConfig.pending).icon; return <Icon className="w-3.5 h-3.5" />; })()}
                  {badgeLabel(stageOf(selectedAppointment))}
                </span>
                <button onClick={() => setSelectedAppointment(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-[10px]">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="overflow-y-auto px-5 pb-5" style={{ WebkitOverflowScrolling: 'touch' }}>

                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-maroon-50 dark:bg-maroon-900/20 rounded-[10px] flex items-center justify-center flex-shrink-0">
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
                  <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/20 rounded-[10px] p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <Clock className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-400">⏳ Pending Review</p>
                        <p className="text-xs text-yellow-600 dark:text-yellow-500 mt-1">This appointment needs you to approve or decline it.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-[10px] p-4 space-y-3 mb-4">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wider">Service</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppointment.service}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wider">Date</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{formatDate(selectedAppointment.appointment_date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wider">Time</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedAppointment.time_slot}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-400 uppercase tracking-wider">Concern</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">{selectedAppointment.concern || 'No concern specified'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {selectedAppointment.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApprove(selectedAppointment.id)}
                        className={`${BTN} ${BTN_PRIMARY} w-full py-2.5`}>
                        <CheckCircle className="w-4 h-4" aria-hidden="true" />
                        Approve Appointment
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectModal(selectedAppointment.id); }}
                        className={`${BTN} ${BTN_DANGER} w-full py-2.5`}>
                        <X className="w-4 h-4" aria-hidden="true" />
                        Decline Appointment
                      </button>
                    </>
                  ) : null}
                  <button type="button" onClick={() => setSelectedAppointment(null)}
                    className={`${BTN} ${BTN_SECONDARY} w-full py-2.5`}>
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
              className="bg-white dark:bg-gray-800 rounded-[10px] w-full max-w-sm shadow-2xl p-6"
              onClick={e => e.stopPropagation()}>

              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-[10px] flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">Decline Appointment</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">Please provide a reason for rejection.</p>

              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="w-full mt-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />

              <div className="flex gap-3 mt-4">
                <button type="button" onClick={() => { setRejectModal(null); setRejectReason(''); }}
                  className={`${BTN} ${BTN_SECONDARY} flex-1 py-2.5`}>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={!rejectReason.trim()}
                  className={`${BTN} ${BTN_DANGER_SOLID} flex-1 py-2.5`}>
                  <XCircle className="w-4 h-4" aria-hidden="true" />
                  Decline
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
              className="bg-white dark:bg-gray-800 rounded-[10px] w-full max-w-sm shadow-2xl p-6"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-900 dark:text-white text-center">Cancel Appointment</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">Please provide a cancellation reason.</p>
              <textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={3}
                className="w-full mt-4 border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-[10px] px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-500/20 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setCancelModal(null); setCancelReason(''); }} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-[10px] text-sm">Back</button>
                <button onClick={handleCancel} disabled={!cancelReason.trim()} className="flex-1 py-3 bg-gray-700 text-white font-semibold rounded-[10px] text-sm disabled:opacity-50">Confirm</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default NurseAppointments;
