import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Stethoscope, Sparkles, ChevronRight, Activity } from 'lucide-react';
import clinicLogo from '../../assets/clinic logo.jpg';
import KioskLayout from '../../layouts/KioskLayout';

const KioskWelcome = ({ onStart }) => {
  const [time, setTime] = useState(new Date());
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);
      const hour = now.getHours();
      if (hour < 12) setGreeting('Good Morning');
      else if (hour < 17) setGreeting('Good Afternoon');
      else setGreeting('Good Evening');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const featureCards = [
    { icon: Clock, title: 'Quick Check-In', desc: 'Complete your clinic registration in seconds.', badge: 'Fast' },
    { icon: Users, title: 'Smart Queue', desc: 'Real-time tracking with priority assignment.', badge: 'Live' },
    { icon: Stethoscope, title: 'Clinic Services', desc: 'Consultations, certificates, and healthcare.', badge: 'Available' },
  ];

  const formatDate = (date) => ({
    weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
    fullDate: date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    timeStr: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
  });

  const dateInfo = formatDate(time);

  return (
    <KioskLayout>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="absolute top-6 right-8 md:top-8 md:right-12 text-right z-20"
      >
        <div className="flex items-center justify-end gap-2 mb-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          <span className="text-green-400/50 text-[10px] font-medium tracking-widest uppercase">Live</span>
        </div>
        <p className="text-4xl md:text-5xl font-light text-white tracking-wider leading-none">
          {dateInfo.timeStr}
        </p>
        <p className="text-white/20 text-xs mt-1">
          {dateInfo.weekday} • {dateInfo.fullDate}
        </p>
      </motion.div>

      <div className="w-full max-w-4xl mx-auto text-center space-y-6 md:space-y-8 px-4">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="relative inline-block"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-6 rounded-full border-[1.5px] border-dashed border-yellow-400/[0.08]"
          />
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            className="absolute -inset-3 rounded-full border border-yellow-400/[0.12]"
          />
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            className="relative w-32 h-32 md:w-40 md:h-40 bg-white/[0.03] backdrop-blur-2xl rounded-full flex items-center justify-center p-5 md:p-6 shadow-2xl shadow-yellow-400/[0.06] border border-white/[0.06]"
          >
            <div className="absolute inset-4 rounded-full bg-yellow-400/[0.03] blur-2xl" />
            <img src={clinicLogo} alt="PUPBC CareLink logo" className="w-full h-full object-cover rounded-full relative z-10" />
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="text-yellow-300/60 text-sm md:text-base font-light tracking-[0.15em] uppercase"
        >
          {greeting}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-white leading-[0.9] tracking-tight">
            PUPBC{' '}
            <span className="bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-500 bg-clip-text text-transparent">
              CareLink
            </span>
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="flex items-center justify-center gap-3"
        >
          <div className="h-px w-8 md:w-10 bg-gradient-to-r from-transparent to-yellow-400/30" />
          <span className="text-sm md:text-lg text-white/40 font-medium tracking-wide">Clinic Self-Service Kiosk</span>
          <div className="h-px w-8 md:w-10 bg-gradient-to-l from-transparent to-yellow-400/30" />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="text-white/30 text-sm max-w-lg mx-auto leading-relaxed"
        >
          Welcome to the PUP Biñan Campus Clinic. Use this kiosk to check in, monitor your queue, and access clinic services.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto"
        >
          {featureCards.map((card, i) => (
            <motion.div key={i}
              whileHover={{ y: -3, scale: 1.03 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="group relative bg-white/[0.03] backdrop-blur-xl rounded-2xl p-4 border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.06] transition-all duration-500 overflow-hidden"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-yellow-400/[0.04] to-transparent pointer-events-none" />
              <div className="relative z-10">
                <div className="w-10 h-10 bg-yellow-400/[0.08] rounded-xl flex items-center justify-center mb-3 mx-auto group-hover:bg-yellow-400/[0.15] transition-colors duration-300">
                  <card.icon className="w-5 h-5 text-yellow-300/80" />
                </div>
                <h4 className="text-white text-sm font-semibold mb-1">{card.title}</h4>
                <p className="text-white/25 text-xs leading-relaxed">{card.desc}</p>
                <span className="inline-block mt-2 text-[10px] font-semibold text-yellow-400/50 bg-yellow-400/[0.06] px-2 py-0.5 rounded-full tracking-wide uppercase">{card.badge}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
          onClick={onStart}
          className="group relative inline-flex items-center gap-4 px-10 md:px-14 py-5 md:py-6 bg-gradient-to-r from-yellow-400 to-yellow-500 text-maroon-900 text-lg md:text-xl font-extrabold rounded-2xl shadow-2xl shadow-yellow-400/[0.15] hover:shadow-yellow-400/[0.3] transition-all duration-500 overflow-hidden"
        >
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12" />
          <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.25, 0, 0.25] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-2xl bg-yellow-400/20 -z-10" />
          <Sparkles className="w-5 h-5 md:w-6 md:h-6 group-hover:rotate-12 transition-transform duration-500 relative z-10" />
          <span className="relative z-10 tracking-wide">Tap to Start</span>
          <motion.div animate={{ x: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} className="relative z-10">
            <ChevronRight className="w-6 h-6 md:w-7 md:h-7" />
          </motion.div>
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="absolute bottom-6 right-8 md:bottom-8 md:right-12 z-20"
      >
        <div className="bg-white/[0.02] backdrop-blur-xl rounded-xl px-4 py-3 border border-white/[0.05] flex items-center gap-3">
          <div className="w-8 h-8 bg-green-400/[0.08] rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-green-400/60" />
          </div>
          <div>
            <p className="text-white/50 text-xs font-medium">Clinic Open</p>
            <p className="text-white/20 text-[10px]">8:00 AM – 5:00 PM</p>
          </div>
        </div>
      </motion.div>
    </KioskLayout>
  );
};

export default KioskWelcome;