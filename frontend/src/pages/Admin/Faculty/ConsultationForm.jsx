import { useState } from 'react';
import { Loader2, Stethoscope, X } from 'lucide-react';
import api from '../../../services/api';
import { Modal } from '../Students/StudentDetailsModal';
import { focus } from '../Students/directoryOptions';
import { bloodPressureOnly, decimalOnly, digitsOnly } from '../../../utils/inputFilters';

/*
 * A clinic consultation for a faculty member: the complaint, optional vital signs, what the nurse
 * found and did. The same form is the "Consultation" tab (the faculty member is chosen) and the
 * popup from a faculty member's details.
 */
const field = 'h-11 w-full rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 disabled:bg-gray-50 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30 dark:disabled:bg-gray-800';
const area = `${field} h-auto resize-none py-2.5`;
const Label = ({ children, required }) => <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{children}{required && <span className="ml-0.5 text-red-600" aria-hidden="true">*</span>}</span>;
const blank = { chief_complaint: '', blood_pressure: '', temperature: '', pulse_rate: '', assessment: '', intervention: '', notes: '' };

export default function ConsultationForm({ faculty = null, facultyOptions = [], onDone, onCancel }) {
  const [facultyId, setFacultyId] = useState(faculty?.id || '');
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const VITAL_FILTERS = { blood_pressure: bloodPressureOnly, temperature: v => decimalOnly(v, 2, 1), pulse_rate: v => digitsOnly(v, 3) };
  const set = key => event => {
    const value = VITAL_FILTERS[key] ? VITAL_FILTERS[key](event.target.value) : event.target.value;
    setForm(current => ({ ...current, [key]: value })); setError('');
  };
  const valid = facultyId && form.chief_complaint.trim();

  const submit = async event => {
    event.preventDefault();
    if (!valid || saving) return;
    setSaving(true); setError('');
    const body = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null]));
    try {
      const { data } = await api.post(`/nurse/faculty/${facultyId}/consultations`, body);
      onDone(data.message);
    } catch (err) {
      setError((err.response?.data?.errors && Object.values(err.response.data.errors).flat()[0]) || err.response?.data?.message || 'Unable to save the consultation.');
      setSaving(false);
    }
  };

  return <form onSubmit={submit} aria-busy={saving} className="space-y-4">
    <label className="block"><Label required>Faculty Member</Label>
      {faculty
        ? <input className={field} value={faculty.full_name} readOnly disabled />
        : <select className={`${field} cursor-pointer`} value={facultyId} onChange={event => { setFacultyId(event.target.value); setError(''); }} required>
          <option value="">Select faculty member</option>
          {facultyOptions.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
        </select>}
    </label>
    <label className="block"><Label required>Chief Complaint</Label>
      <textarea className={area} rows={2} maxLength={500} value={form.chief_complaint} onChange={set('chief_complaint')} placeholder="e.g. Headache since this morning" required />
    </label>
    <div className="grid gap-3 sm:grid-cols-3">
      <label><Label>Blood Pressure</Label><input className={field} value={form.blood_pressure} onChange={set('blood_pressure')} placeholder="120/80" maxLength={7} inputMode="numeric" /></label>
      <label><Label>Temperature (°C)</Label><input className={field} inputMode="decimal" maxLength={4} value={form.temperature} onChange={set('temperature')} placeholder="36.5" /></label>
      <label><Label>Pulse Rate (bpm)</Label><input className={field} inputMode="numeric" maxLength={3} value={form.pulse_rate} onChange={set('pulse_rate')} placeholder="80" /></label>
    </div>
    <label className="block"><Label>Assessment / Findings</Label>
      <textarea className={area} rows={2} maxLength={2000} value={form.assessment} onChange={set('assessment')} placeholder="What you found" />
    </label>
    <label className="block"><Label>Intervention / Treatment</Label>
      <textarea className={area} rows={2} maxLength={2000} value={form.intervention} onChange={set('intervention')} placeholder="What was done or advised" />
    </label>
    <label className="block"><Label>Notes <span className="font-normal text-gray-400">(optional)</span></Label>
      <textarea className={area} rows={2} maxLength={2000} value={form.notes} onChange={set('notes')} />
    </label>
    {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
    <div className="flex justify-end gap-3 pt-1">
      {onCancel && <button type="button" onClick={onCancel} disabled={saving} className={`inline-flex h-10 items-center rounded-[10px] border border-gray-300 bg-white px-5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700 ${focus}`}>Cancel</button>}
      <button type="submit" disabled={!valid || saving} className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-maroon-800 px-6 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}>
        {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Stethoscope size={16} aria-hidden="true" />}{saving ? 'Saving…' : 'Save Consultation'}
      </button>
    </div>
  </form>;
}

// The popup from a faculty member's details: the faculty member is fixed.
export function ConsultationModal({ faculty, onClose, onDone }) {
  return <Modal title="Record consultation" onClose={onClose}>
    <header className="flex items-center gap-3 px-5 pb-1 pt-5 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Stethoscope size={18} aria-hidden="true" /></span>
      <h2 className="min-w-0 flex-1 text-lg font-bold">Record Consultation</h2>
      <button type="button" onClick={onClose} aria-label="Close" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={18} /></button>
    </header>
    <div className="px-5 pb-5 pt-3 sm:px-6"><ConsultationForm faculty={faculty} onDone={onDone} onCancel={onClose} /></div>
  </Modal>;
}
