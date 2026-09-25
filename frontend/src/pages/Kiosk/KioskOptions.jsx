import { motion } from 'framer-motion';
import { QrCode, Keyboard, ArrowLeft, AlertTriangle } from 'lucide-react';
import KioskLayout from '../../layouts/KioskLayout';

const KioskOptions = ({ onScanQR, onEnterID, onBack }) => {
  const options = [
    {
      id: 'qr',
      icon: QrCode,
      title: 'Scan QR Code',
      desc: 'Quick check-in using your unique QR code from the student portal.',
      badge: 'Fastest',
      color: 'from-blue-500/20 to-blue-600/10 border-blue-400/20',
      iconBg: 'bg-blue-400/10',
      iconColor: 'text-blue-400',
      onClick: onScanQR,
    },
    {
      id: 'manual',
      icon: Keyboard,
      title: 'Enter Student ID',
      desc: 'Manually type your Student ID to look up your appointment.',
      badge: 'Easy',
      color: 'from-yellow-500/20 to-yellow-600/10 border-yellow-400/20',
      iconBg: 'bg-yellow-400/10',
      iconColor: 'text-yellow-400',
      onClick: onEnterID,
    },
  ];

  return (
    <KioskLayout>
      <div className="w-full max-w-4xl mx-auto text-center">
        
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={onBack}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition"
            >
              <ArrowLeft className="w-5 h-5 text-white/60" />
            </motion.button>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white">How would you like to check in?</h1>
              <p className="text-white/40 text-sm md:text-base mt-1">Choose one option below to continue</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 max-w-2xl mx-auto"
        >
          {options.map((option, i) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.12, type: 'spring', stiffness: 150 }}
              whileHover={{ scale: 1.03, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={option.onClick}
              className={`relative bg-white/[0.03] backdrop-blur-xl rounded-3xl p-6 md:p-8 border ${option.color} hover:bg-white/[0.06] transition-all duration-500 text-left group overflow-hidden`}
            >
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${option.color}`} />
              
              <div className="relative z-10 flex flex-col items-center text-center h-full">
                <div className={`w-16 h-16 md:w-20 md:h-20 ${option.iconBg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <option.icon className={`w-8 h-8 md:w-10 md:h-10 ${option.iconColor}`} />
                </div>
                
                <h3 className="text-lg md:text-xl font-bold text-white mb-2">{option.title}</h3>
                
                <p className="text-white/35 text-sm leading-relaxed flex-1">{option.desc}</p>
                
                <span className={`inline-block mt-4 text-xs font-semibold ${option.iconColor} ${option.iconBg} px-3 py-1 rounded-full`}>
                  {option.badge}
                </span>
              </div>
            </motion.button>
          ))}
        </motion.div>

        <div className="mt-8 mx-auto max-w-2xl rounded-2xl border border-red-400/20 bg-red-500/5 p-4 text-left flex gap-3">
          <AlertTriangle className="w-5 h-5 text-red-300 shrink-0" />
          <p className="text-red-100/70 text-sm">No appointment or urgent emergency? Do not use kiosk check-in. Please go directly to the clinic or call emergency services.</p>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-white/15 text-xs mt-8"
        >
          Kiosk check-in is available only for eligible appointments scheduled for today.
        </motion.p>
      </div>
    </KioskLayout>
  );
};

export default KioskOptions;