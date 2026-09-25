import { useState, useEffect } from 'react';
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import api from '../../services/api';
import KioskLayout from '../../layouts/KioskLayout';

const FLAGS = [
  ['difficulty_breathing', 'Difficulty breathing'],
  ['severe_chest_pain', 'Severe chest pain'],
  ['heavy_uncontrolled_bleeding', 'Heavy or uncontrolled bleeding'],
  ['fainting', 'Fainting or loss of consciousness'],
  ['severe_allergic_reaction', 'Severe allergic reaction'],
  ['seizure', 'Seizure'],
  ['sudden_weakness_confusion', 'Sudden severe weakness or confusion'],
];

const KioskConfirm = ({ data, onCheckedIn, onBack, onDone }) => {
  const { user, appointment, has_active_checkin, active_checkin } = data;
  const [chiefComplaint, setChiefComplaint] = useState(appointment?.concern || '');
  const [severity, setSeverity] = useState('mild');
  const [redFlags, setRedFlags] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!has_active_checkin) return;
    const timer = setTimeout(onDone, 30000);
    return () => clearTimeout(timer);
  }, [has_active_checkin, onDone]);
  if (has_active_checkin && active_checkin) {
    return <KioskLayout><div className="text-center text-white"><CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" /><h1 className="text-2xl font-bold">Already Checked In</h1><p className="text-6xl font-black text-yellow-300 my-6">{active_checkin.queue_number}</p><p>Please wait for your number to be called.</p><button onClick={onDone} className="mt-6 bg-yellow-400 text-slate-900 rounded-xl px-6 py-3 font-bold">Done / Return Home</button><p className="mt-3 text-sm">Returns home automatically after 30 seconds.</p></div></KioskLayout>;
  }

  const toggleFlag = (flag) => setRedFlags((current) => current.includes(flag) ? current.filter((item) => item !== flag) : [...current.filter((item) => item !== 'none'), flag]);

  const submit = async (event) => {
    event.preventDefault();
    if (!chiefComplaint.trim()) { setError('Please describe your reason for visit.'); return; }
    setLoading(true); setError('');
    try {
      const response = await api.post('/kiosk/checkin', {
        ...data.identity,
        student_id: user.student_id,
        chief_complaint: chiefComplaint.trim(),
        severity,
        red_flags: redFlags.length ? redFlags : ['none'],
        notes: notes.trim() || undefined,
      });
      onCheckedIn(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Check-in failed. Please try again.');
    } finally { setLoading(false); }
  };

  return <KioskLayout><form onSubmit={submit} className="w-full max-w-lg mx-auto space-y-4 text-white">
    <button type="button" onClick={onBack} className="p-3 bg-white/5 rounded-2xl"><ArrowLeft className="w-5 h-5 text-white/60" /></button>
    <h1 className="text-2xl font-bold">Confirm Today&apos;s Appointment</h1>
    <div className="rounded-2xl border border-green-400/20 bg-green-500/5 p-4">
      <p className="font-semibold">{user.first_name} {user.last_name}</p>
      <p className="text-sm text-white/60">{appointment?.appointment_date} · {appointment?.time_slot}</p>
      <p className="text-sm text-green-300 mt-2">{appointment?.service}</p>
    </div>
    <label className="block text-sm text-white/70">Chief complaint or reason *
      <textarea required rows="3" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white" />
    </label>
    <label className="block text-sm text-white/70">Severity
      <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="mt-2 w-full rounded-xl bg-slate-900 border border-white/10 p-3 text-white">
        <option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option><option value="critical">Critical</option>
      </select>
    </label>
    <fieldset><legend className="text-sm text-white/70 mb-2">Red flags (select any that apply)</legend><div className="grid gap-2">{FLAGS.map(([value, label]) => <label key={value} className="flex gap-2 items-center text-sm text-white/70"><input type="checkbox" checked={redFlags.includes(value)} onChange={() => toggleFlag(value)} />{label}</label>)}</div></fieldset>
    <label className="block text-sm text-white/70">Additional notes
      <textarea rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-2 w-full rounded-xl bg-white/5 border border-white/10 p-3 text-white" />
    </label>
    {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <button disabled={loading} className="w-full rounded-xl bg-yellow-400 py-3 font-bold text-slate-900 disabled:opacity-50">{loading ? <Loader2 className="mx-auto animate-spin" /> : 'Confirm and Check In'}</button>
  </form></KioskLayout>;
};

export default KioskConfirm;
