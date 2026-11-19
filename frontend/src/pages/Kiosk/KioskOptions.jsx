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
      border: 'border-white/15',
      iconBg: 'bg-white/10 border border-white/15',
      iconColor: 'text-white/90',
      onClick: onScanQR,
    },
    {
      id: 'manual',
      icon: Keyboard,
      title: 'Enter Student ID',
      desc: 'Manually type your Student ID to look up your appointment.',
      border: 'border-white/15',
      iconBg: 'bg-white/10 border border-white/15',
      iconColor: 'text-white/90',
      onClick: onEnterID,
    },
  ];

  return (
    <KioskLayout contentClassName="items-stretch pt-14 pb-10">
      <div className="flex w-full max-w-3xl mx-auto flex-col text-center">
        <div className="grid grid-cols-[46px_1fr_46px] items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="p-3 bg-white/5 rounded-[15px] border border-white/10 justify-self-start"
          >
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
          <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold text-white">How would you like to check in?</h1>
          <span aria-hidden="true" />
        </div>

        <div className="flex flex-1 flex-col justify-center py-6">
          <h2 className="text-white/90 text-xl md:text-2xl font-bold mb-6 text-center">Choose one option below to continue</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 w-full max-w-3xl mx-auto">
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={option.onClick}
                className={`bg-white/[0.06] backdrop-blur-xl rounded-[15px] p-7 md:p-8 aspect-square w-full max-w-sm mx-auto md:max-w-none border ${option.border} text-center flex flex-col items-center justify-center`}
              >
                <div className={`w-20 h-20 md:w-24 md:h-24 ${option.iconBg} rounded-[15px] flex items-center justify-center mb-6`}>
                  <option.icon className={`w-10 h-10 md:w-12 md:h-12 ${option.iconColor}`} />
                </div>

                <h3 className="text-xl md:text-2xl font-bold text-white mb-3">{option.title}</h3>

                <p className="text-white/75 text-sm md:text-base leading-relaxed max-w-xs">{option.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-white/70">
            <p>Kiosk check-in is available only for eligible appointments scheduled for today.</p>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              aria-label="Check-in help and emergency notice"
              title="No appointment or urgent emergency?"
              className="inline-flex items-center gap-1 font-medium text-white/90 underline underline-offset-2"
            >
              <HelpCircle className="h-4 w-4 shrink-0" />
              <span>No appointment or emergency?</span>
            </button>
          </div>
        </div>
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
              className="absolute right-4 top-4 rounded-[15px] p-2 text-slate-400"
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
                className="min-w-[120px] rounded-[15px] bg-maroon-800 px-6 py-3 text-sm font-bold text-white"
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
