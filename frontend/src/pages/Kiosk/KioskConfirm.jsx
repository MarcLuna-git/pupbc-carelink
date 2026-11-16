import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, CheckCircle, Loader2, Clock, Info } from 'lucide-react';
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
  ['sudden_weakness_confusion', 'Sudden severe weakness or confusion'],
];


// Section subtitle shown above each part of the confirm form.
const SECTION_TITLE = 'border-t border-white/10 pt-4 text-xs font-semibold uppercase tracking-wider text-yellow-300';

const KioskConfirm = ({ data, onCheckedIn, onBack, onDone }) => {
  const { user, appointment, has_active_checkin, active_checkin } = data;
  const [chiefComplaint, setChiefComplaint] = useState(appointment?.concern || '');
  // Only General Consultation is triaged here. Other services were explained in the portal
  // and go straight to the regular queue.
  const triage = needsTriage(appointment?.service);
  const [duration, setDuration] = useState(null);
  const [painLevel, setPainLevel] = useState(null);
  const [redFlags, setRedFlags] = useState([]);
  const [hasOther, setHasOther] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    return <KioskLayout><div className="text-center text-white"><CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" /><h1 className="text-2xl font-bold">Already Checked In</h1><p className="text-6xl font-black text-yellow-300 my-6">{active_checkin.queue_number}</p><p>Please wait for your number to be called.</p><button onClick={onDone} className="mt-6 bg-yellow-400 text-slate-900 rounded-[10px] px-6 py-3 font-bold">Done / Return Home</button><p className="mt-3 text-sm">Returns home automatically after 30 seconds.</p></div></KioskLayout>;
  }

  const toggleFlag = (flag) => setRedFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current.filter((item) => item !== 'none'), flag]);
  // "Others" is not a backend red flag; it opens the notes field so the student can describe it.
  const toggleOther = () => { if (hasOther) setNotes(''); setHasOther(!hasOther); setError(''); };

  const submit = async (event) => {
    event.preventDefault();
    if (triage && !chiefComplaint.trim()) { setError('Please describe your symptoms.'); return; }
    if (triage && !duration) { setError('Please tell us how long you have had these symptoms.'); return; }
    if (triage && painLevel === null) { setError('Please rate your pain from 1 to 10.'); return; }
    if (triage && hasOther && !notes.trim()) { setError('Please describe your other concern.'); return; }
    setLoading(true); setError('');
    try {
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

  return <KioskLayout><form onSubmit={submit} className="w-full max-w-lg mx-auto space-y-4 pb-10 text-white">
    <button type="button" onClick={onBack} className="p-3 bg-white/5 rounded-[10px]"><ArrowLeft className="w-5 h-5 text-white/70" /></button>
    <div>
      <h1 className="text-2xl font-bold">Confirm Today&apos;s Appointment</h1>
      <p className="mt-1 text-sm text-white/60">{triage ? 'Review your appointment, then tell us how you are feeling.' : 'Review your appointment, then check in.'}</p>
    </div>
    <h2 className={SECTION_TITLE}>Appointment Details</h2>
    <div className="rounded-[10px] border border-green-400/20 bg-green-500/5 p-4">
      <p className="font-semibold">{user.first_name} {user.last_name}</p>
      <p className="text-sm text-white/70">{formatAppointmentDate(appointment?.appointment_date)} · {appointment?.time_slot}</p>
      <p className="text-sm text-green-300 mt-2">{appointment?.service === 'Consultation' ? 'General Consultation' : appointment?.service}</p>
      {checkinOpensAt && checkinDeadlineAt && (
        <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-1 bg-blue-500/20 border border-blue-500/30 rounded-[10px] px-2 py-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span className="text-blue-300">Check-in opens: {checkinOpensAt}</span>
          </div>
          <div className="flex items-center gap-1 bg-yellow-500/20 border border-yellow-500/30 rounded-[10px] px-2 py-1">
            <Clock className="w-3 h-3 text-yellow-400" />
            <span className="text-yellow-300">Deadline: {checkinDeadlineAt}</span>
          </div>
        </div>
      )}
    </div>
    {!triage && <>
    <h2 className={SECTION_TITLE}>Reason for Visit</h2>
    <p className="rounded-[10px] border border-white/10 bg-white/5 p-3 text-sm text-white/80">{appointment?.concern || appointment?.service}</p>
    <p className="text-xs text-white/60">No health check needed. You will get a Regular queue number.</p>
    </>}
    {triage && <>
    <h2 className={SECTION_TITLE}>Symptoms</h2>
    <label className="block text-sm text-white/70">What are your symptoms? *
      <textarea required rows="3" maxLength={500} value={chiefComplaint} onChange={(e) => { setChiefComplaint(e.target.value); setError(''); }} placeholder="Example: headache and fever" className="mt-2 w-full rounded-[10px] bg-white/5 border border-white/10 p-3 text-white placeholder:text-white/40" />
    </label>
    <h2 className={SECTION_TITLE}>Duration</h2>
    <fieldset>
      <legend className="mb-3 text-sm text-white/70">How long have you had these symptoms? *</legend>
      <div role="radiogroup" aria-label="Symptom duration" className="grid grid-cols-2 gap-2">
        {SYMPTOM_DURATIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={duration === option}
            onClick={() => { setDuration(option); setError(''); }}
            className={'min-h-12 cursor-pointer rounded-[10px] border px-3 font-bold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ' + (duration === option ? 'border-yellow-400 bg-yellow-400 text-maroon-950' : 'border-white/30 bg-white/5 text-white hover:bg-white/15')}
          >
            {option.replace('-', '–')}
          </button>
        ))}
      </div>
    </fieldset>
    <h2 className={SECTION_TITLE}>Pain Level</h2>
    <fieldset>
      <legend className="mb-1 text-sm text-white/70">Rate your pain *</legend>
      <p className="mb-3 text-sm text-white/70">1 means very mild, 10 means the worst pain you can imagine.</p>
      <div role="radiogroup" aria-label="Pain from 1 to 10" className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {PAIN_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={painLevel === level}
            onClick={() => { setPainLevel(level); setError(''); }}
            className={'min-h-12 cursor-pointer rounded-[10px] border text-lg font-bold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ' + (painLevel === level ? 'border-yellow-400 bg-yellow-400 text-maroon-950' : 'border-white/30 bg-white/5 text-white hover:bg-white/15')}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-white/70" aria-hidden="true"><span>Very mild</span><span>Worst pain</span></div>
      <p className="mt-2 min-h-5 text-sm font-semibold text-yellow-300" aria-live="polite">{painLevel === null ? '' : painLevel + ' / 10 · ' + painBand(painLevel) + ' pain'}</p>
    </fieldset>
    <h2 className={SECTION_TITLE}>Warning Signs</h2>
    <fieldset><legend className="text-sm text-white/70 mb-2">Red flags (select any that apply)</legend><div className="grid gap-2">{FLAGS.map(([value, label]) => <label key={value} className="flex gap-2 items-center text-sm text-white/70"><input type="checkbox" checked={redFlags.includes(value)} onChange={() => toggleFlag(value)} />{label}</label>)}
      <label className="flex gap-2 items-center text-sm text-white/70"><input type="checkbox" checked={hasOther} onChange={toggleOther} />Others</label>
      {hasOther && <label className="block text-sm text-white/70">Please describe
        <textarea rows="2" autoFocus maxLength={1000} value={notes} onChange={(e) => { setNotes(e.target.value); setError(''); }} placeholder="Describe your other concern" className="mt-2 w-full rounded-[10px] bg-white/5 border border-white/10 p-3 text-white placeholder:text-white/40" />
      </label>}
    </div></fieldset>
    </>}
    <div className="pt-2 flex justify-center">
      <button disabled={loading} className="w-full sm:w-auto rounded-[10px] bg-yellow-400 px-8 py-3 font-bold text-slate-900 transition-colors hover:bg-yellow-300 disabled:opacity-50">{loading ? <Loader2 className="mx-auto animate-spin" /> : 'Confirm and Check In'}</button>
    </div>
  </form>
  <KioskErrorModal open={Boolean(error)} title="Check-In Notice" message={error} onClose={() => setError('')} />
  </KioskLayout>;
};

export default KioskConfirm;
