import { Calendar, ChevronRight, ClipboardPlus } from 'lucide-react';

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

export function AppointmentRows({ appointments, statusConfig, formatDate, onView }) {
  return (
    <ul className="appointment-rows">
      {appointments.map((appointment) => {
        const config = statusConfig[appointment.status] || statusConfig.pending;
        const StatusIcon = config.icon;
        return (
          <li key={appointment.id} className={`appointment-row ${appointment.status === 'pending' ? 'appointment-row-pending' : ''}`}>
            <div className={`appointment-row-icon ${config.bg} ${config.text}`} aria-hidden="true"><Calendar className="h-6 w-6" /></div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-bold text-gray-900 dark:text-white">{appointment.service || 'Appointment'}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                {formatDate(appointment.appointment_date)} <span aria-hidden="true"> · </span> {appointment.time_slot || 'N/A'}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {appointment.queue?.queue_number
                  ? `Queue ${appointment.queue.queue_number} · ${appointment.queue.queue_type || 'Queue'}`
                  : 'Queue assigned after clinic check-in'}
              </p>
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
