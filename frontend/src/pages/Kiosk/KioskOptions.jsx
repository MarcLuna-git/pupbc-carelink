import { useEffect, useState } from 'react';
import { QrCode, Keyboard, ArrowLeft, HelpCircle, Info, X } from 'lucide-react';
import KioskLayout from '../../layouts/KioskLayout';

const KioskOptions = ({ onScanQR, onEnterID, onBack }) => {
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (!showHelp) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') setShowHelp(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showHelp]);

  const options = [
    {
      id: 'qr',
      icon: QrCode,
      title: 'Scan QR Code',
      desc: 'Quick check-in using your unique QR code from the student portal.',
      border: 'border-blue-400/20',
      iconBg: 'bg-blue-400/10',
      iconColor: 'text-blue-400',
      onClick: onScanQR,
    },
    {
      id: 'manual',
      icon: Keyboard,
      title: 'Enter Student ID',
      desc: 'Manually type your Student ID to look up your appointment.',
      border: 'border-yellow-400/20',
      iconBg: 'bg-yellow-400/10',
      iconColor: 'text-yellow-400',
      onClick: onEnterID,
    },
  ];

  return (
    <KioskLayout>
      <div className="relative w-full max-w-2xl mx-auto text-center">
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          aria-label="Check-in help and emergency notice"
          title="No appointment or urgent emergency?"
          className="absolute right-0 -top-12 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white"
        >
          <HelpCircle className="h-7 w-7" />
        </button>

        <div className="mb-8">
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onBack}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-[15px] border border-white/10 transition"
            >
              <ArrowLeft className="w-5 h-5 text-white/70" />
            </button>
            <h1 className="text-3xl md:text-4xl font-bold text-white">How would you like to check in?</h1>
          </div>
          <p className="text-white/70 text-sm md:text-base mt-2 text-center">Choose one option below to continue</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 max-w-2xl mx-auto">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={option.onClick}
              className={`bg-white/[0.03] backdrop-blur-xl rounded-[15px] p-6 md:p-8 border ${option.border} hover:bg-white/[0.06] transition-colors text-center flex flex-col items-center h-full`}
            >
              <div className={`w-16 h-16 md:w-20 md:h-20 ${option.iconBg} rounded-[15px] flex items-center justify-center mb-4`}>
                <option.icon className={`w-8 h-8 md:w-10 md:h-10 ${option.iconColor}`} />
              </div>

              <h3 className="text-lg md:text-xl font-bold text-white mb-2">{option.title}</h3>

              <p className="text-white/70 text-sm leading-relaxed flex-1">{option.desc}</p>
            </button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/70">
          Kiosk check-in is available only for eligible appointments scheduled for today.
        </p>
      </div>

      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowHelp(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-help-title"
            className="relative w-full max-w-md rounded-[15px] border border-slate-200 bg-white p-6 text-center text-slate-900 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-[15px] p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <Info className="h-7 w-7" />
            </div>

            <h2 id="kiosk-help-title" className="text-xl font-bold text-slate-900">
              No Appointment or Urgent Emergency?
            </h2>

            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Do not use kiosk check-in. Please go directly to the clinic or call emergency services.
            </p>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                autoFocus
                className="min-w-[120px] rounded-[15px] bg-maroon-800 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-maroon-900"
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </KioskLayout>
  );
};

export default KioskOptions;
