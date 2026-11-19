import { useEffect, useRef, useState } from 'react';
import { X, Plus, Printer } from 'lucide-react';
import ClinicRecordList from '../../../components/ClinicRecordList';
import StudentDocuments from './StudentDocuments';
import { getUser } from '../../../services/session';
import { openRecordDocument, studentDetails } from '../../Student/HealthRecords/recordDocuments';
import { Avatar, StatusBadge } from './StudentDirectory';
import { academic, fullName, focus, inputStyle, primary, secondary } from './directoryOptions';

// `contained`: a popup of fixed height, centered on the screen. The header, tabs and footer stay
// put and only the body scrolls (see StudentDetailsModal), so the popup never grows past the screen.
export function Modal({ title, children, onClose, topmost = true, wide = false, contained = false }) {
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
  const layer = contained ? 'flex items-center justify-center' : 'overflow-y-auto';
  const size = contained ? 'flex h-[min(46rem,calc(100dvh-2rem))] w-full max-w-4xl flex-col' : `mx-auto my-3 ${wide ? 'max-w-5xl' : 'max-w-2xl'}`;
  return <div className={`fixed inset-0 bg-gray-950/60 p-3 sm:p-6 ${layer} ${wide ? 'z-50' : 'z-[60]'}`}><div ref={ref} tabIndex={-1} role="dialog" aria-modal={topmost ? 'true' : undefined} aria-label={title} inert={!topmost ? true : undefined} className={`overflow-hidden rounded-[10px] border border-gray-200 bg-white text-gray-900 shadow-xl outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 ${size}`}>{children}</div></div>;
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
// One emergency contact: the health profile's when it has one, otherwise the older guardian fields.
function emergencyContactOf(student) {
  const profile = student.student_profile || {};
  const health = student.health_profile;
  const useHealth = ['emergency_name', 'emergency_relationship', 'emergency_phone'].some(field => String(health?.[field] ?? '').trim());
  const contact = useHealth
    ? { full_name: health.emergency_name, relationship: health.emergency_relationship, phone_number: health.emergency_phone }
    : { full_name: profile.guardian_name, relationship: profile.guardian_relationship, phone_number: profile.guardian_contact };
  return Object.fromEntries(Object.entries(contact).map(([field, value]) => [field, String(value ?? '').trim() ? value : null]));
}
function Overview({ student }) {
  const profile = student.student_profile || {};
  const displayedContact = emergencyContactOf(student);
  return <div className="space-y-8"><Group title="Personal information"><DetailGrid data={{ first_name: student.first_name, middle_name: student.middle_name, last_name: student.last_name, student_id: student.student_id, course: academic(student, 'course'), year_level: academic(student, 'year'), section: academic(student, 'section'), birthday: (profile.birthday || student.birthday)?.slice(0, 10), gender: profile.gender || student.gender, mobile_number: profile.mobile_number || student.mobile_number, email: student.email, address: profile.address }} /></Group><Group title="Emergency contact"><DetailGrid data={displayedContact} /></Group></div>;
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
// Consultations and emergencies both live in Clinic History; Emergencies is the same list narrowed to emergency encounters.
const tabs = ['Overview', 'Health', 'Appointments', 'Clinic History', 'Emergencies', 'Documents'];

// The Student Health Profile, printed with the clinic's own template (public/templates/print/student-profile.html).
function printProfile(student) {
  const profile = student.student_profile || {};
  const contact = emergencyContactOf(student);
  const birthday = (profile.birthday || student.birthday)?.slice(0, 10);
  const details = studentDetails(student, {
    ...profile, birthday, address: profile.address,
    course: academic(student, 'course'), year: academic(student, 'year'), section: academic(student, 'section'),
    mobile_number: profile.mobile_number || student.mobile_number,
  }, { name: contact.full_name, relationship: contact.relationship, phone: contact.phone_number });
  const nurse = getUser('nurse') || {};
  const record = {
    id: student.student_id,
    staff: `Nurse ${[nurse.first_name, nurse.last_name].filter(Boolean).join(' ')}`.trim(),
    staffRole: 'Clinic Nurse',
    profile: { birthday, sex: profile.gender || student.gender, email: student.email },
    health: student.health_profile,
  };
  return openRecordDocument('profile', record, 'print', details);
}

export function StudentDetailsModal({ student, loading, error, appointments, history, tab, onTab, onClose, onEmergency, emergencyOpen, archiveOpen, onArchive, onRestore, statusSaving }) {
  const [printNote, setPrintNote] = useState('');
  return <Modal contained wide title="Student record" onClose={onClose} topmost={!emergencyOpen && !archiveOpen}>
    <header className="shrink-0 border-b border-gray-200 px-5 py-4 sm:px-6 dark:border-gray-700"><div className="flex items-start gap-3">{student && <Avatar student={student} />}<div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><h2 className="text-xl font-semibold">{student ? fullName(student) : 'Loading student record…'}</h2>{student && <StatusBadge status={student.status} />}</div>{student && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{[student.student_id, academic(student, 'course'), academic(student, 'year'), academic(student, 'section') && `Section ${academic(student, 'section')}`].filter(Boolean).join(' · ')}</p>}</div><button onClick={onClose} aria-label="Close student record" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button></div></header>
    {error && <p role="alert" className="m-5 shrink-0 rounded-[10px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {loading ? <p role="status" className="animate-pulse p-8 text-sm text-gray-500">Loading record…</p> : student && <>
      <div role="tablist" aria-label="Student record sections" className="flex shrink-0 overflow-x-auto border-b border-gray-200 px-5 dark:border-gray-700">{tabs.map(name => <button key={name} id={`student-tab-${name.replaceAll(' ', '-')}`} role="tab" aria-selected={tab === name} aria-controls="student-tabpanel" tabIndex={tab === name ? 0 : -1} onClick={() => onTab(name)} onKeyDown={event => { const index = tabs.indexOf(name); const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null; if (next !== null) { event.preventDefault(); onTab(tabs[next]); event.currentTarget.parentElement.children[next].focus(); } }} className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium ${focus} ${tab === name ? 'border-maroon-800 text-maroon-800 dark:border-maroon-300 dark:text-maroon-300' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'}`}>{name}</button>)}</div>
      <div id="student-tabpanel" role="tabpanel" aria-labelledby={`student-tab-${tab.replaceAll(' ', '-')}`} tabIndex={0} className={`min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 ${focus}`}>
        {tab === 'Overview' && <Overview student={student} />}
        {tab === 'Health' && <Health profile={student.health_profile} />}
        {tab === 'Appointments' && (appointments.length ? <div className="space-y-4">{appointments.map(visit => <article key={visit.id} className="rounded-[10px] border border-gray-200 p-4 dark:border-gray-700"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{visit.service || 'Appointment'}</h3><StatusBadge status={visit.status} /></div><DetailGrid data={{ appointment_date: visit.appointment_date?.slice(0, 10), time_slot: visit.time_slot, concern: visit.concern }} /></article>)}</div> : <p className="py-8 text-center text-sm text-gray-500">No appointments.</p>)}
        {tab === 'Documents' && <StudentDocuments key={student.id} student={student} />}
        {['Clinic History', 'Emergencies'].includes(tab) && <ClinicRecordList key={tab} records={history.filter(record => tab === 'Clinic History' || record.record_type === 'emergency')} emptyText={tab === 'Emergencies' ? 'No emergency encounters recorded.' : 'No completed consultations or emergency encounters yet.'} />}
      </div><footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-900/30"><p role={printNote ? 'alert' : undefined} className={`text-xs ${printNote ? 'text-red-700 dark:text-red-300' : 'text-gray-500'}`}>{printNote || 'Clinic records and encounter history'}</p><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setPrintNote(printProfile(student) ? '' : 'Allow pop-ups to print the profile.')} className={secondary}><Printer size={16} aria-hidden="true" />Print profile</button><button onClick={onEmergency} className={primary}><Plus size={16} />Add Emergency Encounter</button>{student.status === 'archived' ? <button onClick={onRestore} disabled={statusSaving} className={secondary}>{statusSaving ? 'Restoring…' : 'Restore Student'}</button> : <button onClick={onArchive} disabled={statusSaving} className={secondary}>{statusSaving ? 'Archiving…' : 'Archive Student'}</button>}</div></footer>
    </>}
  </Modal>;
}
// Delete for good: shows what will be removed, then asks for the admin password.
export function DeleteStudentModal({ student, password, error, onPasswordChange, onSubmit, onClose, saving }) {
  const close = () => { if (!saving) onClose(); };
  return <div onClick={event => { if (event.target === event.currentTarget.firstElementChild) close(); }}>
    <Modal title="Delete student" onClose={close}>
      <form onSubmit={onSubmit} aria-busy={saving} autoComplete="off">
        <header className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700"><h2 className="text-lg font-semibold">Delete Student</h2><button type="button" disabled={saving} aria-label="Close delete student" onClick={close} className={`rounded-[10px] p-2 ${focus}`}><X size={20} /></button></header>
        <div className="space-y-4 p-5 text-sm">
          <p>You are about to delete <span className="font-semibold">{fullName(student)}</span> ({student?.student_id || 'no Student ID'}).</p>
          <div className="rounded-[10px] border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
            <p className="font-semibold">This cannot be undone.</p>
            <p className="mt-1">All of this student's data will be deleted: account, profile, health profile, appointments, visits, consultations, certificates, QR code, notifications and uploaded files.</p>
          </div>
          <div>
            <label htmlFor="delete-admin-password" className="block font-medium">Admin password <span className="text-red-600">*</span></label>
            <input id="delete-admin-password" type="password" autoComplete="new-password" value={password} onChange={event => onPasswordChange(event.target.value)} disabled={saving} aria-invalid={Boolean(error)} aria-describedby={error ? 'delete-admin-password-error' : undefined} className={`${inputStyle} mt-1.5`} />
            {error && <p id="delete-admin-password-error" role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
          </div>
        </div>
        <footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" disabled={saving} onClick={close} className={secondary}>Cancel</button><button type="submit" disabled={saving || !password} className={`inline-flex items-center justify-center rounded-[10px] bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}>{saving ? 'Deleting…' : 'Delete Student'}</button></footer>
      </form>
    </Modal>
  </div>;
}
export function ArchiveStudentModal({ reason, reasonError, onReasonChange, onSubmit, onClose, saving }) {
  const close = () => { if (!saving) onClose(); };
  return <div onClick={event => { if (event.target === event.currentTarget.firstElementChild) close(); }}>
    <Modal title="Archive student" onClose={close}>
      <form onSubmit={onSubmit} aria-busy={saving}>
        <header className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700"><h2 className="text-lg font-semibold">Archive Student</h2><button type="button" disabled={saving} aria-label="Close archive student" onClick={close} className={`rounded-[10px] p-2 ${focus}`}><X size={20} /></button></header>
        <div className="p-5"><label htmlFor="archive-reason" className="block text-sm font-medium">Reason <span className="text-red-600">*</span></label><textarea id="archive-reason" rows={3} value={reason} onChange={event => onReasonChange(event.target.value)} disabled={saving} aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? 'archive-reason-error' : undefined} className={`${inputStyle} mt-1.5 resize-y`} />{reasonError && <p id="archive-reason-error" role="alert" className="mt-1 text-xs text-red-600">{reasonError}</p>}</div>
        <footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" disabled={saving} onClick={close} className={secondary}>Cancel</button><button type="submit" disabled={saving} className={primary}>{saving ? 'Archiving…' : 'Archive Student'}</button></footer>
      </form>
    </Modal>
  </div>;
}
export function EmergencyModal({ emergency, onChange, onSubmit, onClose, saving, error }) {
  return <Modal title="Emergency encounter" onClose={() => { if (!saving) onClose(); }}><form onSubmit={onSubmit}><header className="flex items-start justify-between border-b border-gray-200 p-5 dark:border-gray-700"><div><h2 className="text-lg font-semibold">Add Emergency Encounter</h2><p className="mt-1 text-sm text-gray-500">Record the care provided to this student.</p></div><button type="button" disabled={saving} aria-label="Close emergency encounter" onClick={onClose} className={`rounded-[10px] p-2 ${focus}`}><X size={20} /></button></header><div className="space-y-4 p-5">{error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700">{error}</p>}<label className="block text-sm font-medium">Incident date and time <span className="text-red-600">*</span><input required type="datetime-local" value={emergency.incident_datetime} onChange={e => onChange('incident_datetime', e.target.value)} className={`${inputStyle} mt-1.5`} /></label><div className="grid gap-4 sm:grid-cols-2">{['reason', 'symptoms', 'assessment', 'intervention', 'disposition', 'notes'].map(field => <label key={field} className="block text-sm font-medium capitalize">{field}{field === 'reason' && <span className="text-red-600"> *</span>}<textarea rows={3} required={field === 'reason'} value={emergency[field]} onChange={e => onChange(field, e.target.value)} className={`${inputStyle} mt-1.5 resize-y`} /></label>)}</div></div><footer className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" disabled={saving} onClick={onClose} className={secondary}>Cancel</button><button disabled={saving} className={primary}>{saving ? 'Saving…' : 'Save Encounter'}</button></footer></form></Modal>;
}
