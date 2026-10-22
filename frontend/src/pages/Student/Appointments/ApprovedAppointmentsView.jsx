import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import HeroArt from '../../../components/HeroArt';
import RouteLoadingBar from '../../../components/RouteLoadingBar';
import { AlertCircle, ArrowRight, CalendarDays, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, HeartPulse, HelpCircle, LayoutGrid, List, Loader2, MapPin, RotateCcw, ShieldCheck, Stethoscope, UserRound, X } from 'lucide-react';
import { appointmentDate, appointmentTime, clinicDate, formatAppointmentDate, isClinicSunday } from '../../../utils/appointmentDate';
import { useTimeGuardBypass } from '../../../services/devTools';

const SERVICE_TITLES = { Consultation: 'General Consultation', 'Follow-up Checkup': 'Follow-up Check-up' };
const SERVICE_NOTES = { Consultation: 'Medical concerns & clinic care', 'Medical Certificate': 'For school requirements',
  'Medical Clearance': 'For clearance requests', 'Follow-up Checkup': 'Review an earlier clinic visit',
  Vaccination: 'Check vaccine availability' };
const serviceTitle = value => SERVICE_TITLES[value] || value || 'Appointment';
const personName = person => typeof person === 'object' && person
  ? person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') : '';
const providerName = appointment => personName(appointment.doctor) || personName(appointment.nurse) || personName(appointment.approved_by) || 'Not provided';
const roomName = appointment => (typeof appointment.room === 'string' ? appointment.room : appointment.room?.name) || appointment.location || 'Not provided';

export function AppointmentHero({ loading = false }) {
  return <section className="ap-hero" aria-labelledby="appointments-title">
    <HeroArt icon={CalendarDays} />
    <div className="ap-hero-copy">
      <p className="ap-eyebrow">Student clinic</p>
      <h1 id="appointments-title">Appointments</h1>
      <p className="ap-hero-description">Book and manage your clinic visits with ease.</p>
      <div className="ap-hero-benefits">
        <span><CalendarDays /><span>Schedule<br />an appointment</span></span>
        <span><ShieldCheck /><span>Get quality<br />health services</span></span>
        <span><HeartPulse /><span>A healthier you<br />starts here</span></span>
      </div>
    </div>
    {/* Route-loading bar — full-width fill/drain loop, hero only. */}
    {loading && <RouteLoadingBar className="ap-hero-loading-bar" />}
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

/* Appointment history layout: cards (default) or a compact list. The choice
   is remembered per browser. */
const HISTORY_VIEW_KEY = 'carelink.student.appointmentHistoryView';
const HISTORY_VIEWS = [
  { value: 'cards', label: 'View in rows', icon: LayoutGrid },
  { value: 'list', label: 'View in list', icon: List },
];
const readHistoryView = () => {
  try {
    return localStorage.getItem(HISTORY_VIEW_KEY) === 'list' ? 'list' : 'cards';
  } catch {
    return 'cards';
  }
};

function HistoryViewMenu({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const current = HISTORY_VIEWS.find(view => view.value === value) || HISTORY_VIEWS[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKeyDown = event => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return <div ref={rootRef} className="ap-view-menu">
    <button type="button" className={`ap-view-menu-button${open ? ' is-open' : ''}`} aria-haspopup="menu" aria-expanded={open}
      aria-label={`History layout: ${current.label}`} title="Change layout" onClick={() => setOpen(isOpen => !isOpen)}>
      <CurrentIcon /><ChevronDown className="ap-view-menu-chevron" />
    </button>
    {open && <div role="menu" aria-label="History layout" className="ap-view-menu-list">
      {HISTORY_VIEWS.map(({ value: option, label, icon: Icon }) => <button key={option} type="button" role="menuitemradio" aria-checked={option === value}
        className={option === value ? 'is-selected' : ''} onClick={() => { onChange(option); setOpen(false); }}>
        <Icon /><span>{label}</span>{option === value && <Check className="ap-view-menu-check" />}
      </button>)}
    </div>}
  </div>;
}

function StatusBadge({ status }) {
  const labels = { approved: 'Confirmed', pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected', expired: 'Expired', called: 'Called', skipped: 'Skipped', serving: 'Serving', no_show: 'No show' };
  return <span className={`ap-status ap-status-${status || 'pending'}`}><span />{labels[status] || status || 'Pending'}</span>;
}

/* Click selects an option; clicking the selected option again clears it. */
const toggleOption = (onChange, name, value, selected) =>
  onChange({ target: { name, value: selected ? '' : value } });

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
        const closed = !bypass && isClinicSunday(date);
        const unavailable = closed || (!bypass && date < today);
        return <button key={date} type="button" aria-label={formatAppointmentDate(date, { month: 'long', weekday: 'long' })}
          aria-pressed={value === date} disabled={disabled || unavailable} title={closed ? 'Clinic closed on Sundays' : undefined}
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
      {hasAppointment ? <StatusBadge status={appointment.status} /> : <span className="ap-status ap-status-expired"><span />Not booked</span>}
    </div>
    <div className="ap-upcoming-content">
      <div className={`ap-upcoming-summary${hasAppointment ? ' is-clickable' : ''}`} {...clickable}>
        <div className="ap-date-tile" aria-hidden={!date}><span>{date ? formatAppointmentDate(date, { month: 'short', year: undefined, day: undefined }).toUpperCase() : 'DATE'}</span><strong>{date ? date.slice(-2) : '—'}</strong><small>{date ? formatAppointmentDate(date, { weekday: 'short', day: undefined, month: undefined, year: undefined }) : '—'}</small></div>
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
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-800 dark:text-white" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="booking-review-title" className="text-lg font-bold text-maroon-800 dark:text-maroon-300">Booking Summary</h3>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Please review your appointment details.</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} aria-label="Close" className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-5 divide-y divide-gray-200 rounded-xl border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
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
          <button type="button" onClick={onClose} disabled={loading} className="flex-1 rounded-xl border border-gray-200 py-2.5 dark:border-gray-600 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:text-gray-200 dark:hover:bg-gray-700">
            Back
          </button>
          <button type="submit" form="appointment-booking-form" disabled={!canBook} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-maroon-800 py-2.5 text-sm font-semibold text-white transition-colors hover:text-gray-300 disabled:opacity-60">
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
  useEffect(() => setPage(1), [filter]);
  const [historyView, setHistoryView] = useState(readHistoryView);
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_VIEW_KEY, historyView);
    } catch {
      /* Remembering the layout is a per-browser convenience only. */
    }
  }, [historyView]);
  /* Appointment history — formerly filtered by the sidebar search box,
     which has been removed from the portal shell. */
  const history = filteredAppointments;
  const pages = Math.max(1, Math.ceil(history.length / 5));
  const currentPage = Math.min(page, pages);
  const rows = history.slice((currentPage - 1) * 5, currentPage * 5);
  const upcoming = appointments.filter(item => ['approved', 'pending'].includes(item.status) && appointmentDate(item.appointment_date) >= clinicDate())
    .sort((a, b) => (a.status === 'approved' ? 0 : 1) - (b.status === 'approved' ? 0 : 1)
      || (appointmentTime(a.appointment_date, a.time_slot)?.getTime() || 0) - (appointmentTime(b.appointment_date, b.time_slot)?.getTime() || 0))[0];
  // Developer Tools → Remove time Guard: slots that already passed stay bookable.
  const bypass = useTimeGuardBypass();
  const selectedSlot = availableSlots.find(slot => slot.time === form.time);
  const selectedInstant = appointmentTime(form.date, form.time);
  const canBook = Boolean(form.service && form.date && form.time && selectedSlot && !selectedSlot.isFull && selectedInstant && (bypass || (!selectedSlot.is_past && selectedInstant >= new Date())) && !slotsLoading && !loading);
  const progress = !form.date ? 1 : !form.time ? 2 : !form.service ? 3 : 4;
  // An appointment being edited may use a service that is no longer offered (e.g. "Other").
  const serviceOptions = form.service && !services.includes(form.service) ? [...services, form.service] : services;
  const [reviewOpen, setReviewOpen] = useState(false);
  /*
   * No review button: the summary popup opens by itself when the student's
   * own pick completes date + time + service. Changes made for the student
   * (e.g. loading an appointment to edit) don't open it.
   */
  const pickedRef = useRef(false);
  const onStepChange = event => {
    pickedRef.current = true;
    onChange(event);
  };
  useEffect(() => {
    if (canBook && pickedRef.current) setReviewOpen(true);
    pickedRef.current = false;
  }, [canBook, form.date, form.time, form.service]);
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
      <form id="appointment-booking-form" className="ap-booking-steps" onSubmit={onSubmit} noValidate>
        <ol className="ap-booking-progress" aria-label="Booking progress">
          <li aria-current={progress === 1 ? 'step' : undefined} className={`ap-booking-step${progress >= 1 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 1 ? <CheckCircle /> : 1}</span><h3 className="ap-step-label">Select Date</h3></header>
            <section className="ap-booking-column"><CalendarPicker value={form.date} onChange={onStepChange} disabled={loading} /></section>
          </li>
          <li aria-current={progress === 2 ? 'step' : undefined} className={`ap-booking-step${progress >= 2 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 2 ? <CheckCircle /> : 2}</span><h3 className="ap-step-label">Available Time Slots</h3></header>
            <section className="ap-booking-column"><div className="ap-step-body"><p className="ap-column-caption">{form.date ? formatAppointmentDate(form.date, { weekday: 'long' }) : 'Select an appointment date'}</p>
            {slotsLoading ? <div className="ap-slots-loading" role="status"><div className="ap-slots-loading-grid" aria-hidden="true">{timeSlots.map(time => <span key={time} />)}</div><span className="ap-slots-loading-label"><Loader2 className="animate-spin" />Loading availability…</span></div> : <div className="ap-time-grid">{timeSlots.map(time => {
              const slot = availableSlots.find(item => item.time === time);
              const instant = appointmentTime(form.date, time);
              // The server flags a slot that already occurred with is_past; fall back to client time if absent.
              const isPast = !bypass && Boolean(slot) && (slot.is_past ?? Boolean(instant && instant < new Date()));
              const isFull = Boolean(slot?.isFull) && !isPast;
              const unavailable = !form.date || !slot || isPast || isFull;
              const hint = !slot ? 'Availability has not been returned by the clinic' : isPast ? 'This time has already passed.' : `${slot.available} slots available${slot.booked ? ` (${slot.booked} booked)` : ''}`;
              // Default label while no availability data exists (no date picked yet / fresh reload).
              const countLabel = !slot ? (!bypass && isClinicSunday(clinicDate()) ? '0/0 no available slots' : '10/10 slots') : isPast ? 'Not available' : `${slot.available}/${slot.available + (slot.booked || 0)} slots`;
              return <button key={time} type="button" disabled={loading || unavailable} aria-pressed={form.time === time} title={hint} className={`${form.time === time ? 'is-selected' : ''} ${isPast ? 'is-past' : ''} ${isFull ? 'is-full' : ''}`} onClick={() => toggleOption(onStepChange, 'time', time, form.time === time)}>{time}<span className={isPast ? 'ap-slot-past-tag' : ''}>{countLabel}</span>{isFull && <span className="ap-slot-full-tag">Full</span>}</button>;
            })}</div>}
            {form.date && !slotsLoading && availableSlots.length === 0 && <p className="ap-availability-note">No availability returned. <button type="button" onClick={retrySlots}>Retry</button></p>}
            <p className="ap-column-footnote">Availability updates automatically.</p>
            </div></section>
          </li>
          <li aria-current={progress === 3 ? 'step' : undefined} className={`ap-booking-step${progress >= 3 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 3 ? <CheckCircle /> : 3}</span><h3 className="ap-step-label">Select Service</h3></header>
            <section className="ap-booking-column"><div className="ap-step-body"><div className="ap-service-list" role="radiogroup" aria-label="Appointment service">{serviceOptions.map((service, index) => <label key={service} className={form.service === service ? 'is-selected' : ''}>
              <input type="radio" name="service" value={service} checked={form.service === service} onChange={onStepChange} onClick={() => { if (form.service === service) toggleOption(onStepChange, 'service', service, true); }} disabled={loading} />
              {index === 0 ? <Stethoscope /> : <FileText />}{service === 'Other'
                ? <span className="ap-other-service"><strong>Other:</strong><input type="text" name="concern" value={form.concern || ''} onChange={onChange} onFocus={() => { if (form.service !== 'Other') onChange({ target: { name: 'service', value: 'Other' } }); }} onBlur={() => { if (canBook) setReviewOpen(true); }} maxLength={1000} aria-label="Specify other service" disabled={loading} /></span>
                : <span><strong>{serviceTitle(service)}</strong>{SERVICE_NOTES[service] && <small>{SERVICE_NOTES[service]}</small>}</span>}
            </label>)}</div></div></section>
          </li>
        </ol>
      </form>
      {reviewOpen && <BookingReviewModal form={form} editingId={editingId} loading={loading} canBook={canBook} onClose={() => setReviewOpen(false)} />}
    </section>
    <section className="ap-card ap-history">
      <div className="ap-section-heading"><Clock /><div><h2>Appointment History</h2><p>View your past and upcoming clinic visits.</p></div>
        <div className="ap-history-controls">
          <label><span className="sr-only">Filter appointment history</span><select value={filter} onChange={event => onFilter(event.target.value)}><option value="all">All Appointments</option><option value="pending">Pending Requests</option><option value="approved">Approved Appointments</option><option value="past">Past Appointments</option></select></label>
          <HistoryViewMenu value={historyView} onChange={setHistoryView} />
        </div>
      </div>
      {history.length === 0 ? <div className="ap-history-empty"><CalendarDays /><p>No appointments to display yet.</p></div> : <>
        {historyView === 'list' ? <div className="ap-history-table" role="table" aria-label="Appointment history">
          <div className="ap-history-table-head" role="row">
            <span role="columnheader">Date</span><span role="columnheader">Service</span><span role="columnheader">Staff · Room</span><span role="columnheader">Status</span><span role="columnheader" className="sr-only">Actions</span>
          </div>
          {rows.map(appointment => {
            const date = appointmentDate(appointment.appointment_date);
            return <div key={appointment.id} className="ap-history-row" role="row">
              <span role="cell" className="ap-history-row-date"><strong>{formatAppointmentDate(appointment.appointment_date)}</strong><small>{appointment.time_slot || 'Time not set'}</small></span>
              <span role="cell" className="ap-history-row-service"><strong>{serviceTitle(appointment.service)}</strong>{appointment.concern && <small>“{appointment.concern}”</small>}</span>
              <span role="cell" className="ap-history-row-meta">{providerName(appointment)}<small>{roomName(appointment)}</small></span>
              <span role="cell"><StatusBadge status={appointment.status} /></span>
              <span role="cell" className="ap-history-actions">
                <button type="button" onClick={() => onView(appointment)}><FileText />Details</button>
                {appointment.status === 'approved' && date === clinicDate() && <Link to="/student/qr"><FileText />QR</Link>}
                {appointment.status === 'pending' && <button type="button" onClick={() => onEdit(appointment)}><RotateCcw />Reschedule</button>}
              </span>
            </div>;
          })}
        </div> : <div className="ap-history-list">
          {rows.map(appointment => {
            const date = appointmentDate(appointment.appointment_date);
            return <article key={appointment.id} className="ap-history-item">
              <div className="ap-date-tile"><span>{date ? formatAppointmentDate(date, { month: 'short', year: undefined, day: undefined }).toUpperCase() : 'DATE'}</span><strong>{date ? date.slice(-2) : '—'}</strong><small>{date ? formatAppointmentDate(date, { weekday: 'short', day: undefined, month: undefined, year: undefined }) : '—'}</small></div>
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
        <div className="ap-history-pagination"><p>Showing {(currentPage - 1) * 5 + 1}–{Math.min(currentPage * 5, history.length)} of {history.length} appointments</p><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(current => current - 1)} aria-label="Previous history page"><ChevronLeft /></button><span aria-label={`History page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(current => current + 1)} aria-label="Next history page"><ChevronRight /></button></div></div>
      </>}
    </section>
    <p className="ap-policy-note"><HelpCircle />Check-in opens 15 minutes before your slot and closes strictly 30 minutes after. Follow your server-provided window; a queue number is assigned only after kiosk check-in and triage.</p>
  </>;
}
