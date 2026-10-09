import { Calendar, ChevronRight, ClipboardPlus, Clock, AlertCircle, Info } from 'lucide-react';

export function HealthcareAccent({ compact = false }) {
  return (
    <aside className={compact ? 'appointment-banner' : 'appointment-care-panel'}>
      <div className="appointment-illustration" aria-hidden="true">
        {compact ? <Calendar /> : <ClipboardPlus />}
      </div>
      <div>
        <p className="font-bold text-maroon-900 dark:text-maroon-200">
          {compact ? 'Your Health, Our Priority' : 'Quality Care for a Healthier You'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
          {compact ? 'Book, manage, and keep track of your appointments.' : 'Schedule your appointment in just a few steps.'}
        </p>
      </div>
    </aside>
  );
}

// Helper to format time for display
const formatTime = (isoString) => {
  if (!isoString) return null;
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true });
};

export function AppointmentRows({ appointments, statusConfig, formatDate, onView }) {
  return (
    <ul className="appointment-rows">
      {appointments.map((appointment) => {
        const config = statusConfig[appointment.status] || statusConfig.pending;
        const StatusIcon = config.icon;
        const isApproved = appointment.status === 'approved';
        const isExpired = appointment.status === 'expired';
        const checkinOpensAt = appointment.checkin_opens_at;
        const checkinDeadlineAt = appointment.checkin_deadline_at;
        const hasCheckin = !!appointment.queue?.queue_number;

        return (
          <li key={appointment.id} className={`appointment-row ${appointment.status === 'pending' ? 'appointment-row-pending' : ''} ${isExpired ? 'appointment-row-expired' : ''}`}>
            <div className={`appointment-row-icon ${config.bg} ${config.text}`} aria-hidden="true"><Calendar className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-bold text-gray-900 dark:text-white">{appointment.service || 'Appointment'}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                {formatDate(appointment.appointment_date)} <span aria-hidden="true"> · </span> {appointment.time_slot || 'N/A'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {hasCheckin
                  ? `Queue ${appointment.queue.queue_number} · ${appointment.queue.queue_type || 'Queue'} · ${appointment.queue.status || 'waiting'}`
                  : 'Queue assigned after clinic check-in'}
              </p>

              {/* Check-in window info for approved appointments */}
{isApproved && checkinOpensAt && checkinDeadlineAt && !hasCheckin && (
                <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-lg px-2 py-1">
                    <Clock className="w-3 h-3 text-green-600 dark:text-green-400" />
                    <span className="text-green-800 dark:text-green-300">
                      Opens: {formatTime(checkinOpensAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg px-2 py-1">
                    <Clock className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-yellow-800 dark:text-yellow-300">
                      Deadline: {formatTime(checkinDeadlineAt)}
                    </span>
                  </div>
                </div>
              )}

               {/* Expired appointment notice */}
              {isExpired && (
                <div className="mt-2 flex items-center gap-2 text-[10px] bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg px-2 py-1.5 text-red-800 dark:text-red-300">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>Appointment expired - missed check-in window</span>
                </div>
              )}
            </div>
            <div className="appointment-row-actions">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
                <StatusIcon className="h-3 w-3 shrink-0" />
                <span className="capitalize">{appointment.status === 'pending' ? 'Pending Approval' : appointment.status}</span>
              </span>
              <button type="button" onClick={() => onView(appointment)} aria-label={`View details for ${appointment.service || 'appointment'} on ${formatDate(appointment.appointment_date)}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
                View Details <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
