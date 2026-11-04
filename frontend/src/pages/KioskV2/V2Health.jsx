import { useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { CARD, PRIMARY_BTN, SECONDARY_BTN } from './KioskV2Layout';
import { PAIN_LEVELS, SYMPTOM_DURATIONS, painBand } from '../../utils/kioskTriage';

// Values match the backend's accepted red_flags.
const RED_FLAGS = [
  ['difficulty_breathing', 'Difficulty breathing'],
  ['severe_chest_pain', 'Severe chest pain'],
  ['heavy_uncontrolled_bleeding', 'Heavy or uncontrolled bleeding'],
  ['fainting', 'Fainting or loss of consciousness'],
  ['severe_allergic_reaction', 'Severe allergic reaction'],
  ['seizure', 'Seizure'],
  ['sudden_weakness_confusion', 'Sudden severe weakness or confusion'],
];


const SECTION = 'text-lg font-bold text-gray-900';

// Step 5 (General Consultation only): warning signs first (triage standard), then symptoms,
// how long, and pain. The symptoms start from the reason given when booking.
const V2Health = ({ reason = '', onSubmit, onBack, submitting, error }) => {
  const [flags, setFlags] = useState(null); // null = not answered, [] = none of these
  const [pain, setPain] = useState(null);
  const [complaint, setComplaint] = useState(reason);
  const [duration, setDuration] = useState(null);
  const [formError, setFormError] = useState('');

  const toggleFlag = (flag) => {
    setFormError('');
    setFlags((current) => {
      const list = current || [];
      return list.includes(flag) ? list.filter((item) => item !== flag) : [...list, flag];
    });
  };

  const submit = (event) => {
    event.preventDefault();
    if (flags === null) return setFormError('Please answer the warning signs question.');
    if (!complaint.trim()) return setFormError('Please describe your symptoms.');
    if (!duration) return setFormError('Please tell us how long you have had these symptoms.');
    if (pain === null) return setFormError('Please rate your pain from 1 to 10.');
    setFormError('');
    onSubmit({
      chief_complaint: complaint.trim(),
      symptom_duration: duration,
      pain_level: pain,
      red_flags: flags.length ? flags : ['none'],
    });
  };

  const hasRedFlag = flags?.length > 0;
  const message = formError || error;

  return (
    <form onSubmit={submit} className="w-full max-w-3xl">
      <h1 className="text-3xl font-extrabold">Health Check</h1>
      <p className="mt-1 text-lg text-gray-600">Tell us how you feel so the nurse can prioritize you.</p>

      <section className={`${CARD} mt-6`}>
        <h2 className={SECTION}>1. Do you have any of these right now?</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {RED_FLAGS.map(([value, label]) => {
            const active = flags?.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={!!active}
                onClick={() => toggleFlag(value)}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 text-left font-semibold transition-colors ${active ? 'border-red-600 bg-red-50 text-red-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${active ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300'}`}>
                  {active && <Check className="h-4 w-4" aria-hidden="true" />}
                </span>
                {label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={flags !== null && flags.length === 0}
            onClick={() => { setFlags([]); setFormError(''); }}
            className={`flex min-h-14 items-center justify-center rounded-xl border-2 px-4 font-bold transition-colors sm:col-span-2 ${flags !== null && flags.length === 0 ? 'border-maroon-800 bg-maroon-800 text-white' : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
          >
            None of these
          </button>
        </div>
        {hasRedFlag && (
          <p role="alert" className="mt-4 flex items-start gap-3 rounded-xl bg-red-600 p-4 font-semibold text-white">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
            Please tell the clinic staff right away. You will be placed in the priority queue.
          </p>
        )}
      </section>

      <section className={`${CARD} mt-4`}>
        <label htmlFor="kioskv2-complaint" className={SECTION}>2. What are your symptoms?</label>
        <textarea
          id="kioskv2-complaint"
          rows={3}
          maxLength={500}
          value={complaint}
          onChange={(e) => { setComplaint(e.target.value); setFormError(''); }}
          placeholder="Example: headache and fever"
          className="mt-3 w-full rounded-2xl border-2 border-gray-300 p-4 text-lg focus:border-maroon-800 focus:outline-none"
        />
      </section>

      <section className={`${CARD} mt-4`}>
        <h2 className={SECTION}>3. How long have you had these symptoms?</h2>
        <div role="radiogroup" aria-label="Symptom duration" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SYMPTOM_DURATIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={duration === option}
              onClick={() => { setDuration(option); setFormError(''); }}
              className={`min-h-14 rounded-xl border-2 px-3 text-lg font-bold transition-colors ${duration === option ? 'border-maroon-800 bg-maroon-800 text-white' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}
            >
              {option.replace('-', '–')}
            </button>
          ))}
        </div>
      </section>

      <section className={`${CARD} mt-4`}>
        <h2 className={SECTION}>4. Rate your pain</h2>
        <p className="mt-1 text-gray-600">1 means very mild, 10 means the worst pain you can imagine.</p>
        <div role="radiogroup" aria-label="Pain from 1 to 10" className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-10">
          {PAIN_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={pain === level}
              onClick={() => { setPain(level); setFormError(''); }}
              className={`min-h-14 rounded-xl border-2 text-xl font-bold transition-colors ${pain === level ? 'border-maroon-800 bg-maroon-800 text-white' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'}`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="mt-3 min-h-6 font-semibold text-maroon-800" aria-live="polite">
          {pain !== null && `${pain} / 10 · ${painBand(pain)}`}
        </p>
      </section>

      {message && (
        <p role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /> {message}
        </p>
      )}

      <div className="mt-6 flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className={`${SECONDARY_BTN} flex-1`}>
          <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Back
        </button>
        <button type="submit" disabled={submitting} className={`${PRIMARY_BTN} flex-[2]`}>
          {submitting ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" /> : 'Get My Ticket'}
        </button>
      </div>
    </form>
  );
};

export default V2Health;
