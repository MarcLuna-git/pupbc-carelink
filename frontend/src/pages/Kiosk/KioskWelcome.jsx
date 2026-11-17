import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Stethoscope, Activity } from 'lucide-react';
import clinicLogo from '../../assets/clinic-logo.webp';
import KioskLayout from '../../layouts/KioskLayout';

const getGreeting = (date) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const KioskWelcome = ({ onStart }) => {
  const [time, setTime] = useState(() => new Date());
  const [starting, setStarting] = useState(false);
  const startTimerRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
  }, []);

  const handleStart = () => {
    if (starting) return;
    setStarting(true);
    startTimerRef.current = setTimeout(() => {
      onStart?.();
    }, 920);
  };

  const greeting = getGreeting(time);

  const featureCards = [
    { icon: Clock, title: 'Quick Check-In', desc: 'Complete your clinic registration in seconds.' },
    { icon: Users, title: 'Smart Queue', desc: 'Real-time tracking with priority assignment.' },
    { icon: Stethoscope, title: 'Clinic Services', desc: 'Consultations, certificates, and healthcare.' },
  ];

  const formatDate = (date) => ({
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    fullDate: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    timeStr: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  });

  const dateInfo = formatDate(time);

  return (
    <KioskLayout>
      <div className="absolute right-8 top-6 z-20 text-right md:right-12 md:top-8">
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400" aria-hidden="true" />
          <span className="text-xs font-medium uppercase tracking-widest text-green-300">Live</span>
        </div>
        <p className="text-4xl font-light leading-none tracking-wider text-white md:text-5xl">
          {dateInfo.timeStr}
        </p>
        <p className="mt-1 text-sm text-white/75">
          {dateInfo.weekday} • {dateInfo.fullDate}
        </p>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 text-center md:space-y-6">
        <img
          src={clinicLogo}
          alt="PUPBC CareLink logo"
          className="mx-auto h-28 w-28 rounded-full border border-white/20 bg-white/5 object-cover md:h-32 md:w-32"
        />

        <div>
          <p className="text-base font-medium text-yellow-300 md:text-lg">{greeting}</p>
          <h1 className="mt-1 text-5xl font-extrabold leading-none tracking-tight text-white md:text-6xl lg:text-7xl">
            PUPBC <span className="text-yellow-400">CareLink</span>
          </h1>
          <p className="mt-3 text-lg font-medium text-white/90 md:text-xl">Clinic Self-Service Kiosk</p>
        </div>

        <p className="mx-auto max-w-lg text-base leading-relaxed text-white/80">
          Welcome to the PUP Biñan Campus Clinic. Use this kiosk to check in, monitor your queue, and access clinic services.
        </p>

        <ul className="mx-auto grid max-w-3xl grid-cols-1 gap-x-8 gap-y-4 border-y border-white/15 py-5 text-left sm:grid-cols-3">
          {featureCards.map((card) => (
            <li key={card.title} className="flex items-start gap-3">
              <card.icon className="mt-0.5 h-5 w-5 shrink-0 text-yellow-300" aria-hidden="true" />
              <div>
                <p className="text-base font-semibold text-white">{card.title}</p>
                <p className="text-sm leading-snug text-white/75">{card.desc}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="relative inline-flex min-h-16 min-w-[240px] cursor-pointer items-center justify-center overflow-hidden rounded-[15px] bg-yellow-400 px-12 py-4 text-xl font-extrabold text-maroon-950 shadow-lg shadow-yellow-400/20 transition-colors duration-200 hover:bg-yellow-300 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white active:bg-yellow-500 disabled:cursor-wait"
        >
          {starting ? (
            <motion.span
              key="starting-bar"
              aria-hidden="true"
              initial={{ left: '0%', right: '100%' }}
              animate={{
                left: ['0%', '0%', '100%'],
                right: ['100%', '0%', '0%'],
              }}
              transition={{ duration: 0.9, times: [0, 0.5, 1], ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-y-0 bg-maroon-950/20"
            />
          ) : (
            <motion.span
              key="idle-shimmer"
              aria-hidden="true"
              initial={{ x: '-120%' }}
              animate={{ x: '220%' }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
              className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 to-transparent"
            />
          )}
          <span className="relative z-10">Tap to Start</span>
        </button>
      </div>

      <div className="absolute bottom-6 right-8 z-20 md:bottom-8 md:right-12">
        <div className="flex items-center gap-3 rounded-[15px] border border-white/15 bg-maroon-950/60 px-4 py-3">
          <Activity className="h-5 w-5 text-green-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-white">Clinic Open</p>
            <p className="text-xs text-white/75">8:00 AM – 5:00 PM</p>
          </div>
        </div>
      </div>
    </KioskLayout>
  );
};

export default KioskWelcome;