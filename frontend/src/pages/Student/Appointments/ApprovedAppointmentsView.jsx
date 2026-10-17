import { useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CheckCircle, ChevronLeft, ChevronRight, Clock, FileText, HeartPulse, HelpCircle, Loader2, MapPin, RotateCcw, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { StudentPortalSearchContext } from '../../../components/StudentPortalSearchContext';
import { appointmentDate, appointmentTime, clinicDate, formatAppointmentDate, isClinicSunday } from '../../../utils/appointmentDate';

const SERVICE_TITLES = { Consultation: 'General Consultation', 'Follow-up Checkup': 'Follow-up Check-up' };
const SERVICE_NOTES = { Consultation: 'Medical concerns & clinic care', 'Medical Certificate': 'For school requirements',
  'Medical Clearance': 'For clearance requests', 'Follow-up Checkup': 'Review an earlier clinic visit',
  Vaccination: 'Check vaccine availability', Other: 'Other clinic concerns' };
const serviceTitle = value => SERVICE_TITLES[value] || value || 'Appointment';
const personName = person => typeof person === 'object' && person
  ? person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') : '';
const providerName = appointment => personName(appointment.doctor) || personName(appointment.nurse) || personName(appointment.approved_by) || 'Not provided';
const roomName = appointment => (typeof appointment.room === 'string' ? appointment.room : appointment.room?.name) || appointment.location || 'Not provided';
const clinicTime = value => value && !Number.isNaN(new Date(value).getTime())
  ? new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(value)) : null;

function AppointmentHero() {
  return <section className="ap-hero" aria-labelledby="appointments-title">
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
  </section>;
}

function StatusBadge({ status }) {
  const labels = { approved: 'Confirmed', pending: 'Pending', completed: 'Completed', cancelled: 'Cancelled', rejected: 'Rejected', expired: 'Expired', called: 'Called', skipped: 'Skipped', serving: 'Serving', no_show: 'No show' };
  return <span className={`ap-status ap-status-${status || 'pending'}`}><span />{labels[status] || status || 'Pending'}</span>;
}

function CalendarPicker({ value, onChange, disabled }) {
  const today = clinicDate();
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
      <button type="button" aria-label="Previous month" disabled={disabled || month <= today.slice(0, 7)} onClick={() => shift(-1)}><ChevronLeft /></button>
      <button type="button" aria-label="Next month" disabled={disabled} onClick={() => shift(1)}><ChevronRight /></button>
    </div></div>
    <div className="ap-calendar-grid" role="group" aria-label="Choose appointment date">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span className="ap-calendar-weekday" key={day}>{day}</span>)}
      {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
      {Array.from({ length: count }, (_, i) => {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        const unavailable = date < today || isClinicSunday(date);
        return <button key={date} type="button" aria-label={formatAppointmentDate(date, { month: 'long', weekday: 'long' })}
          aria-pressed={value === date} disabled={disabled || unavailable} title={isClinicSunday(date) ? 'Clinic closed on Sundays' : undefined}
          className={`${value === date ? 'is-selected' : ''} ${date === today ? 'is-today' : ''}`}
          onClick={() => onChange({ target: { name: 'date', value: date } })}>{i + 1}</button>;
      })}
    </div>
    <p className="ap-calendar-note">Closed on Sundays · Asia/Manila</p>
  </div>;
}

function UpcomingAppointment({ appointment, onView, onEdit }) {
  if (!appointment) return <section className="ap-card ap-upcoming-empty"><CalendarDays /><div><h2>No upcoming appointment</h2><p>Choose a date and service below to request a clinic visit.</p></div><a href="#appointment-booking" className="ap-button">Book a visit <ArrowRight /></a></section>;
  const date = appointmentDate(appointment.appointment_date);
  const opening = clinicTime(appointment.checkin_opens_at);
  const deadline = clinicTime(appointment.checkin_deadline_at);
  const canViewQr = appointment.status === 'approved' && date === clinicDate();
  return <section className="ap-card ap-upcoming">
    <div className="ap-section-heading ap-upcoming-heading"><CalendarDays /><h2>Your Upcoming Appointment</h2><button type="button" aria-label="View upcoming appointment details" onClick={() => onView(appointment)}>···</button></div>
    <div className="ap-upcoming-content">
      <div className="ap-date-tile"><span>{date ? formatAppointmentDate(date, { month: 'short', year: undefined, day: undefined }).toUpperCase() : 'DATE'}</span><strong>{date ? date.slice(-2) : '—'}</strong><small>{date ? formatAppointmentDate(date, { weekday: 'short', day: undefined, month: undefined, year: undefined }) : 'Not provided'}</small></div>
      <div className="ap-upcoming-details"><Stethoscope /><div><strong>{serviceTitle(appointment.service)}</strong><small>{appointment.concern || 'Scheduled clinic visit'}</small></div><UserRound /><div><span>{providerName(appointment)}</span><small>Clinic staff</small></div></div>
      <div className="ap-upcoming-place"><div><MapPin /><span><strong>{roomName(appointment)}</strong><small>Campus clinic</small></span></div><div><Clock /><span><strong>{appointment.time_slot || 'Not provided'}</strong><small>Asia/Manila</small></span></div></div>
      <div className="ap-upcoming-state"><StatusBadge status={appointment.status} /><p>{opening && deadline ? <>Check-in opens {opening}<br />Closes strictly at {deadline}</> : 'Check-in window is provided by the clinic.'}</p>{appointment.queue?.status && <span className="ap-queue-label">Queue: {appointment.queue.status.replaceAll('_', ' ')}</span>}</div>
      <div className="ap-upcoming-actions">
        {canViewQr ? <Link to="/student/qr" className="ap-button"><FileText />View QR Code</Link> : <button type="button" className="ap-button" disabled title="QR is available on the day of an approved appointment."><FileText />View QR Code</button>}
        <button type="button" className="ap-button ap-button-outline" disabled={appointment.status !== 'pending'} title={appointment.status === 'pending' ? 'Edit your pending request' : 'Contact the clinic to reschedule an approved visit'} onClick={() => onEdit(appointment)}><RotateCcw />Reschedule</button>
      </div>
    </div>
  </section>;
}

export default function ApprovedAppointmentsView({ appointments, filteredAppointments, form, onChange, onSubmit, onView, onEdit,
  filter, onFilter, editingId, onCancelEdit, services, timeSlots, availableSlots, slotsLoading, loading, message, messageType, retrySlots }) {
  const { query } = useContext(StudentPortalSearchContext);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filter, query]);
  const history = useMemo(() => {
    const search = query.trim().toLowerCase();
    return filteredAppointments.filter(item => !search || [item.service, item.reference_number, item.concern, item.status, item.time_slot, providerName(item)]
      .filter(Boolean).join(' ').toLowerCase().includes(search));
  }, [filteredAppointments, query]);
  const pages = Math.max(1, Math.ceil(history.length / 5));
  const currentPage = Math.min(page, pages);
  const rows = history.slice((currentPage - 1) * 5, currentPage * 5);
  const upcoming = appointments.filter(item => ['approved', 'pending'].includes(item.status) && appointmentDate(item.appointment_date) >= clinicDate())
    .sort((a, b) => (a.status === 'approved' ? 0 : 1) - (b.status === 'approved' ? 0 : 1)
      || (appointmentTime(a.appointment_date, a.time_slot)?.getTime() || 0) - (appointmentTime(b.appointment_date, b.time_slot)?.getTime() || 0))[0];
  const selectedSlot = availableSlots.find(slot => slot.time === form.time);
  const selectedInstant = appointmentTime(form.date, form.time);
  const canBook = Boolean(form.service && form.date && form.time && selectedSlot && !selectedSlot.isFull && selectedInstant && selectedInstant >= new Date() && !slotsLoading && !loading);
  const progress = !form.date ? 1 : !form.time ? 2 : !form.service ? 3 : 4;
  return <>
    <AppointmentHero />
    {message && <div role="status" aria-live="polite" className={`ap-message ${messageType === 'success' ? 'is-success' : 'is-error'}`}>{message}</div>}
    <UpcomingAppointment appointment={upcoming} onView={onView} onEdit={onEdit} />
    <section id="appointment-booking" className="ap-card ap-booking">
      <div className="ap-section-heading"><CalendarDays /><div><h2>{editingId ? 'Edit Appointment' : 'Book a New Appointment'}</h2><p>{editingId ? 'Update your pending appointment request.' : 'Choose a date, time, and service that works for you.'}</p></div>{editingId && <button type="button" className="ap-text-button" onClick={onCancelEdit}>Cancel editing</button>}</div>
      {/* The four booking steps render as a vertical timeline: a numbered
          spine (marker + connector line) on the left, one soft panel of
          content per step on the right — left-aligned, never centered. */}
      <form className="ap-booking-steps" onSubmit={onSubmit} noValidate>
        <ol className="ap-booking-progress" aria-label="Booking progress">
          <li aria-current={progress === 1 ? 'step' : undefined} className={`ap-booking-step${progress >= 1 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 1 ? <CheckCircle /> : 1}</span><h3 className="ap-step-label">Select Date</h3></header>
            <section className="ap-booking-column"><CalendarPicker value={form.date} onChange={onChange} disabled={loading} /></section>
          </li>
          <li aria-current={progress === 2 ? 'step' : undefined} className={`ap-booking-step${progress >= 2 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 2 ? <CheckCircle /> : 2}</span><h3 className="ap-step-label">Available Time Slots</h3></header>
            <section className="ap-booking-column"><div className="ap-step-body"><p className="ap-column-caption">{form.date ? formatAppointmentDate(form.date, { weekday: 'long' }) : 'Select an appointment date'}</p>
            {slotsLoading ? <div className="ap-slots-loading" role="status"><div className="ap-slots-loading-grid" aria-hidden="true">{timeSlots.map(time => <span key={time} />)}</div><span className="ap-slots-loading-label"><Loader2 className="animate-spin" />Loading availability…</span></div> : <div className="ap-time-grid">{timeSlots.map(time => {
              const slot = availableSlots.find(item => item.time === time);
              const instant = appointmentTime(form.date, time);
              const past = instant && instant < new Date();
              const unavailable = !form.date || !slot || past || slot.isFull;
              return <button key={time} type="button" disabled={loading || unavailable} aria-pressed={form.time === time} title={slot ? `${slot.available} remaining slots` : 'Availability has not been returned by the clinic'} className={`${form.time === time ? 'is-selected' : ''} ${slot?.isFull ? 'is-full' : ''}`} onClick={() => onChange({ target: { name: 'time', value: time } })}>{time}{slot?.isFull && <span>Full</span>}</button>;
            })}</div>}
            {form.date && !slotsLoading && availableSlots.length === 0 && <p className="ap-availability-note">No availability returned. <button type="button" onClick={retrySlots}>Retry</button></p>}
            <p className="ap-column-footnote">Availability updates automatically.</p>
            </div></section>
          </li>
          <li aria-current={progress === 3 ? 'step' : undefined} className={`ap-booking-step${progress >= 3 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 3 ? <CheckCircle /> : 3}</span><h3 className="ap-step-label">Select Service</h3></header>
            <section className="ap-booking-column"><div className="ap-step-body"><div className="ap-service-list" role="radiogroup" aria-label="Appointment service">{services.map((service, index) => <label key={service} className={form.service === service ? 'is-selected' : ''}>
              <input type="radio" name="service" value={service} checked={form.service === service} onChange={onChange} disabled={loading} />
              {index === 0 ? <Stethoscope /> : <FileText />}<span><strong>{serviceTitle(service)}</strong><small>{SERVICE_NOTES[service]}</small></span>
            </label>)}</div><div className="ap-reason"><label htmlFor="appointment-reason">Add a reason <span>(optional)</span></label><textarea id="appointment-reason" name="concern" value={form.concern} onChange={onChange} rows={2} maxLength={1000} placeholder="Briefly describe your concern…" disabled={loading} /></div></div></section>
          </li>
          <li aria-current={progress === 4 ? 'step' : undefined} className={`ap-booking-step${progress >= 4 ? ' is-active' : ''}`}>
            <header className="ap-step-heading"><span className="ap-step-marker">{progress > 4 ? <CheckCircle /> : 4}</span><h3 className="ap-step-label">Booking Summary</h3></header><section className="ap-booking-column ap-summary"><div className="ap-step-body">
              <dl><div><CalendarDays /><span><dt>Date</dt><dd>{form.date ? formatAppointmentDate(form.date) : 'Choose a date'}</dd></span></div>
                <div><Clock /><span><dt>Time · Asia/Manila</dt><dd>{form.time || 'Choose a time'}</dd></span></div>
                <div><Stethoscope /><span><dt>Service</dt><dd>{form.service ? serviceTitle(form.service) : 'Choose a service'}</dd></span></div></dl>
              <p className="ap-summary-note"><ShieldCheck />Your request is subject to clinic approval.</p>
              <button type="submit" disabled={!canBook} className="ap-button ap-confirm-booking">{loading ? <><Loader2 className="animate-spin" />Saving…</> : <>{editingId ? 'Update Appointment' : 'Confirm Appointment'}<ArrowRight /></>}</button>
            </div></section>
          </li>
        </ol>
      </form>
    </section>
    <section className="ap-card ap-history">
      <div className="ap-section-heading"><Clock /><div><h2>Appointment History</h2><p>View your past and upcoming clinic visits.</p></div><label><span className="sr-only">Filter appointment history</span><select value={filter} onChange={event => onFilter(event.target.value)}><option value="all">All Appointments</option><option value="pending">Pending Requests</option><option value="approved">Approved Appointments</option><option value="past">Past Appointments</option></select></label></div>
      {history.length === 0 ? <div className="ap-history-empty"><CalendarDays /><p>{query ? 'No appointments match your search.' : 'No appointments to display yet.'}</p></div> : <>
        <div className="ap-history-list">
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
        </div>
        <div className="ap-history-pagination"><p>Showing {(currentPage - 1) * 5 + 1}–{Math.min(currentPage * 5, history.length)} of {history.length} appointments</p><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(current => current - 1)} aria-label="Previous history page"><ChevronLeft /></button><span aria-label={`History page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(current => current + 1)} aria-label="Next history page"><ChevronRight /></button></div></div>
      </>}
    </section>
    <p className="ap-policy-note"><HelpCircle />Check-in opens 15 minutes before your slot and closes strictly 30 minutes after. Follow your server-provided window; a queue number is assigned only after kiosk check-in and triage.</p>
  </>;
}
