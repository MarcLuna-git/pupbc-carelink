import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import clinicLogo from '../../assets/clinic-logo.webp';
import { PRIMARY_BTN } from './KioskV2Layout';

const greetingFor = (hour) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

// Step 1: the whole screen is the start button.
const V2Home = ({ onStart }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <button
      type="button"
      onClick={onStart}
      className="flex w-full max-w-2xl cursor-pointer flex-col items-center text-center focus-visible:outline-none"
    >
      <img src={clinicLogo} alt="PUPBC CareLink logo" className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-md" />
      <p className="mt-6 text-lg font-semibold text-maroon-800">{greetingFor(now.getHours())}!</p>
      <h1 className="mt-1 text-5xl font-extrabold tracking-tight text-gray-900 md:text-6xl">PUPBC CareLink</h1>
      <p className="mt-3 text-xl text-gray-600">Clinic Self-Service Kiosk</p>

      <p className="mt-8 flex items-center gap-2 text-base text-gray-500">
        <Clock className="h-5 w-5" aria-hidden="true" />
        {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
        {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </p>

      <span className={`${PRIMARY_BTN} mt-10 min-h-20 px-16 text-2xl`}>Tap to Start</span>
      <p className="mt-4 text-sm text-gray-500">Have your appointment QR code or Student ID ready.</p>
    </button>
  );
};

export default V2Home;
