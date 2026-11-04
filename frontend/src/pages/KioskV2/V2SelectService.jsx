import { ArrowLeft, CalendarCheck, CircleHelp, FileText, Stethoscope, Syringe } from 'lucide-react';
import { SECONDARY_BTN } from './KioskV2Layout';

// Same service names the student portal books appointments with.
export const SERVICES = [
  { name: 'Consultation', desc: 'Check-ups and health concerns', icon: Stethoscope },
  { name: 'Medical Certificate', desc: 'For school or work requirements', icon: FileText },
  { name: 'Follow-up Checkup', desc: 'Return visit after a consultation', icon: CalendarCheck },
  { name: 'Vaccination', desc: 'Scheduled vaccine doses', icon: Syringe },
  { name: 'Other', desc: 'Other clinic concerns', icon: CircleHelp },
];

// Only General Consultation has a Health Check; the others go straight to a regular ticket.
export { needsTriage as needsHealthCheck } from '../../utils/kioskTriage';

// Step 3: the student picks the service of today's appointment.
const V2SelectService = ({ onSelect, onBack }) => (
  <div className="w-full max-w-3xl">
    <h1 className="text-3xl font-extrabold">Select a Service</h1>
    <p className="mt-1 text-lg text-gray-600">Choose the service of your appointment today.</p>

    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {SERVICES.map(({ name, desc, icon: Icon }) => (
        <button
          key={name}
          type="button"
          onClick={() => onSelect(name)}
          className="flex min-h-24 items-center gap-4 rounded-2xl border-2 border-gray-200 bg-white p-5 text-left transition-colors hover:border-maroon-800 hover:bg-maroon-50 active:bg-maroon-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-maroon-300"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-maroon-800 text-white">
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xl font-bold text-gray-900">{name}</span>
            <span className="block text-gray-600">{desc}</span>
          </span>
        </button>
      ))}
    </div>

    <button type="button" onClick={onBack} className={`${SECONDARY_BTN} mt-6 w-full`}>
      <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back
    </button>
  </div>
);

export default V2SelectService;
