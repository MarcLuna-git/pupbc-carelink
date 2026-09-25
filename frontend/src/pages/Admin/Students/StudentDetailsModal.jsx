import { useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import ClinicHistoryList from '../../../components/ClinicHistoryList';
import { Avatar, StatusBadge } from './StudentDirectory';
import { academic, fullName, focus, inputStyle, primary, secondary } from './directoryOptions';

function Modal({ title, children, onClose, topmost = true, wide = false }) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!topmost) return;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const elements = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter(element => element.getClientRects().length);
      const first = elements[0]; const last = elements.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', handleKey); if (previous?.isConnected) previous.focus(); };
  }, [topmost]);
  return <div className={`fixed inset-0 overflow-y-auto bg-gray-950/60 p-3 sm:p-6 ${wide ? 'z-50' : 'z-[60]'}`}><div ref={ref} tabIndex={-1} role="dialog" aria-modal={topmost ? 'true' : undefined} aria-label={title} inert={!topmost ? true : undefined} className={`mx-auto my-3 overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`}>{children}</div></div>;
}
const label = key => ({ bp: 'Blood pressure', hr: 'Heart rate', rr: 'Respiratory rate', temp: 'Temperature', o2_sat: 'Oxygen saturation' }[key] || key.replaceAll('_', ' '));
function Value({ value }) {
  if (value === null || value === undefined || value === '') return <span className="text-gray-400">Not provided</span>;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item)).join(', ') : 'None reported';
  if (typeof value === 'object') return <DetailGrid data={value} />;
  return String(value);
}
function DetailGrid({ data }) {
  return <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(data).map(([key, value]) => <div key={key} className="min-w-0"><dt className="mb-1 text-xs capitalize text-gray-500 dark:text-gray-400">{label(key)}</dt><dd className="whitespace-pre-wrap break-words text-sm"><Value value={value} /></dd></div>)}</dl>;
}
function Group({ title, children }) { return <section className="space-y-4"><h3 className="border-b border-gray-100 pb-3 text-sm font-semibold dark:border-gray-700">{title}</h3>{children}</section>; }
function Overview({ student }) {
  const profile = student.student_profile || {};
  return <div className="space-y-8"><Group title="Personal information"><DetailGrid data={{ first_name: student.first_name, middle_name: student.middle_name, last_name: student.last_name, student_id: student.student_id, course: academic(student, 'course'), year_level: academic(student, 'year'), section: academic(student, 'section'), birthday: (profile.birthday || student.birthday)?.slice(0, 10), gender: profile.gender || student.gender, mobile_number: profile.mobile_number || student.mobile_number, email: student.email, address: profile.address }} /></Group><Group title="Emergency contact"><DetailGrid data={{ guardian_name: profile.guardian_name, relationship: profile.guardian_relationship, contact_number: profile.guardian_contact }} /></Group></div>;
}
const healthGroups = [
  ['Medical history', ['medical_history', 'allergy_details', 'other_medical_history', 'medications', 'family_history']],
  ['Hospitalization, surgery & COVID history', ['hospitalized', 'hospitalization_date', 'hospitalization_diagnosis', 'surgery', 'surgery_date', 'surgery_diagnosis', 'had_covid', 'covid_date', 'covid_diagnosis']],
  ['Lifestyle & accessibility', ['occupation', 'marital_status', 'tobacco_use', 'tobacco_amount', 'tobacco_duration', 'alcohol_use', 'other_substance_use', 'has_disability', 'disability_details']],
  ['Reproductive history', ['last_menstrual_period', 'has_children', 'number_of_children', 'age_first_pregnancy', 'gravidity', 'term', 'premature', 'abortion', 'living_children']],
  ['Emergency contact', ['emergency_name', 'emergency_relationship', 'emergency_phone']],
  ['Consent', ['consent_signature', 'agree_privacy', 'agree_terms', 'consent_date', 'completed_at']],
];
function Health({ profile }) {
  if (!profile) return <p className="py-8 text-center text-sm text-gray-500">Health profile not yet submitted.</p>;
  const known = new Set(['id', 'user_id', 'created_at', 'updated_at', 'deleted_at', ...healthGroups.flatMap(([, keys]) => keys)]);
  const extra = Object.fromEntries(Object.entries(profile).filter(([key]) => !known.has(key)));
  return <div className="space-y-8">{healthGroups.map(([title, fields]) => <Group key={title} title={title}><DetailGrid data={Object.fromEntries(fields.map(key => [key, profile[key]]))} /></Group>)}{Object.keys(extra).length > 0 && <Group title="Additional information"><DetailGrid data={extra} /></Group>}</div>;
}
const tabs = ['Overview', 'Health', 'Appointments', 'Clinic History', 'Consultations', 'Emergencies'];
export function StudentDetailsModal({ student, loading, error, appointments, history, tab, onTab, onClose, onEmergency, emergencyOpen, onArchive, onRestore, statusSaving }) {
  return <Modal wide title="Student record" onClose={onClose} topmost={!emergencyOpen}>
    <header className="border-b border-gray-200 p-5 sm:p-6 dark:border-gray-700"><div className="flex items-start gap-3">{student && <Avatar student={student} />}<div className="min-w-0 flex-1"><p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500">Student record</p><h2 className="text-xl font-semibold">{student ? fullName(student) : 'Loading student record…'}</h2>{student && <><p className="mt-1 text-sm text-gray-500">{student.student_id}</p><p className="mt-2 text-sm">{[academic(student, 'course'), academic(student, 'year'), academic(student, 'section') && `Section ${academic(student, 'section')}`].filter(Boolean).join(' · ')}</p><div className="mt-3"><StatusBadge status={student.status} /></div></>}</div><button onClick={onClose} aria-label="Close student record" className={`rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button></div></header>
    {error && <p role="alert" className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="animate-pulse p-8 text-sm text-gray-500">Loading record…</p> : student && <>
      <div role="tablist" aria-label="Student record sections" className="flex overflow-x-auto border-b border-gray-200 px-5 dark:border-gray-700">{tabs.map(name => <button key={name} id={`student-tab-${name.replaceAll(' ', '-')}`} role="tab" aria-selected={tab === name} aria-controls="student-tabpanel" tabIndex={tab === name ? 0 : -1} onClick={() => onTab(name)} onKeyDown={event => { const index = tabs.indexOf(name); const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null; if (next !== null) { event.preventDefault(); onTab(tabs[next]); event.currentTarget.parentElement.children[next].focus(); } }} className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium ${focus} ${tab === name ? 'border-maroon-800 text-maroon-800 dark:border-maroon-300 dark:text-maroon-300' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}>{name}</button>)}</div>
      <div id="student-tabpanel" role="tabpanel" aria-labelledby={`student-tab-${tab.replaceAll(' ', '-')}`} tabIndex={0} className={`min-h-48 p-5 sm:p-6 ${focus}`}>
        {tab === 'Overview' && <Overview student={student} />}
        {tab === 'Health' && <Health profile={student.health_profile} />}
        {tab === 'Appointments' && (appointments.length ? <div className="space-y-4">{appointments.map(visit => <article key={visit.id} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{visit.service || 'Appointment'}</h3><StatusBadge status={visit.status} /></div><DetailGrid data={{ appointment_date: visit.appointment_date?.slice(0, 10), time_slot: visit.time_slot, concern: visit.concern }} /></article>)}</div> : <p className="py-8 text-center text-sm text-gray-500">No appointments.</p>)}
        {['Clinic History', 'Consultations', 'Emergencies'].includes(tab) && <ClinicHistoryList records={history.filter(record => tab === 'Clinic History' || record.record_type === (tab === 'Consultations' ? 'consultation' : 'emergency'))} />}
      </div><footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30"><p className="text-xs text-gray-500">Clinic records and encounter history</p><div className="flex flex-wrap justify-end gap-2"><button onClick={onEmergency} className={primary}><Plus size={16} />Add Emergency Encounter</button>{student.status === 'archived' ? <button onClick={onRestore} disabled={statusSaving} className={secondary}>{statusSaving ? 'Restoring…' : 'Restore Student'}</button> : <button onClick={onArchive} disabled={statusSaving} className={secondary}>{statusSaving ? 'Archiving…' : 'Archive Student'}</button>}</div></footer>
    </>}
  </Modal>;
}
export function EmergencyModal({ emergency, onChange, onSubmit, onClose, saving, error }) {
  return <Modal title="Emergency encounter" onClose={() => { if (!saving) onClose(); }}><form onSubmit={onSubmit}><header className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700"><div><h2 className="text-lg font-semibold">Add Emergency Encounter</h2><p className="mt-1 text-sm text-gray-500">Record the care provided to this student.</p></div><button type="button" disabled={saving} aria-label="Close emergency encounter" onClick={onClose} className={`rounded-lg p-2 ${focus}`}><X size={20} /></button></header><div className="space-y-4 p-5">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="block text-sm font-medium">Incident date and time <span className="text-red-600">*</span><input required type="datetime-local" value={emergency.incident_datetime} onChange={e => onChange('incident_datetime', e.target.value)} className={`${inputStyle} mt-1.5`} /></label><div className="grid gap-4 sm:grid-cols-2">{['reason', 'symptoms', 'assessment', 'intervention', 'disposition', 'notes'].map(field => <label key={field} className="block text-sm font-medium capitalize">{field}{field === 'reason' && <span className="text-red-600"> *</span>}<textarea rows={3} required={field === 'reason'} value={emergency[field]} onChange={e => onChange(field, e.target.value)} className={`${inputStyle} mt-1.5 resize-y`} /></label>)}</div></div><footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" disabled={saving} onClick={onClose} className={secondary}>Cancel</button><button disabled={saving} className={primary}>{saving ? 'Saving…' : 'Save Encounter'}</button></footer></form></Modal>;
}
