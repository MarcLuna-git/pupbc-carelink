import { useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle, Info } from 'lucide-react';
import api from '../../services/api';
import KioskLayout from '../../layouts/KioskLayout';
import KioskErrorModal from './KioskErrorModal';
import { PAIN_LEVELS, SYMPTOM_DURATIONS, needsTriage, painBand } from '../../utils/kioskTriage';
import { formatAppointmentDate } from '../../utils/appointmentDate';

const FLAGS = [
  ['difficulty_breathing', 'Difficulty breathing'],
  ['severe_chest_pain', 'Severe chest pain'],
  ['heavy_uncontrolled_bleeding', 'Heavy or uncontrolled bleeding'],
  ['fainting', 'Fainting or loss of consciousness'],
  ['severe_allergic_reaction', 'Severe allergic reaction'],
  ['seizure', 'Seizure'],
];


// Section subtitle shown above each part of the confirm form.
const SECTION_TITLE = 'border-t border-white/10 pt-4 text-xs font-semibold uppercase tracking-wider text-yellow-300';

// Tap choices (Warning Signs): same look as the Duration and Pain Level buttons.
const CHOICE = 'min-h-12 cursor-pointer rounded-[15px] border font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
const CHOICE_ON = 'border-yellow-400 bg-yellow-400 text-maroon-950';
const CHOICE_OFF = 'border-white/30 bg-white/5 text-white';

// Shown under a question that was skipped when Confirm and Check In was pressed.
// Always reserves its height (invisible when hidden) so toggling errors never shifts the layout.
const MissingNote = ({ show, children }) => (
  <p
    role={show ? 'alert' : undefined}
    aria-hidden={!show}
    className={'mt-3 flex min-h-5 items-center gap-1.5 text-sm font-semibold text-red-300 ' + (show ? '' : 'invisible')}
  >
    {show && <><AlertCircle className="h-4 w-4 shrink-0" />{children}</>}
  </p>
);
// Red frame around a skipped group of buttons (negative margin cancels padding so layout never jumps).
const missingFrame = (show) => (show ? ' rounded-[15px] p-1.5 -m-1.5 ring-2 ring-red-400' : '');

const KioskConfirm = ({ data, onCheckedIn, onBack, onDone, demoMode = false }) => {
  const { user, appointment, has_active_checkin, active_checkin } = data;
  const [chiefComplaint, setChiefComplaint] = useState(appointment?.concern || '');
  const [editingSymptoms, setEditingSymptoms] = useState(false);
  const symptomsRef = useRef(null);

  useEffect(() => {
    if (!editingSymptoms) return;
    const handlePointerDown = (event) => {
      if (symptomsRef.current && !symptomsRef.current.contains(event.target)) {
        setEditingSymptoms(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [editingSymptoms]);
  // Only General Consultation is triaged here. Other services were explained in the portal
  // and go straight to the regular queue.
  const triage = needsTriage(appointment?.service);
  const [duration, setDuration] = useState(null);
  const [painLevel, setPainLevel] = useState(null);
  const [redFlags, setRedFlags] = useState([]);
  const [hasOther, setHasOther] = useState(false);
  const [editingOther, setEditingOther] = useState(false);
  const [notes, setNotes] = useState('');
  const otherRef = useRef(null);

  useEffect(() => {
    if (!editingOther) return;
    const handlePointerDown = (event) => {
      if (otherRef.current && !otherRef.current.contains(event.target)) {
        if (!notes.trim()) setHasOther(false);
        setEditingOther(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [editingOther, notes]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Questions skipped on the last Confirm press: symptoms, duration, pain, flags, other.
  const [missing, setMissing] = useState({});
  const answered = (key) => { setMissing((current) => (current[key] ? { ...current, [key]: false } : current)); setError(''); };

  // Check-in window from appointment data
  const checkinOpensAt = useMemo(() => {
    if (!appointment?.checkin_opens_at) return null;
    return new Date(appointment.checkin_opens_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [appointment?.checkin_opens_at]);

  const checkinDeadlineAt = useMemo(() => {
    if (!appointment?.checkin_deadline_at) return null;
    return new Date(appointment.checkin_deadline_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }, [appointment?.checkin_deadline_at]);

  useEffect(() => {
    if (!has_active_checkin) return;
    const timer = setTimeout(onDone, 30000);
    return () => clearTimeout(timer);
  }, [has_active_checkin, onDone]);

  if (has_active_checkin && active_checkin) {
    return (
      <KioskLayout>
        <div className="text-center text-white">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Already Checked In</h1>
          <p className="text-6xl font-black text-yellow-300 my-6">{active_checkin.queue_number}</p>
          <p>Please wait for your number to be called.</p>
          <button
            type="button"
            onClick={onDone}
            className="mt-6 inline-flex min-h-16 min-w-[240px] cursor-pointer items-center justify-center rounded-[15px] bg-yellow-400 px-10 py-4 text-lg font-extrabold text-maroon-950 shadow-lg shadow-yellow-400/20"
          >
            Done and Return Home
          </button>
          <p className="mt-3 text-sm">Returns home automatically after 30 seconds.</p>
        </div>
      </KioskLayout>
    );
  }

  const toggleFlag = (flag) => { setRedFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current.filter((item) => item !== 'none'), flag]); answered('flags'); };
  // "Others" is not a backend red flag; it opens the notes field so the student can describe it.
  const toggleOther = () => {
    if (!hasOther) {
      setHasOther(true);
      setEditingOther(true);
    } else if (editingOther) {
      setNotes('');
      setHasOther(false);
      setEditingOther(false);
    } else {
      setEditingOther(true);
    }
    answered('other');
    answered('flags');
  };

  const submit = async (event) => {
    event.preventDefault();
    // Check every question at once, mark each skipped one in red, and name them in the pop-up.
    const skipped = triage ? [
      ['symptoms', !chiefComplaint.trim(), 'Symptoms'],
      ['duration', !duration, 'Duration'],
      ['pain', painLevel === null, 'Pain Level'],
      ['flags', !redFlags.length && !hasOther, 'Warning Signs'],
      ['other', hasOther && !notes.trim(), 'Others (please describe)'],
    ].filter(([, isMissing]) => isMissing) : [];
    if (skipped.length) {
      setMissing(Object.fromEntries(skipped.map(([key]) => [key, true])));
      setError('Please answer first: ' + skipped.map(([, , label]) => label).join(', ') + '.');
      document.getElementById('kiosk-confirm-' + skipped[0][0])?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setMissing({});
    setLoading(true); setError('');
    try {
      if (demoMode) {
        const isHigh = triage && (redFlags.length > 0 || hasOther || (painLevel !== null && painLevel >= 7));
        const isMedium = triage && !isHigh && painLevel !== null && painLevel >= 4;
        const priority = isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW';
        onCheckedIn({
          id: 'demo-checkin',
          queue_number: isHigh ? 'P-001' : 'R-001',
          queue_type: isHigh ? 'priority' : 'regular',
          priority,
          status: 'waiting',
        });
        return;
      }

      const response = await api.post('/kiosk/checkin', {
          ...data.identity,
          student_id: user.student_id,
          // Other services send no triage: the server uses the portal reason and the regular queue.
          ...(triage ? {
            chief_complaint: chiefComplaint.trim(),
            symptom_duration: duration,
            pain_level: painLevel,
            red_flags: redFlags.length ? redFlags : ['none'],
            notes: notes.trim() || undefined,
          } : {}),
      });
      onCheckedIn(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed. Please try again.');
    } finally { setLoading(false); }
  };

  return <KioskLayout><form onSubmit={submit} noValidate className="w-full max-w-lg mx-auto space-y-4 pb-10 text-white">
    <button type="button" onClick={onBack} className="p-3 bg-white/5 rounded-[15px]"><ArrowLeft className="w-5 h-5 text-white/70" /></button>
    <div>
      <h1 className="text-2xl font-bold">Confirm Today&apos;s Appointment</h1>
      <p className="mt-1 text-sm text-white/60">{triage ? 'Review your appointment, then tell us how you are feeling.' : 'Review your appointment, then check in.'}</p>
    </div>
    <h2 className={SECTION_TITLE}>Appointment Details</h2>
    <dl className="divide-y divide-white/10 rounded-[15px] border border-white/10 bg-white/5 px-4 text-sm">
      {[
        ['Name', `${user.first_name} ${user.last_name}`],
        ['Service', appointment?.service === 'Consultation' ? 'General Consultation' : appointment?.service],
        ['Appointment date', formatAppointmentDate(appointment?.appointment_date)],
        ['Appointment time', appointment?.time_slot],
        ['Check-in time', checkinOpensAt && checkinDeadlineAt ? `${checkinOpensAt} to ${checkinDeadlineAt}` : null],
      ].filter(([, value]) => value).map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-white/60">{label}</dt>
          <dd className="text-right font-semibold text-white">{value}</dd>
        </div>
      ))}
    </dl>
    {!triage && <>
    <h2 className={SECTION_TITLE}>Reason for Visit</h2>
    <p className="rounded-[15px] border border-white/10 bg-white/5 p-3 text-sm text-white/80">{appointment?.concern || appointment?.service}</p>
    <p className="text-xs text-white/60">No health check needed. You will get a Regular queue number.</p>
    </>}
    {triage && <>
    <h2 className={SECTION_TITLE}>Symptoms</h2>
    <div id="kiosk-confirm-symptoms" ref={symptomsRef}>
      <p className="mb-3 text-sm text-white/70">What are your symptoms? *</p>
      <button
        type="button"
        aria-pressed={editingSymptoms}
        aria-expanded={editingSymptoms}
        aria-controls="kiosk-confirm-symptoms-text"
        onClick={() => setEditingSymptoms((open) => !open)}
        className={
          CHOICE +
          ' flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ' +
          (editingSymptoms
            ? CHOICE_ON + ' rounded-b-none'
            : CHOICE_OFF + (missing.symptoms ? ' border-red-400 ring-2 ring-red-400' : ''))
        }
      >
        <span className="truncate">
          {chiefComplaint.trim() || 'Describe your symptoms'}
        </span>
        <span className={'shrink-0 text-xs font-semibold ' + (editingSymptoms ? 'text-maroon-950/75' : 'text-white/60')}>
          {editingSymptoms ? 'Tap to close' : chiefComplaint.trim() ? 'Tap to edit' : 'Tap to type'}
        </span>
      </button>
      {editingSymptoms && (
        <div className={'rounded-b-[15px] border border-t-0 bg-white/5 p-3 ' + (missing.symptoms ? 'border-red-400' : 'border-yellow-400')}>
          <textarea
            id="kiosk-confirm-symptoms-text"
            rows="3"
            autoFocus
            maxLength={500}
            value={chiefComplaint}
            aria-label="What are your symptoms?"
            aria-invalid={Boolean(missing.symptoms)}
            onChange={(e) => { setChiefComplaint(e.target.value); answered('symptoms'); }}
            placeholder="Example: headache and fever"
            className={'w-full rounded-[15px] border bg-white/5 p-3 text-white placeholder:text-white/40 ' + (missing.symptoms ? 'border-red-400 ring-1 ring-red-400' : 'border-white/10')}
          />
        </div>
      )}
      <MissingNote show={missing.symptoms}>Please describe your symptoms.</MissingNote>
    </div>
    <h2 className={SECTION_TITLE}>Duration</h2>
    <fieldset id="kiosk-confirm-duration">
      <legend className="mb-3 text-sm text-white/70">How long have you had these symptoms? *</legend>
      <div role="radiogroup" aria-label="Symptom duration" className={'grid grid-cols-2 gap-2' + missingFrame(missing.duration)}>
        {SYMPTOM_DURATIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={duration === option}
            onClick={() => { setDuration(duration === option ? null : option); answered('duration'); }}
            className={CHOICE + ' px-3 ' + (duration === option ? CHOICE_ON : CHOICE_OFF)}
          >
            {option.replace('-', '–')}
          </button>
        ))}
      </div>
      <MissingNote show={missing.duration}>Please choose how long you have had these symptoms.</MissingNote>
    </fieldset>
    <h2 className={SECTION_TITLE}>Pain Level</h2>
    <fieldset id="kiosk-confirm-pain">
      <legend className="mb-1 text-sm text-white/70">Rate your pain *</legend>
      <p className="mb-3 text-sm text-white/70">1 means very mild, 10 means the worst pain you can imagine.</p>
      <div role="radiogroup" aria-label="Pain from 1 to 10" className={'grid grid-cols-5 gap-2 sm:grid-cols-10' + missingFrame(missing.pain)}>
        {PAIN_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={painLevel === level}
            onClick={() => { setPainLevel(painLevel === level ? null : level); answered('pain'); }}
            className={CHOICE + ' text-lg ' + (painLevel === level ? CHOICE_ON : CHOICE_OFF)}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-xs text-white/70" aria-hidden="true"><span>Very mild</span><span>Worst pain</span></div>
      <MissingNote show={missing.pain}>Please rate your pain from 1 to 10.</MissingNote>
      <p className="mt-2 min-h-5 text-sm font-semibold text-yellow-300" aria-live="polite">{painLevel === null ? '' : painLevel + ' / 10 · ' + painBand(painLevel) + ' pain'}</p>
    </fieldset>
    <h2 className={SECTION_TITLE}>Warning Signs</h2>
    <fieldset id="kiosk-confirm-flags">
      <legend className="mb-3 text-sm text-white/70">Do you have any of these? Tap all that apply. *</legend>
      <div className={'grid gap-2 sm:grid-cols-2' + missingFrame(missing.flags)}>
        {FLAGS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={redFlags.includes(value)}
            onClick={() => toggleFlag(value)}
            className={CHOICE + ' px-3 py-2 text-left text-sm ' + (redFlags.includes(value) ? CHOICE_ON : CHOICE_OFF)}
          >
            {label}
          </button>
        ))}
        {/* Others is not on the list: tapping it opens a box right under it to type the concern. */}
        <div id="kiosk-confirm-other" ref={otherRef} className="sm:col-span-2">
          <button
            type="button"
            aria-pressed={hasOther}
            aria-expanded={editingOther}
            aria-controls="kiosk-confirm-other-text"
            onClick={toggleOther}
            className={
              CHOICE +
              ' flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ' +
              (hasOther ? CHOICE_ON + (editingOther ? ' rounded-b-none' : '') : CHOICE_OFF)
            }
          >
            <span className="truncate">{notes.trim() || 'Others'}</span>
            <span className={'shrink-0 text-xs font-semibold ' + (hasOther ? 'text-maroon-950/75' : 'text-white/60')}>
              {editingOther ? 'Tap to remove' : hasOther ? 'Tap to edit' : 'Tap to type'}
            </span>
          </button>
          {hasOther && editingOther && (
            <div className={'rounded-b-[15px] border border-t-0 bg-white/5 p-3 ' + (missing.other ? 'border-red-400' : 'border-yellow-400')}>
              <textarea
                id="kiosk-confirm-other-text" rows="2" autoFocus maxLength={1000} value={notes}
                aria-label="Describe your other concern" aria-invalid={Boolean(missing.other)}
                onChange={(e) => { setNotes(e.target.value); answered('other'); }}
                placeholder="Type your other concern here"
                className={'w-full rounded-[15px] border bg-white/5 p-3 text-white placeholder:text-white/40 ' + (missing.other ? 'border-red-400 ring-1 ring-red-400' : 'border-white/10')}
              />
              <MissingNote show={missing.other}>Please describe your other concern.</MissingNote>
            </div>
          )}
          {hasOther && !editingOther && (
            <MissingNote show={missing.other}>Please describe your other concern.</MissingNote>
          )}
        </div>
      </div>
      <MissingNote show={missing.flags}>Please choose a warning sign.</MissingNote>
    </fieldset>
    </>}
    <div className="pt-2 flex justify-center">
      <button
        type="submit"
        disabled={loading}
        className="inline-flex min-h-16 w-full sm:w-auto min-w-[240px] cursor-pointer items-center justify-center rounded-[15px] bg-yellow-400 px-10 py-4 text-lg font-extrabold text-maroon-950 shadow-lg shadow-yellow-400/20 disabled:cursor-wait"
      >
        Confirm and Check In
      </button>
    </div>
  </form>
  <KioskErrorModal open={Boolean(error)} title="Check-In Notice" message={error} onClose={() => setError('')} />
  </KioskLayout>;
};

export default KioskConfirm;
