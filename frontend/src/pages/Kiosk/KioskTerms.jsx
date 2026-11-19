import { useState } from 'react';
import KioskLayout from '../../layouts/KioskLayout';

const POLICIES = [
  {
    title: '1. Data Privacy',
    text: 'Your personal and health information is protected under RA 10173 (Data Privacy Act of 2012). We only collect what is necessary for your clinic visit.',
  },
  {
    title: '2. Accuracy of Information',
    text: 'Please ensure all information provided is accurate. False or incomplete details may affect the quality of care you receive from our clinic.',
  },
  {
    title: '3. Queue System',
    text: 'You will be assigned a queue number upon check-in. Priority may be given to emergency cases, PWDs, and pregnant students.',
  },
  {
    title: '4. Check-in Window',
    text: 'Check-in opens 15 minutes before your appointment and closes 30 minutes after. If you do not check in within this window, your appointment will expire.',
  },
  {
    title: '5. No-Show Policy',
    text: 'If you are absent when called, the nurse may skip your turn. Tell the nurse when you return. If you remain skipped after your original check-in deadline, your visit will be marked as no-show.',
  },
];

const KioskTerms = ({ onAgree, onBack }) => {
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!accepted) return;
    onAgree?.();
  };

  return (
    <KioskLayout contentClassName="items-center py-4 pb-8">
      <div className="w-full max-w-2xl mx-auto">
        <div className="mb-9">
          <h1 className="text-2xl font-bold text-white md:text-3xl">Terms and Privacy</h1>
          <p className="mt-1 text-sm text-white/70">Please review our clinic policies before proceeding.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[15px] border border-white/15 bg-white/[0.06] backdrop-blur-xl"
        >
          <div className="divide-y divide-white/10 px-5 sm:px-6">
            {POLICIES.map((policy) => (
              <section key={policy.title} className="py-3">
                <h2 className="text-sm font-semibold text-white">{policy.title}</h2>
                <p className="mt-0.5 text-sm leading-snug text-white/75">{policy.text}</p>
              </section>
            ))}
          </div>

          <div className="border-t border-white/15 bg-black/15 px-5 py-4 sm:px-6 rounded-b-[15px] space-y-5">
            <label className="flex cursor-pointer items-baseline gap-3.5 select-none">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="h-4 w-4 shrink-0 cursor-pointer accent-yellow-400"
              />
              <span className="text-sm leading-snug text-white/85">
                I have read and agree to the <strong className="font-semibold text-white">Terms and Conditions</strong> and <strong className="font-semibold text-white">Privacy Policy</strong>.
              </span>
            </label>

            <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={onBack}
                className="min-h-16 w-full sm:w-auto rounded-[15px] border border-white/15 bg-white/10 px-6 py-3 text-[15px] font-semibold text-white"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={!accepted}
                className={`min-h-16 w-full sm:w-auto rounded-[15px] px-7 py-3 text-[15px] font-bold ${
                  accepted
                    ? 'bg-yellow-400 text-maroon-950'
                    : 'cursor-not-allowed bg-white/10 text-white/45'
                }`}
              >
                Agree and Continue
              </button>
            </div>
          </div>
        </form>
      </div>
    </KioskLayout>
  );
};

export default KioskTerms;
