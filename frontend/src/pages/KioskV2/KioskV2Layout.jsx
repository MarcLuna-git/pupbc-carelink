import { Home } from 'lucide-react';
import clinicLogo from '../../assets/clinic-logo.webp';

// Kiosk v2 shares nothing visual with v1: a light page, one maroon header bar,
// and large touch targets. Buttons are reused by every v2 step.
export const PRIMARY_BTN =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-maroon-800 px-8 text-lg font-bold text-white transition-colors hover:bg-maroon-900 active:bg-maroon-950 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-maroon-300';
export const SECONDARY_BTN =
  'inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-gray-300 bg-white px-6 text-lg font-semibold text-gray-700 transition-colors hover:bg-gray-50 active:bg-gray-100 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-maroon-300';
export const CARD = 'rounded-3xl border border-gray-200 bg-white p-6 shadow-sm md:p-8';

export const STEPS = ['Welcome', 'Terms', 'Service', 'Check-in', 'Confirm', 'Ticket'];

const KioskV2Layout = ({ step, onHome, children }) => (
  <div className="flex min-h-screen flex-col bg-[#f6f2ec] text-gray-900">
    {step > 1 && (
      <header className="bg-maroon-800 text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <img src={clinicLogo} alt="" className="h-11 w-11 rounded-full bg-white object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold leading-tight">PUPBC CareLink</p>
            <p className="text-sm text-white/75">
              Step {step} of {STEPS.length} · {STEPS[step - 1]}
            </p>
          </div>
          <button
            type="button"
            onClick={onHome}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-4 text-sm font-semibold hover:bg-white/10"
          >
            <Home className="h-4 w-4" aria-hidden="true" /> Home
          </button>
        </div>
        <div className="h-1.5 bg-maroon-950/40">
          <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} />
        </div>
      </header>
    )}

    <main className="flex flex-1 items-center justify-center px-5 py-8 md:px-10">{children}</main>

    <footer className="pb-4 text-center text-xs text-gray-500">PUP Biñan Campus • Clinic Health Services</footer>
  </div>
);

export default KioskV2Layout;
