import { useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Clock, Lock, UserCheck } from 'lucide-react';
import { CARD, PRIMARY_BTN, SECONDARY_BTN } from './KioskV2Layout';

// Same policies as the v1 kiosk Terms page.
const POLICIES = [
  {
    icon: Lock,
    title: 'Data Privacy',
    text: 'Your personal and health information is protected under RA 10173 (Data Privacy Act of 2012). We only collect what is necessary for your clinic visit.',
  },
  {
    icon: UserCheck,
    title: 'Accuracy',
    text: 'Please ensure all information provided is accurate. False information may affect the quality of care you receive from our clinic.',
  },
  {
    icon: Clock,
    title: 'Queue System',
    text: 'You will be assigned a queue number upon check-in. Priority may be given to emergency cases, PWDs, and pregnant students.',
  },
  {
    icon: Clock,
    title: 'Check-in Window',
    text: 'Check-in opens 15 minutes before your appointment and closes 30 minutes after. If you do not check in within this window, your appointment will expire.',
  },
  {
    icon: AlertCircle,
    title: 'No-Show Policy',
    text: 'If you are absent when called, the nurse may skip your turn. Tell the nurse when you return. If you remain skipped after your original check-in deadline, your visit will be marked as no-show.',
  },
];

const V2Terms = ({ onAgree, onBack }) => {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="w-full max-w-3xl">
      <h1 className="text-3xl font-extrabold">Terms &amp; Privacy</h1>
      <p className="mt-1 text-lg text-gray-600">Please review our policies before you check in.</p>

      <div className={`${CARD} mt-6 max-h-[45vh] space-y-5 overflow-y-auto`}>
        {POLICIES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-maroon-50 text-maroon-800">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-bold text-gray-900">{title}</h2>
              <p className="mt-0.5 text-gray-600">{text}</p>
            </div>
          </div>
        ))}
      </div>

      <label className={`mt-4 flex cursor-pointer items-center gap-4 rounded-2xl border-2 p-5 transition-colors ${accepted ? 'border-maroon-800 bg-maroon-50' : 'border-gray-200 bg-white'}`}>
        <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="sr-only" />
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 ${accepted ? 'border-maroon-800 bg-maroon-800 text-white' : 'border-gray-400 bg-white'}`}>
          {accepted && <Check className="h-5 w-5" aria-hidden="true" />}
        </span>
        <span className="text-lg font-semibold text-gray-800">
          I have read and agree to the Terms &amp; Conditions and Privacy Policy.
        </span>
      </label>

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onBack} className={`${SECONDARY_BTN} flex-1`}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back
        </button>
        <button type="button" onClick={onAgree} disabled={!accepted} className={`${PRIMARY_BTN} flex-[2]`}>
          Agree &amp; Continue
        </button>
      </div>
    </div>
  );
};

export default V2Terms;
