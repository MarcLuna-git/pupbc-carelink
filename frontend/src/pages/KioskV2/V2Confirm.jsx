import { AlertCircle, ArrowLeft, CalendarDays, Clock, FileText, Loader2, Stethoscope, UserRound } from 'lucide-react';
import { CARD, PRIMARY_BTN, SECONDARY_BTN } from './KioskV2Layout';
import { formatAppointmentDate } from '../../utils/appointmentDate';
import { needsTriage } from '../../utils/kioskTriage';

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-4 border-b border-gray-100 py-4 last:border-0">
    <Icon className="mt-1 h-6 w-6 shrink-0 text-maroon-800" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="break-words text-xl font-bold">{value}</p>
    </div>
  </div>
);

// Step 5: the student checks the appointment their QR found. No queue number exists until
// they confirm here. Consultation continues to the Health Check; other services get the ticket.
const V2Confirm = ({ student, onConfirm, onBack, submitting, error }) => {
  const { user, appointment } = student;
  const triage = needsTriage(appointment.service);
  return (
    <div className="w-full max-w-2xl">
      <h1 className="text-3xl font-extrabold">Confirm Your Appointment</h1>
      <p className="mt-1 text-lg text-gray-600">Check that these details are yours before you continue.</p>

      <section className={`${CARD} mt-6`}>
        <Row icon={UserRound} label="Student" value={`${user.first_name} ${user.last_name}`} />
        <Row icon={CalendarDays} label="Date" value={formatAppointmentDate(appointment.appointment_date)} />
        <Row icon={Clock} label="Time" value={appointment.time_slot} />
        <Row icon={Stethoscope} label="Service" value={appointment.service === 'Consultation' ? 'General Consultation' : appointment.service} />
        {appointment.concern && <Row icon={FileText} label="Reason" value={appointment.concern} />}
      </section>

      <p className="mt-4 text-lg text-gray-600">
        {triage
          ? 'Next, answer a short health check so the nurse can prioritize you.'
          : 'No health check needed. You will get a Regular queue number after you confirm.'}
      </p>

      {error && (
        <p role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {error}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className={`${SECONDARY_BTN} flex-1`}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Not Me
        </button>
        <button type="button" onClick={onConfirm} disabled={submitting} className={`${PRIMARY_BTN} flex-[2]`}>
          {submitting ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : triage ? 'Confirm and Continue' : 'Confirm and Get Ticket'}
        </button>
      </div>
    </div>
  );
};

export default V2Confirm;
