import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { popRouteLoading, pushRouteLoading } from '../../../components/RouteLoadingBar';
import { SearchField } from '../../../components/StudentSearchFilter';
import { AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, HelpCircle, LayoutGrid, List, Loader2, MapPin, RotateCcw, Search, ShieldCheck, Stethoscope, UserRound, X } from 'lucide-react';
import { appointmentDate, appointmentTime, clinicDate, formatAppointmentDate, isClinicSunday } from '../../../utils/appointmentDate';
import { useTimeGuardBypass } from '../../../services/devTools';

const SERVICE_TITLES = { Consultation: 'General Consultation', 'Follow-up Checkup': 'Follow-up Check-up' };
// The short reason asked once a service is picked ("Other" keeps its own inline field).
const REASON_PROMPTS = {
  Consultation: ['Reason for consultation', 'e.g. Headache and fever since yesterday'],
  'Medical Certificate': ['Purpose', 'e.g. OJT requirement, PE class'],
  'Follow-up Checkup': ['Reason for follow-up', 'e.g. Recheck blood pressure'],
  Vaccination: ['Purpose', 'e.g. Flu vaccine, booster shot'],
};
const SERVICE_NOTES = { Consultation: 'Medical concerns & clinic care', 'Medical Certificate': 'For school requirements',
  'Medical Clearance': 'For clearance requests', 'Follow-up Checkup': 'Review an earlier clinic visit',
  Vaccination: 'Check vaccine availability' };
const serviceTitle = value => SERVICE_TITLES[value] || value || 'Appointment';
const personName = person => typeof person === 'object' && person
  ? person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') : '';
const providerName = appointment => personName(appointment.doctor) || personName(appointment.nurse) || personName(appointment.approved_by) || 'Not provided';
const roomName = appointment => (typeof appointment.room === 'string' ? appointment.room : appointment.room?.name) || appointment.location || 'Not provided';

export function AppointmentHero({ loading = false }) {
  // Drives the single top-edge loading bar while the page's first data loads.
  useEffect(() => {
    if (!loading) return undefined;
    pushRouteLoading();
    return () => popRouteLoading();
  }, [loading]);
  return <section className="ap-hero" aria-labelledby="appointments-title">
    <div className="ap-hero-copy">
      <h1 id="appointments-title">Appointments</h1>
      <p className="ap-hero-description">Book and manage your clinic visits with ease.</p>
    </div>
  </section>;
}

/* Booking feedback as a floating toast (bottom-right; above the bottom nav on
   mobile) so the page never shifts when a message appears or clears. Portaled
   to <body> because the page wrappers animate `transform`, which would break
   position:fixed. While it's open, the CSS lifts the chatbot launcher above it. */
function AppointmentToast({ message, type, onDismiss }) {
  if (!message) return null;
  const isSuccess = type === 'success';
  return createPortal(
    <div role={isSuccess ? 'status' : 'alert'} aria-live={isSuccess ? 'polite' : 'assertive'} className={`ap-toast ${isSuccess ? 'is-success' : 'is-error'}`}>
      {isSuccess ? <CheckCircle className="ap-toast-icon" /> : <AlertCircle className="ap-toast-icon" />}
      <p>{message}</p>
      {onDismiss && <button type="button" className="ap-toast-close" aria-label="Dismiss message" onClick={onDismiss}><X /></button>}
    </div>,
    document.body,
  );
}

/* Appointment history layout: a table (shown on every page load) or cards. */
const HISTORY_VIEWS = [
  { value: 'list', label: 'View in list', icon: List },
  { value: 'cards', label: 'View in rows', icon: LayoutGrid },
];

/* Cards / list switch: a two-icon track with a thumb that slides under the active layout. */
function HistoryViewMenu({ value, onChange }) {
  return <div role="radiogroup" aria-label="History layout" className={`ap-view-toggle${value === 'cards' ? ' is-cards' : ''}`}>
    <span className="ap-view-toggle-thumb" aria-hidden="true" />
    {HISTORY_VIEWS.map(({ value: option, label, icon: Icon }) => <button key={option} type="button" role="radio" aria-checked={option === value}
      aria-label={label} title={label} className={option === value ? 'is-selected' : ''} onClick={() => onChange(option)}>
      <Icon />
    </button>)}
  </div>;
}

function StatusBadge({ status }) {
  const labels = { approved: 'Confirmed', pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected', expired: 'Expired', called: 'Called', skipped: 'Skipped', on_hold: 'On hold', serving: 'Serving', no_show: 'No show' };
  return <span className={`ap-status ap-status-${status || 'pending'}`}><span />{labels[status] || status || 'Pending'}</span>;
}

/* Appointment History rows shown per page. */
const HISTORY_PAGE_SIZE = 3;
/* Appointment History panel defaults; Status lives in the parent's `filter`. */
const DEFAULT_HISTORY_FILTERS = { service: 'all' };
/* List-view column sorts. Each header click cycles descending → ascending →
   the default order (pending / approved soonest first, then newest first). */
const HISTORY_SORTS = {
  date: item => appointmentTime(item.appointment_date, item.time_slot)?.getTime() || 0,
  service: item => serviceTitle(item.service).toLowerCase(),
  staff: item => `${providerName(item)} ${roomName(item)}`.toLowerCase(),
  status: item => String(item.status || ''),
};
/* Stacked ▲/▼ on every sortable header: both hollow by default, the active
   direction filled (▼ descending, ▲ ascending). */
const SortCaret = ({ direction }) => <svg viewBox="0 0 10 14" aria-hidden="true">
  <path d="M1.5 5.5h7L5 1.5z" className={direction === 'asc' ? 'is-on' : ''} />
  <path d="M1.5 8.5h7L5 12.5z" className={direction === 'desc' ? 'is-on' : ''} />
</svg>;
const HISTORY_COLUMNS = [['date', 'Date'], ['service', 'Service'], ['staff', 'Staff · Room'], ['status', 'Status']];

/* Click selects an option; clicking the selected option again clears it. */
const toggleOption = (onChange, name, value, selected) =>
  onChange({ target: { name, value: selected ? '' : value } });

/* Booking progress markers (1 · 2 · 3): the number until the step's click
   completes it — then a short loading spin that settles into a plain check
   icon (no circle). Un-picking the step returns the number. */
function StepMarker({ number, completed }) {
  const [spinning, setSpinning] = useState(false);
  const wasCompleted = useRef(completed);
  useEffect(() => {
    const justCompleted = completed && !wasCompleted.current;
    wasCompleted.current = completed;
    if (!justCompleted) return undefined;
    setSpinning(true);
    const timer = setTimeout(() => setSpinning(false), 700);
    return () => clearTimeout(timer);
  }, [completed]);
  if (spinning) return <Loader2 className="animate-spin" />;
  if (completed) return <Check className="ap-step-check" />;
  return number;
}

function CalendarPicker({ value, onChange, disabled }) {
  const today = clinicDate();
  // Developer Tools → Remove time Guard: past dates and Sundays become selectable.
  const bypass = useTimeGuardBypass();
  const [month, setMonth] = useState(value?.slice(0, 7) || today.slice(0, 7));
  useEffect(() => { if (value) setMonth(value.slice(0, 7)); }, [value]);
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first);
  const shift = direction => {
    const date = new Date(Date.UTC(year, monthNumber - 1 + direction, 1));
    setMonth(date.toISOString().slice(0, 7));
  };
  return <div className="ap-calendar">
    <div className="ap-calendar-month"><strong>{monthLabel}</strong><div>
      <button type="button" aria-label="Previous month" disabled={disabled || (!bypass && month <= today.slice(0, 7))} onClick={() => shift(-1)}><ChevronLeft /></button>
      <button type="button" aria-label="Next month" disabled={disabled} onClick={() => shift(1)}><ChevronRight /></button>
    </div></div>
    <div className="ap-calendar-grid" role="group" aria-label="Choose appointment date">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="ap-calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
      {Array.from({ length: count }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        // UI-only: Sundays are clickable like any day (the booking stays blocked
        // later, at the review button) — only past dates stay off without the
        // Developer Tools time-guard bypass.
        const unavailable = !bypass && date < today;
        return <button key={date} type="button" aria-label={formatAppointmentDate(date, { month: 'long', weekday: 'long' })}
          aria-pressed={value === date} disabled={disabled || unavailable}
          className={`${value === date ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
          onClick={() => toggleOption(onChange, 'date', date, value === date)}>{i + 1}</button>;
      })}
    </div>
    <p className="ap-calendar-note">{bypass ? 'Time guard off (Developer Tools) · Asia/Manila' : 'Closed on Sundays · Asia/Manila'}</p>
  </div>;
}

/* ONE upcoming card for every state. The markup never changes — heading
   (title · status badge), date tile, details, place, check-in cell and the
   same two action slots; only the values swap between placeholders (no
   appointment yet) and the real booking. With a booking, the inner summary
   card opens its details; its two action buttons keep their own clicks. */
function UpcomingAppointment({ appointment, onView, onEdit }) {
  const hasAppointment = Boolean(appointment);
  const date = hasAppointment ? appointmentDate(appointment.appointment_date) : null;
  const queueStatus = appointment?.queue?.status;
  const canViewQr = appointment?.status === 'approved' && date === clinicDate();
  const qrHint = 'QR is available on the day of an approved appointment.';
  const openDetails = () => onView(appointment);
  const clickable = hasAppointment ? {
    role: 'button', tabIndex: 0, 'aria-label': 'View upcoming appointment details', title: 'View details',
    onClick: openDetails,
    onKeyDown: event => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      openDetails();
    },
  } : {};
  return <section className={`ap-card ap-upcoming${hasAppointment ? '' : ' is-empty'}`}>
    <div className="ap-section-heading ap-upcoming-heading"><CalendarDays /><h2>Your Upcoming Appointment</h2>
      {hasAppointment ? <StatusBadge status={appointment.status} /> : <span className="ap-status ap-status-none"><span />Not booked</span>}
    </div>
    <div className="ap-upcoming-content">
      <div className={`ap-upcoming-summary${hasAppointment ? ' is-clickable' : ''}`} {...clickable}>
        <div className="ap-date-tile" aria-hidden={!date}><span>{date ? formatAppointmentDate(date, { month: 'short', year: undefined, day: undefined }).toUpperCase() : 'DATE'}</span><strong>{date ? date.slice(-2) : <span className="ap-date-placeholder is-day" />}</strong><small>{date ? formatAppointmentDate(date, { weekday: 'short', day: undefined, month: undefined, year: undefined }) : <span className="ap-date-placeholder is-weekday" />}</small></div>
        <div className="ap-upcoming-details"><Stethoscope /><div><strong>{hasAppointment ? serviceTitle(appointment.service) : 'No appointment yet'}</strong><small>{hasAppointment ? appointment.concern || 'Scheduled clinic visit' : 'Choose a date and service below'}</small></div><UserRound /><div><span>{hasAppointment ? providerName(appointment) : 'Not assigned'}</span><small>Clinic staff</small></div></div>
        <div className="ap-upcoming-place"><div><MapPin /><span><strong>{hasAppointment ? roomName(appointment) : 'Campus clinic'}</strong><small>{hasAppointment ? 'Campus clinic' : 'Room assigned on approval'}</small></span></div><div><Clock /><span><strong>{appointment?.time_slot || 'No time selected'}</strong><small>Asia/Manila</small></span></div></div>
        {/* State cell: only the live queue status. Left empty otherwise — never
            a filler sentence — so the card reads the same either way. */}
        <div className="ap-upcoming-state">
          {queueStatus && <span className="ap-queue-label">Queue: {queueStatus.replaceAll('_', ' ')}</span>}
        </div>
        {/* Same two slots always: QR (primary) · Reschedule / Book a Visit. */}
        <div className="ap-upcoming-actions" onClick={event => event.stopPropagation()}>
          {canViewQr ? <Link to="/student/qr" className="ap-button"><FileText />View QR Code</Link> : <button type="button" className="ap-button" disabled title={qrHint}><FileText />View QR Code</button>}
          {hasAppointment
            ? <button type="button" className="ap-button ap-button-outline" disabled={appointment.status !== 'pending'} title={appointment.status === 'pending' ? 'Edit your pending request' : 'Contact the clinic to reschedule an approved visit'} onClick={() => onEdit(appointment)}><RotateCcw />Reschedule</button>
            : <a href="#appointment-booking" className="ap-button ap-button-outline"><CalendarDays />Book a Visit</a>}
        </div>
      </div>
    </div>
  </section>;
}

/* Booking summary popup: the last booking step, shown once date, time and
   service are chosen. Its Confirm button submits the booking form by id. */
function BookingReviewModal({ form, editingId, loading, canBook, onClose }) {
  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape' && !loading) onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [loading, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="booking-review-title" onClick={() => { if (!loading) onClose(); }}>
      <div className="w-full max-w-sm rounded-[10px] border border-gray-200 bg-white p-6 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-white" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="booking-review-title" className="text-lg font-bold text-gray-900 dark:text-white">Booking Summary</h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Please review your appointment details.</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Close" className="rounded-[10px] p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-5 divide-y divide-gray-200 rounded-[10px] border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {[
            [CalendarDays, 'Date', formatAppointmentDate(form.date)],
            [Clock, 'Time · Asia/Manila', form.time],
            [Stethoscope, 'Service', serviceTitle(form.service)],
            ...((form.concern || '').trim() ? [[FileText, 'Reason', form.concern.trim()]] : []),
          ].map(([Icon, label, value]) => (
            <div key={label} className="flex items-start gap-3 px-4 py-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-maroon-800 dark:text-maroon-300" />
              <div className="min-w-0">
                <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
                <dd className="break-words text-sm font-semibold">{value}</dd>
              </div>
            </div>
          ))}
        </dl>

        <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Your request is subject to clinic approval.
        </p>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} disabled={loading} className="flex-1 rounded-[10px] border border-gray-200 py-2.5 dark:border-gray-600 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">
            Back
          </button>
          <button type="submit" form="appointment-booking-form" disabled={!canBook} className="flex flex-1 items-center justify-center gap-2 rounded-[10px] bg-maroon-800 py-2.5 text-sm font-semibold text-white transition-colors hover:text-gray-300 disabled:opacity-60">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <>{editingId ? 'Update' : 'Confirm'}<ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ApprovedAppointmentsView({ appointments, filteredAppointments, form, onChange, onSubmit, onView, onEdit,
  filter, onFilter, editingId, onCancelEdit, services, timeSlots, availableSlots, slotsLoading, loading, message, messageType, onDismissMessage, retrySlots }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [historyFilters, setHistoryFilters] = useState(DEFAULT_HISTORY_FILTERS);
  const [historySort, setHistorySort] = useState(null);
  useEffect(() => setPage(1), [filter, search, historyFilters, historySort]);
  const cycleSort = key => setHistorySort(current => current?.key !== key ? { key, dir: 'desc' } : current.dir === 'desc' ? { key, dir: 'asc' } : null);
  const resetHistory = () => { setSearch(''); onFilter('all'); setHistoryFilters(DEFAULT_HISTORY_FILTERS); setHistorySort(null); };
  const [historyView, setHistoryView] = useState('list');
  /* Appointment history — formerly filtered by the sidebar search box,
     which has been removed from the portal shell. */
  const term = search.trim().toLowerCase();
  const historyServices = [...new Set(appointments.map(item => item.service).filter(Boolean))].sort((a, b) => serviceTitle(a).localeCompare(serviceTitle(b)));
  const filtersActive = filter !== 'all' || Object.keys(DEFAULT_HISTORY_FILTERS).some(key => historyFilters[key] !== DEFAULT_HISTORY_FILTERS[key]);
  const canReset = Boolean(term) || filtersActive || Boolean(historySort);
  const history = filteredAppointments
    .filter(item => historyFilters.service === 'all' || item.service === historyFilters.service)
    .filter(item => !term || [serviceTitle(item.service), item.service, item.concern, item.status, formatAppointmentDate(item.appointment_date), item.time_slot]
      .some(value => String(value || '').toLowerCase().includes(term)));
  if (historySort) {
    const value = HISTORY_SORTS[historySort.key];
    const direction = historySort.dir === 'asc' ? 1 : -1;
    history.sort((x, y) => {
      const left = value(x), right = value(y);
      return direction * (typeof left === 'number' ? left - right : left.localeCompare(right));
    });
  } else {
    /* Default order: active requests (pending / approved) stay on top in the
       parent's soonest-first order; every finished record (completed,
       cancelled, rejected, expired) follows newest first, so a recent
       rejection is not buried on the last page behind older completions. */
    const active = item => ['pending', 'approved'].includes(item.status);
    history.sort((x, y) => (active(x) === active(y)
      ? (active(x) ? 0 : HISTORY_SORTS.date(y) - HISTORY_SORTS.date(x))
      : active(x) ? -1 : 1));
  }
  const pages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const rows = history.slice((currentPage - 1) * HISTORY_PAGE_SIZE, currentPage * HISTORY_PAGE_SIZE);
  // Clicking anywhere on a history row opens its details; its own buttons and links keep their action.
  const openFromRow = (event, appointment) => {
    if (event.target.closest('a, button')) return;
    onView(appointment);
  };
  const upcoming = appointments.filter(item => ['approved', 'pending'].includes(item.status) && appointmentDate(item.appointment_date) >= clinicDate())
    .sort((a, b) => (a.status === 'approved' ? 0 : 1) - (b.status === 'approved' ? 0 : 1)
      || (appointmentTime(a.appointment_date, a.time_slot)?.getTime() || 0) - (appointmentTime(b.appointment_date, b.time_slot)?.getTime() || 0))[0];
  // Developer Tools → Remove time Guard: slots that already passed stay bookable.
  const bypass = useTimeGuardBypass();
  const selectedSlot = availableSlots.find(slot => slot.time === form.time);
  const selectedInstant = appointmentTime(form.date, form.time);
  // "Other" needs the student to say what the visit is for.
  const reasonMissing = Boolean(form.service) && !(form.concern || '').trim();
  // The review button is always visible: until the date, time, service and
  // reason are all filled it reads "Fill in the details above to continue".
  const detailsIncomplete = !form.date || !form.time || !form.service || reasonMissing;
  const canBook = Boolean(form.service && !reasonMissing && form.date && form.time && selectedSlot && !selectedSlot.isFull && selectedInstant && (bypass || (!selectedSlot.is_past && selectedInstant >= new Date())) && !slotsLoading && !loading);
  const progress = !form.date ? 1 : !form.time ? 2 : !form.service ? 3 : 4;
  // UI-only: a closed Sunday flows like any other day (slots selectable, last
  // button visible) but `selectedSlot` never exists, so booking stays blocked.
  const closedDate = isClinicSunday(form.date);
  // An appointment being edited may use a service that is no longer offered (e.g. "Other").
  const serviceOptions = form.service && !services.includes(form.service) ? [...services, form.service] : services;
  const [reviewOpen, setReviewOpen] = useState(false);
  /*
   * The summary popup opens only when the student asks for it: the "Review and
   * confirm booking" button under the services, or Enter in the reason field.
   * Picking a date, time or another service never opens it, and leaving the
   * reason field doesn't either: clicking a different service is a change of
   * mind, not a confirmation. Switching service clears the typed reason.
   */
  const onStepChange = event => {
    if (event.target.name === 'service' && event.target.value !== form.service) onChange({ target: { name: 'concern', value: '' } });
    onChange(event);
  };
  const reasonKey = event => { if (event.key === 'Enter') { event.preventDefault(); if (canBook) setReviewOpen(true); } };
  // Close the summary popup once its submission finishes.
  const wasLoadingRef = useRef(loading);
  useEffect(() => {
    if (wasLoadingRef.current && !loading) setReviewOpen(false);
    wasLoadingRef.current = loading;
  }, [loading]);
  return <>
    <AppointmentHero />
    <AppointmentToast message={message} type={messageType} onDismiss={onDismissMessage} />
    <UpcomingAppointment appointment={upcoming} onView={onView} onEdit={onEdit} />
    <section id="appointment-booking" className="ap-card ap-booking">
      <div className="ap-section-heading"><CalendarDays /><div><h2>{editingId ? 'Edit Appointment' : 'Book a New Appointment'}</h2><p>{editingId ? 'Update your pending appointment request.' : 'Choose a date, time, and service that works for you.'}</p></div>{editingId && <button type="button" className="ap-text-button" onClick={onCancelEdit}>Cancel editing</button>}</div>
      {/* The three booking steps render as a timeline: horizontal (three
          columns) on desktop/laptop, a vertical numbered spine on tablet and
          mobile — content left-aligned, never centered. The summary opens as
          a popup once all three are picked. */}
      <form id="appointment-booking-form" className="ap-booking-steps" onSubmit={onSubmit} autoComplete="off" noValidate>
        <ol className="ap-booking-progress" aria-label="Booking progress">
          <li aria-current={progress === 1 ? 'step' : undefined} className={`ap-booking-step${progress >= 1 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker"><StepMarker number={1} completed={progress > 1} /></span><h3 className="ap-step-label">Select Date</h3></header>
            <section className="ap-booking-column"><CalendarPicker value={form.date} onChange={onStepChange} disabled={loading} /></section>
          </li>
          <li aria-current={progress === 2 ? 'step' : undefined} className={`ap-booking-step${progress >= 2 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker"><StepMarker number={2} completed={progress > 2} /></span><h3 className="ap-step-label">Available Time Slots</h3></header>
            <section className="ap-booking-column"><div className="ap-step-body"><p className="ap-column-caption">{form.date ? formatAppointmentDate(form.date, { weekday: 'long' }) : 'Select an appointment date'}</p>
            {slotsLoading ? <div className="ap-slots-loading" role="status"><div className="ap-slots-loading-grid" aria-hidden="true">{timeSlots.map(time => <span key={time} />)}</div><span className="ap-slots-loading-label"><Loader2 className="animate-spin" />Loading availability…</span></div> : <div className="ap-time-grid">{timeSlots.map(time => {
              const slot = availableSlots.find(item => item.time === time);
              const instant = appointmentTime(form.date, time);
              // The server flags a slot that already occurred with is_past; fall back to client time if absent.
              const isPast = !bypass && Boolean(slot) && (slot.is_past ?? Boolean(instant && instant < new Date()));
              const isFull = Boolean(slot?.isFull) && !isPast;
              const unavailable = !form.date || (!slot && !closedDate) || isPast || isFull;
              const hint = !slot ? 'Availability has not been returned by the clinic' : isPast ? 'This time has already passed.' : `${slot.available} slots available${slot.booked ? ` (${slot.booked} booked)` : ''}`;
              // Default label while no availability data exists (no date picked yet / fresh reload).
              const countLabel = !slot ? '10/10 slots' : isPast ? 'Not available' : `${slot.available}/${slot.available + (slot.booked || 0)} slots`;
              return <button key={time} type="button" disabled={loading || unavailable} aria-pressed={form.time === time} title={hint} className={`${form.time === time ? 'is-selected' : ''} ${isPast ? 'is-past' : ''} ${isFull ? 'is-full' : ''}`} onClick={() => toggleOption(onStepChange, 'time', time, form.time === time)}>{time}<span className={isPast ? 'ap-slot-past-tag' : ''}>{countLabel}</span>{isFull && <span className="ap-slot-full-tag">Full</span>}</button>;
            })}</div>}
            {form.date && !slotsLoading && !closedDate && availableSlots.length === 0 && <p className="ap-availability-note">No availability returned. <button type="button" onClick={retrySlots}>Retry</button></p>}
            <p className="ap-column-footnote">Availability updates automatically.</p>
            </div></section>
          </li>
          <li aria-current={progress === 3 ? 'step' : undefined} className={`ap-booking-step${progress >= 3 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker"><StepMarker number={3} completed={progress > 3} /></span><h3 className="ap-step-label">Select Service</h3></header>
            <section className="ap-booking-column"><div className="ap-step-body"><div className="ap-service-list" role="radiogroup" aria-label="Appointment service">{serviceOptions.map((service, index) => <label key={service} className={form.service === service ? 'is-selected' : ''}>
              <input type="radio" name="service" value={service} checked={form.service === service} onChange={onStepChange} onClick={() => { if (form.service === service) toggleOption(onStepChange, 'service', service, true); }} disabled={loading} />
              {index === 0 ? <Stethoscope /> : <FileText />}{service === 'Other'
                ? <span className="ap-other-service"><strong>Other:</strong><input type="text" name="concern" value={form.service === 'Other' ? form.concern || '' : ''} onChange={onChange} onFocus={() => { if (form.service !== 'Other') onStepChange({ target: { name: 'service', value: 'Other' } }); }} onKeyDown={reasonKey} maxLength={150} placeholder="Please specify" required={form.service === 'Other'} aria-label="Please specify the service" disabled={loading} /></span>
                : <span><strong>{serviceTitle(service)}</strong>{SERVICE_NOTES[service] && <small>{SERVICE_NOTES[service]}</small>}
                  {form.service === service && REASON_PROMPTS[service] && <span className="ap-service-reason">
                    <span>{REASON_PROMPTS[service][0]} <em aria-hidden="true">*</em></span>
                    <input type="text" name="concern" value={form.concern || ''} onChange={onChange} onKeyDown={reasonKey}
                      maxLength={150} placeholder={REASON_PROMPTS[service][1]} required aria-label={REASON_PROMPTS[service][0]} disabled={loading} autoFocus />
                  </span>}</span>}
            </label>)}</div>
            {/* Always visible: it names the next thing to finish and only turns
                into the clickable "Review and confirm booking" once every detail
                is valid; it stays disabled on closed Sundays. */}
            <button type="button" className="ap-button ap-review-booking" disabled={!canBook} onClick={() => setReviewOpen(true)}>
              <CheckCircle />{detailsIncomplete ? 'Fill in the details above to continue' : closedDate ? 'Clinic is closed on Sundays' : 'Review and confirm booking'}
            </button>
            </div></section>
          </li>
        </ol>
      </form>
      {reviewOpen && <BookingReviewModal form={form} editingId={editingId} loading={loading} canBook={canBook} onClose={() => setReviewOpen(false)} />}
    </section>
    <section className="ap-card ap-history-search" aria-labelledby="ap-history-search-title">
      <div className="ap-section-heading"><Search /><div><h2 id="ap-history-search-title">Search and Filter</h2><p>Find an appointment by keyword, or narrow the list by status, service and order.</p></div></div>
      <div className="ap-history-filters">
        <div className="ap-history-filter-search">
          <span>Search</span>
          <SearchField value={search} onChange={setSearch} placeholder="Search appointments..." label="Search appointment history" className="[&_input]:bg-[var(--sp-surface)]" />
        </div>
        {[
          ['status', 'Status', filter, value => onFilter(value), [['all', 'All appointments'], ['pending', 'Pending requests'], ['approved', 'Approved appointments'], ['past', 'Past appointments'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['rejected', 'Rejected']]],
          ['service', 'Service', historyFilters.service, value => setHistoryFilters(current => ({ ...current, service: value })), [['all', 'All services'], ...historyServices.map(service => [service, serviceTitle(service)])]],
        ].map(([key, label, value, change, options]) => <label key={key}>
          <span>{label}</span>
          <span className="ap-history-select">
            <select value={value} onChange={event => change(event.target.value)}>
              {options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}
            </select>
            <ChevronDown aria-hidden="true" />
          </span>
        </label>)}
        <div className="ap-history-filter-reset">
          <span aria-hidden="true">&nbsp;</span>
          <button type="button" onClick={resetHistory} disabled={!canReset}><RotateCcw />Reset filters</button>
        </div>
      </div>
    </section>
    <section className="ap-card ap-history">
      <div className="ap-section-heading"><Clock /><div><h2>Appointment History</h2><p>View your past and upcoming clinic visits.</p></div>
        <div className="ap-history-controls">
          <HistoryViewMenu value={historyView} onChange={setHistoryView} />
        </div>
      </div>
      {history.length === 0 ? <div className="ap-history-empty"><CalendarDays /><p>{term || filtersActive ? 'No appointments match your search or filters.' : 'No appointments to display yet.'}</p></div> : <>
        {historyView === 'list' ? <div className="ap-history-table" role="table" aria-label="Appointment history">
          <div className="ap-history-table-head" role="row">
            {HISTORY_COLUMNS.map(([key, label]) => {
              const active = historySort?.key === key ? historySort.dir : null;
              return <span key={key} role="columnheader" aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : 'none'}>
                <button type="button" className={`ap-sort-button${active ? ' is-active' : ''}`} onClick={() => cycleSort(key)}>{label}<SortCaret direction={active} /></button>
              </span>;
            })}
            <span role="columnheader">Actions</span>
          </div>
          {rows.map(appointment => {
            const date = appointmentDate(appointment.appointment_date);
            return <div key={appointment.id} className="ap-history-row" role="row" onClick={event => openFromRow(event, appointment)}>
              <span role="cell" className="ap-history-row-date"><strong>{formatAppointmentDate(appointment.appointment_date)}</strong><small>{appointment.time_slot || 'Time not set'}</small></span>
              <span role="cell" className="ap-history-row-service"><strong>{serviceTitle(appointment.service)}</strong>{appointment.concern && <small>“{appointment.concern}”</small>}</span>
              <span role="cell" className="ap-history-row-meta">{providerName(appointment)}<small>{roomName(appointment)}</small></span>
              <span role="cell"><StatusBadge status={appointment.status} /></span>
              <span role="cell" className="ap-history-actions">
                <button type="button" onClick={() => onView(appointment)}><FileText />View Details</button>
                {appointment.status === 'approved' && date === clinicDate() && <Link to="/student/qr"><FileText />View QR</Link>}
                {appointment.status === 'pending' && <button type="button" onClick={() => onEdit(appointment)}><RotateCcw />Reschedule</button>}
              </span>
            </div>;
          })}
        </div> : <div className="ap-history-list">
          {rows.map(appointment => {
            const date = appointmentDate(appointment.appointment_date);
            return <article key={appointment.id} className="ap-history-item" onClick={event => openFromRow(event, appointment)}>
              <div className="ap-date-tile"><span>{date ? formatAppointmentDate(date, { month: 'short', year: undefined, day: undefined }).toUpperCase() : 'DATE'}</span><strong>{date ? date.slice(-2) : <span className="ap-date-placeholder is-day" />}</strong><small>{date ? formatAppointmentDate(date, { weekday: 'short', day: undefined, month: undefined, year: undefined }) : <span className="ap-date-placeholder is-weekday" />}</small></div>
              <div className="ap-history-info">
                <strong>{serviceTitle(appointment.service)}</strong>
                <p>{formatAppointmentDate(appointment.appointment_date)} · {appointment.time_slot || 'Time not set'}</p>
                <p className="ap-history-meta">{providerName(appointment)} · {roomName(appointment)}</p>
                {appointment.concern && <p className="ap-history-concern">“{appointment.concern}”</p>}
              </div>
              <div className="ap-history-side">
                <StatusBadge status={appointment.status} />
                {appointment.queue?.status && <small className="ap-queue-label">Queue: {appointment.queue.status.replaceAll('_', ' ')}</small>}
                <div className="ap-history-actions">
                  <button type="button" onClick={() => onView(appointment)}><FileText />View Details</button>
                  {appointment.status === 'approved' && date === clinicDate() && <Link to="/student/qr"><FileText />View QR Code</Link>}
                  {appointment.status === 'pending' && <button type="button" onClick={() => onEdit(appointment)}><RotateCcw />Reschedule</button>}
                </div>
              </div>
            </article>;
          })}
        </div>}
        <div className="ap-history-pagination"><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(current => current - 1)} aria-label="Previous history page"><ChevronLeft /></button><span aria-label={`History page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(current => current + 1)} aria-label="Next history page"><ChevronRight /></button><small aria-live="polite">{Math.min(currentPage * HISTORY_PAGE_SIZE, history.length)} of {history.length}</small></div></div>
      </>}
    </section>
    <p className="ap-policy-note"><HelpCircle />Check-in opens 15 minutes before your slot and closes strictly 30 minutes after. Follow your server-provided window; a queue number is assigned only after kiosk check-in and triage.</p>
  </>;
}
