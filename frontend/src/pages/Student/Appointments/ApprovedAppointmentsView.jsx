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
    <svg className="ap-hero-art" viewBox="0 0 620 260" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ap-art-rose" x1="0" x2="1"><stop stopColor="#f4d3cf" /><stop offset="1" stopColor="#c48280" /></linearGradient>
        <linearGradient id="ap-art-hair" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#261b22" /><stop offset="1" stopColor="#632c39" /></linearGradient>
      </defs>
      <path d="M6 214Q18 166 60 162Q43 112 94 106Q93 53 142 78Q166 25 206 57Q249 8 278 54Q325 33 345 79Q394 45 416 90Q477 67 508 109Q576 81 608 133L620 260H0Z" fill="url(#ap-art-rose)" opacity=".42" />
      <g opacity=".82" stroke="#ae6e70" strokeWidth="2">
        <path d="M306 96 461 48 512 63 354 114Z" fill="#c28382" />
        <path d="M312 103 461 59 461 220 312 232Z" fill="#ecd0c6" />
        <path d="M461 59 512 74 512 231 461 220Z" fill="#b47174" />
        <path d="M369 151 585 97 619 108 404 163Z" fill="#96515b" />
        <path d="M404 164 619 110 619 255 404 255Z" fill="#e4bdb3" />
        <path d="M361 176 404 164 404 255 361 241Z" fill="#b67576" />
        {[0,1,2].map(row => <g key={row}>{[0,1,2,3].map(col => <path key={col} d={`M${324+col*29} ${114+row*29-col*7}v19l18-4v-19Z`} fill="#7f4855" stroke="#dcb2aa" />)}</g>)}
        {[0,1].map(row => <g key={row}>{[0,1,2,3,4].map(col => <path key={col} d={`M${418+col*32} ${181+row*32-col*8}v24l23-5v-24Z`} fill="#753746" stroke="#d7a8a1" />)}</g>)}
        <path d="M551 84 610 65 610 244 551 254Z" fill="#e6b5a9" />
        <path d="M541 82 601 62 617 70 556 92Z" fill="#a35a63" />
      </g>
      <g fill="#823945" fontFamily="Arial,sans-serif" fontSize="12" fontWeight="700" transform="translate(564 133) rotate(-10)">
        <text>CARE</text><text y="17">FOR A</text><text y="34">HEALTHIER</text><text y="51">TOMORROW</text>
      </g>
      <g transform="translate(108 0)">
        <path d="M88 238Q74 207 84 167Q54 151 80 121Q60 82 92 42Q123 7 163 23Q202 12 217 57Q233 94 213 145Q242 166 228 206L225 260H88Z" fill="url(#ap-art-hair)" />
        <path d="M154 152 182 147 202 179 204 260H77L86 194 134 163Z" fill="#edddcb" />
        <path d="M154 136 156 171 180 179 188 160 182 129Z" fill="#dc9c87" />
        <path d="M117 67Q128 40 163 52Q186 59 191 93L188 122Q181 151 158 154Q133 143 126 112Z" fill="#f4c7b1" />
        <path d="M108 95Q101 49 134 37Q180 19 199 57Q202 73 189 91L183 66Q162 83 147 68Q132 62 122 98Z" fill="url(#ap-art-hair)" />
        <path d="M180 86 193 108 181 114" fill="#edb29b" />
        <path d="M151 94q8-5 14 0" fill="none" stroke="#59323a" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M161 91v6" stroke="#33212a" strokeWidth="3" strokeLinecap="round" />
        <path d="M176 127q-10 8-18-1" fill="none" stroke="#b86468" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M131 143 126 187 145 212 161 172M188 151 202 185 178 212 165 178" fill="#fff1de" stroke="#c9aa9f" strokeWidth="2" />
        <path d="M143 171Q128 208 152 224Q180 233 178 179" fill="none" stroke="#6c3946" strokeWidth="4" />
        <circle cx="159" cy="224" r="8" fill="#e5b5ac" stroke="#6c3946" strokeWidth="3" />
        <path d="M86 199Q105 177 130 191L154 260H75Z" fill="#7c1f34" />
        <path d="M89 198Q105 174 122 194" fill="none" stroke="#a65062" strokeWidth="8" />
        <path d="M185 211q-15 13-26 10l-9-11q-7-7-11-2l5 27q18 10 42-2" fill="#efbea8" />
        <path d="M109 106Q94 146 116 165M96 74Q77 121 105 145" fill="none" stroke="#a66a6b" strokeWidth="3" opacity=".4" />
      </g>
      <path d="M0 252Q90 233 147 251Q230 235 301 255Q410 241 620 248V260H0Z" fill="#8d4350" opacity=".23" />
    </svg>
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
      <ol className="ap-booking-progress" aria-label="Booking progress">{['Select Date', 'Choose Time', 'Select Service', 'Review & Book'].map((label, index) => <li key={label} aria-current={progress === index + 1 ? 'step' : undefined} className={progress >= index + 1 ? 'is-active' : ''}><span>{progress > index + 1 ? <CheckCircle /> : index + 1}</span>{label}</li>)}</ol>
      <form className="ap-booking-grid" onSubmit={onSubmit} noValidate>
        <section className="ap-booking-column"><h3>Select Date</h3><CalendarPicker value={form.date} onChange={onChange} disabled={loading} /></section>
        <section className="ap-booking-column"><h3>Available Time Slots</h3><p className="ap-column-caption">{form.date ? formatAppointmentDate(form.date, { weekday: 'long' }) : 'Select an appointment date'}</p>
          {slotsLoading ? <div className="ap-slots-loading" role="status"><Loader2 className="animate-spin" />Loading availability…</div> : <div className="ap-time-grid">{timeSlots.map(time => {
            const slot = availableSlots.find(item => item.time === time);
            const instant = appointmentTime(form.date, time);
            const past = instant && instant < new Date();
            const unavailable = !form.date || !slot || past || slot.isFull;
            return <button key={time} type="button" disabled={loading || unavailable} aria-pressed={form.time === time} title={slot ? `${slot.available} remaining slots` : 'Availability has not been returned by the clinic'} className={`${form.time === time ? 'is-selected' : ''} ${slot?.isFull ? 'is-full' : ''}`} onClick={() => onChange({ target: { name: 'time', value: time } })}>{time}{slot?.isFull && <span>Full</span>}</button>;
          })}</div>}
          {form.date && !slotsLoading && availableSlots.length === 0 && <p className="ap-availability-note">No availability returned. <button type="button" onClick={retrySlots}>Retry</button></p>}
          <p className="ap-column-footnote">Availability updates automatically.</p>
        </section>
        <section className="ap-booking-column"><h3>Select Service</h3><div className="ap-service-list" role="radiogroup" aria-label="Appointment service">{services.map((service, index) => <label key={service} className={form.service === service ? 'is-selected' : ''}>
          <input type="radio" name="service" value={service} checked={form.service === service} onChange={onChange} disabled={loading} />
          {index === 0 ? <Stethoscope /> : <FileText />}<span><strong>{serviceTitle(service)}</strong><small>{SERVICE_NOTES[service]}</small></span>
        </label>)}</div><details className="ap-reason" open={form.concern ? true : undefined}><summary>Add a reason <span>(optional)</span></summary><label className="sr-only" htmlFor="appointment-reason">Appointment reason</label><textarea id="appointment-reason" name="concern" value={form.concern} onChange={onChange} rows={2} maxLength={1000} placeholder="Briefly describe your concern…" disabled={loading} /></details></section>
        <section className="ap-booking-column ap-summary"><h3>Booking Summary</h3>
          <dl><div><CalendarDays /><span><dt>Date</dt><dd>{form.date ? formatAppointmentDate(form.date) : 'Choose a date'}</dd></span></div>
            <div><Clock /><span><dt>Time · Asia/Manila</dt><dd>{form.time || 'Choose a time'}</dd></span></div>
            <div><Stethoscope /><span><dt>Service</dt><dd>{form.service ? serviceTitle(form.service) : 'Choose a service'}</dd></span></div></dl>
          <p className="ap-summary-note"><ShieldCheck />Your request is subject to clinic approval.</p>
          <button type="submit" disabled={!canBook} className="ap-button ap-confirm-booking">{loading ? <><Loader2 className="animate-spin" />Saving…</> : <>{editingId ? 'Update Appointment' : 'Confirm Appointment'}<ArrowRight /></>}</button>
        </section>
      </form>
    </section>
    <section className="ap-card ap-history">
      <div className="ap-section-heading"><Clock /><div><h2>Appointment History</h2><p>View your past and upcoming clinic visits.</p></div><label><span className="sr-only">Filter appointment history</span><select value={filter} onChange={event => onFilter(event.target.value)}><option value="all">All Appointments</option><option value="pending">Pending Requests</option><option value="approved">Approved Appointments</option><option value="past">Past Appointments</option></select></label></div>
      {history.length === 0 ? <div className="ap-history-empty"><CalendarDays /><p>{query ? 'No appointments match your search.' : 'No appointments to display yet.'}</p></div> : <>
        <div className="ap-history-table-wrap"><table><thead><tr>{['Date', 'Service', 'Provider', 'Room', 'Status', 'Actions'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{rows.map(appointment => <tr key={appointment.id}>
          <td data-label="Date"><strong>{formatAppointmentDate(appointment.appointment_date)}</strong><small>{appointment.time_slot || 'Not provided'}</small></td>
          <td data-label="Service">{serviceTitle(appointment.service)}</td><td data-label="Provider">{providerName(appointment)}</td><td data-label="Room">{roomName(appointment)}</td><td data-label="Status"><StatusBadge status={appointment.status} />{appointment.queue?.status && <small>Queue: {appointment.queue.status.replaceAll('_', ' ')}</small>}</td>
          <td data-label="Actions"><div className="ap-history-actions"><button type="button" onClick={() => onView(appointment)}><FileText />View Details</button>{appointment.status === 'approved' && appointmentDate(appointment.appointment_date) === clinicDate() && <Link to="/student/qr"><FileText />View QR Code</Link>}{appointment.status === 'pending' && <button type="button" onClick={() => onEdit(appointment)}><RotateCcw />Reschedule</button>}</div></td>
        </tr>)}</tbody></table></div>
        <div className="ap-history-pagination"><p>Showing {(currentPage - 1) * 5 + 1}–{Math.min(currentPage * 5, history.length)} of {history.length} appointments</p><div><button type="button" disabled={currentPage === 1} onClick={() => setPage(current => current - 1)} aria-label="Previous history page"><ChevronLeft /></button><span aria-label={`History page ${currentPage} of ${pages}`}>{currentPage}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(current => current + 1)} aria-label="Next history page"><ChevronRight /></button></div></div>
      </>}
    </section>
    <p className="ap-policy-note"><HelpCircle />Check-in opens 15 minutes before your slot and closes strictly 30 minutes after. Follow your server-provided window; a queue number is assigned only after kiosk check-in and triage.</p>
  </>;
}
