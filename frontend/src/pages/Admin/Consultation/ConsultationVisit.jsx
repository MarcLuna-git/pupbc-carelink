import { useEffect, useState } from 'react';
import {
  ArrowLeft, Stethoscope, ClipboardPenLine, CalendarClock, MessageSquareText, ClipboardList, UserRound, Phone, Mail,
  Heart, FileBadge, Pill, Search, Save, Loader2, CheckCircle, ArrowRight, Printer, Eye, Activity, Plus, Trash2, XCircle, AlertTriangle, Thermometer, Wind, Gauge, HeartPulse, Droplets, Check,
} from 'lucide-react';
import api from '../../../services/api';
import { getUser } from '../../../services/session';
import { formatAppointmentDate } from '../../../utils/appointmentDate';
import { openRecordDocument } from '../../Student/HealthRecords/recordDocuments';

/*
 * One clinic visit, opened from the queue: who the student is, why they came,
 * then the consultation form, medical certificate and medicine dispensing tabs,
 * a review step, and the printable records once it is saved.
 */

const EMPTY_FORM = {
  chief_complaint: '', history_present_illness: '',
  bp: '', hr: '', rr: '', temp: '', o2_sat: '',
  nursing_assessment: '', nursing_interventions: '', treatment_plan: '',
  follow_up: false, follow_up_date: '', general_remarks: '',
  medical_certificate: false, medical_certificate_ref: '',
};
const TABS = [
  { key: 'form', label: 'Consultation Form', icon: ClipboardPenLine },
  { key: 'certificate', label: 'Medical Certificate', icon: FileBadge },
  { key: 'dispensing', label: 'Dispensing', icon: Pill },
  { key: 'review', label: 'Review & Confirm', icon: Eye },
];
const EMPTY_ITEM = { medicine: null, dose: '', duration: '', quantity: '1' };
const VITALS = [
  { name: 'bp', label: 'Blood Pressure', unit: 'mmHg', placeholder: '120/80' },
  { name: 'rr', label: 'Respiratory Rate', unit: '/min', placeholder: '16' },
  { name: 'temp', label: 'Temperature', unit: '°C', placeholder: '36.5' },
  { name: 'o2_sat', label: 'Oxygen Saturation', unit: '%', placeholder: '98' },
  { name: 'hr', label: 'Pulse Rate', unit: 'bpm', placeholder: '72' },
];
const VITAL_ICONS = { bp: Gauge, temp: Thermometer, hr: HeartPulse, rr: Wind, o2_sat: Droplets };
const TEXT_LIMIT = 500;
const draftKey = checkinId => `consultation-draft-${checkinId}`;

const ageFrom = birthday => {
  const born = birthday ? new Date(birthday) : null;
  if (!born || Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age -= 1;
  return age;
};
const capitalize = value => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');

const input = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const label = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';
const card = 'rounded-lg border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:p-5';
const btn = 'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50';
const primary = `${btn} bg-maroon-800 text-white hover:bg-maroon-900`;
const outline = `${btn} border border-maroon-200 bg-white text-maroon-800 hover:bg-maroon-50 dark:border-maroon-800/50 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20`;

const Counter = ({ value }) => <span className="mt-1 block text-right text-[11px] text-gray-400 tabular-nums">{value.length}/{TEXT_LIMIT}</span>;

const ConsultationVisit = ({ visit, onBack, onSaved, onConflict, notify }) => {
  const [tab, setTab] = useState('form');
  const [form, setForm] = useState(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey(visit.checkin_id)) || 'null');
      if (draft?.form) return { ...EMPTY_FORM, ...draft.form };
    } catch { /* no draft */ }
    return { ...EMPTY_FORM, chief_complaint: visit.complaint || '' };
  });
  // Prescribed medicines; stock is deducted for these only when the consultation is saved.
  const [prescribed, setPrescribed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey(visit.checkin_id)) || 'null')?.prescribed || []; } catch { return []; }
  });
  const [declined, setDeclined] = useState(() => {
    try { return Boolean(JSON.parse(localStorage.getItem(draftKey(visit.checkin_id)) || 'null')?.declined); } catch { return false; }
  });
  const [dispenseNotes, setDispenseNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem(draftKey(visit.checkin_id)) || 'null')?.dispenseNotes || ''; } catch { return ''; }
  });
  const [student, setStudent] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [medSearch, setMedSearch] = useState('');
  const [medicines, setMedicines] = useState([]);
  const [medLoading, setMedLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [item, setItem] = useState(EMPTY_ITEM);
  const [stock, setStock] = useState({});
  const [dispenseResults, setDispenseResults] = useState([]);

  // Student details for the header card (age, sex, contact).
  useEffect(() => {
    let active = true;
    api.get(`/nurse/students/${visit.user_id}`).then(({ data }) => { if (active) setStudent(data.data); }).catch(() => {});
    return () => { active = false; };
  }, [visit.user_id]);

  // Medicine search for the Dispensing tab.
  useEffect(() => {
    if (tab !== 'dispensing' || !adding) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setMedLoading(true);
      try {
        const { data } = await api.get('/nurse/medicines', { signal: controller.signal, params: { search: medSearch || undefined } });
        const list = data.data?.data || data.data || [];
        setMedicines(list.filter(m => !m.is_expired));
      } catch (err) {
        if (err.code !== 'ERR_CANCELED') setMedicines([]);
      } finally { setMedLoading(false); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [tab, adding, medSearch]);

  // Current stock of each prescribed medicine, for the inventory check.
  const prescribedIds = [...new Set(prescribed.map(p => p.medicine_id))].join(',');
  useEffect(() => {
    if (!prescribedIds || saved) return undefined;
    let active = true;
    Promise.all(prescribedIds.split(',').map(id => api.get(`/nurse/medicines/${id}`).then(({ data }) => data.data).catch(() => null)))
      .then(list => { if (active) setStock(Object.fromEntries(list.filter(Boolean).map(m => [m.id, m]))); });
    return () => { active = false; };
  }, [prescribedIds, tab, saved]);

  const change = e => {
    const { name, value, type, checked } = e.target;
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const saveDraft = () => {
    try {
      localStorage.setItem(draftKey(visit.checkin_id), JSON.stringify({ form, prescribed, declined, dispenseNotes }));
      notify('Draft saved on this device.', 'success');
    } catch {
      notify('Unable to save the draft on this device.', 'error');
    }
  };

  const addPrescribed = () => {
    const quantity = Number(item.quantity);
    if (!item.medicine || !Number.isInteger(quantity) || quantity < 1) return;
    setPrescribed(current => [...current, {
      id: `${item.medicine.id}-${Date.now()}`, medicine_id: item.medicine.id, name: item.medicine.name, unit: item.medicine.unit || '',
      dose: item.dose.trim(), duration: item.duration.trim(), quantity,
    }]);
    setItem(EMPTY_ITEM);
    setMedSearch('');
    setAdding(false);
  };

  // Total asked per medicine across rows, compared with what is in stock.
  const needed = prescribed.reduce((totals, p) => ({ ...totals, [p.medicine_id]: (totals[p.medicine_id] || 0) + p.quantity }), {});
  const stockRows = Object.keys(needed).map(id => {
    const medicine = stock[id];
    const enough = medicine ? medicine.quantity >= needed[id] && !medicine.is_expired : null;
    return { id, name: medicine?.name || prescribed.find(p => p.medicine_id === id)?.name, stock: medicine?.quantity, unit: medicine?.unit, needed: needed[id], enough };
  });
  const allInStock = stockRows.every(row => row.enough !== false);

  // Deduct each prescribed medicine, reading its latest stock version first.
  const dispensePrescribed = async () => {
    const results = [];
    for (const p of prescribed) {
      try {
        const { data } = await api.get(`/nurse/medicines/${p.medicine_id}`);
        await api.post(`/nurse/medicines/${p.medicine_id}/movements`, {
          movement_type: 'dispensed', quantity: p.quantity, student_id: visit.id,
          reason: [`Consultation (queue ${visit.queue_number})`, p.dose, p.duration && `for ${p.duration}`].filter(Boolean).join(' · '),
        }, { headers: { 'If-Match': data.data.sync_version } });
        results.push({ ...p, ok: true });
      } catch (err) {
        results.push({ ...p, ok: false, error: err.response?.data?.message || 'Not dispensed' });
      }
    }
    return results;
  };

  const submit = async () => {
    if (!form.chief_complaint.trim()) { setTab('form'); notify('Chief complaint is required.', 'error'); return; }
    if (!declined && !allInStock) { setTab('dispensing'); notify('Some prescribed medicines are low on stock. Adjust the quantities first.', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/nurse/consultations', {
        user_id: visit.user_id,
        appointment_id: visit.appointment_id || null,
        appointment_checkin_id: visit.checkin_id || null,
        chief_complaint: form.chief_complaint,
        history_present_illness: form.history_present_illness || null,
        vital_signs: { bp: form.bp || null, hr: form.hr || null, rr: form.rr || null, temp: form.temp || null, o2_sat: form.o2_sat || null },
        nursing_assessment: form.nursing_assessment || null,
        nursing_interventions: form.nursing_interventions || null,
        treatment_plan: form.treatment_plan || null,
        // Dispensing notes and a declined prescription are kept with the consultation notes.
        general_remarks: [form.general_remarks, declined && 'Patient declined the prescribed medicine.', dispenseNotes && `Dispensing notes: ${dispenseNotes}`].filter(Boolean).join('\n') || null,
        medical_certificate: form.medical_certificate,
        medical_certificate_ref: form.medical_certificate ? form.medical_certificate_ref || null : null,
        follow_up_required: form.follow_up,
        follow_up_date: form.follow_up ? form.follow_up_date || null : null,
      });
      try { localStorage.removeItem(draftKey(visit.checkin_id)); } catch { /* nothing to clear */ }
      // Stock moves only after the consultation itself is on record.
      if (!declined && prescribed.length) setDispenseResults(await dispensePrescribed());
      setSaved(data.data);
      onSaved();
    } catch (err) {
      if (err.response?.status === 409) onConflict(err.response.data?.message || 'This visit was changed by another nurse.');
      else notify(err.response?.data?.message || 'Failed to save consultation.', 'error');
    } finally { setSaving(false); }
  };

  const profile = student?.student_profile || {};
  const age = ageFrom(profile.birthday || student?.birthday);
  const program = [profile.course, profile.year && `${profile.year} Year`, profile.section && `Section ${profile.section}`].filter(Boolean).join(' · ');
  const initials = visit.name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
  const appointment = visit.appointment_details || {};

  const printRecord = kind => {
    const nurse = getUser('nurse') || {};
    const record = {
      id: saved?.id || visit.checkin_id,
      date: saved?.created_at || new Date().toISOString(),
      recordType: 'consultation',
      complaint: form.chief_complaint,
      history: form.history_present_illness,
      diagnosis: form.nursing_assessment || form.general_remarks,
      assessment: form.nursing_assessment,
      interventions: form.nursing_interventions,
      treatment: form.treatment_plan,
      dispensed: declined ? ['Declined by the patient'] : (dispenseResults.length ? dispenseResults.filter(r => r.ok) : prescribed)
        .map(p => [`${p.name} ×${p.quantity}`, p.dose, p.duration && `for ${p.duration}`].filter(Boolean).join(' · ')),
      vitals: { bp: form.bp, hr: form.hr, temp: form.temp, rr: form.rr, o2: form.o2_sat },
      followUpRequired: form.follow_up,
      followUpDate: form.follow_up_date,
      medicalCertificate: form.medical_certificate,
      medicalCertificateRef: form.medical_certificate_ref,
      appointment: { service: visit.appointment },
      staff: `Nurse ${[nurse.first_name, nurse.last_name].filter(Boolean).join(' ')}`.trim(),
      staffRole: 'School Nurse',
    };
    const ok = openRecordDocument(kind, record, 'print', { name: visit.name.trim(), studentId: visit.id, program: program || '—' });
    if (!ok) notify('Allow pop-ups to print the record.', 'error');
  };

  const tabIndex = TABS.findIndex(t => t.key === tab);
  const nextTab = TABS[tabIndex + 1];

  const textArea = (name, title, placeholder, required = false) => (
    <div>
      <label htmlFor={`visit-${name}`} className={label}>{title}{required && <span className="text-red-500"> *</span>}</label>
      <textarea id={`visit-${name}`} name={name} value={form[name]} onChange={change} rows={3} maxLength={TEXT_LIMIT} required={required} className={input} placeholder={placeholder} />
      <Counter value={form[name]} />
    </div>
  );

  const reviewCard = 'rounded-lg border border-gray-100 p-4 dark:border-gray-700';
  const reviewTitle = 'mb-2 text-sm font-bold text-gray-900 dark:text-white';
  const reviewField = (title, value) => (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{title}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-gray-900 dark:text-white">{value || <span className="text-gray-400">Not recorded</span>}</dd>
    </div>
  );
  // A step counts as done once it has something filled in.
  const stepDone = {
    form: Boolean(form.chief_complaint.trim()),
    certificate: form.medical_certificate,
    dispensing: declined || prescribed.length > 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-maroon-800 hover:underline dark:text-maroon-300">
          <ArrowLeft className="h-4 w-4" /> Back to Queue
        </button>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${saved
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400'
          : 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800/30 dark:bg-purple-900/20 dark:text-purple-300'}`}>
          {saved ? <CheckCircle className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}{saved ? 'Completed' : 'In Consultation'}
        </span>
      </div>

      {/* Student and appointment */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Student" className={card}>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-base font-bold text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300">{initials}</span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">{visit.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-mono">{visit.id}</span>{program && ` · ${program}`}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2"><UserRound className="h-4 w-4 shrink-0 text-gray-400" /><div><dt className="text-xs text-gray-400">Age · Sex</dt><dd className="text-gray-900 dark:text-white">{age ?? '—'} · {capitalize(profile.gender || student?.gender) || '—'}</dd></div></div>
            <div className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-gray-400" /><div className="min-w-0"><dt className="text-xs text-gray-400">Mobile</dt><dd className="truncate text-gray-900 dark:text-white">{profile.mobile_number || '—'}</dd></div></div>
            <div className="col-span-2 flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-gray-400" /><div className="min-w-0"><dt className="text-xs text-gray-400">Email</dt><dd className="truncate text-gray-900 dark:text-white">{student?.email || '—'}</dd></div></div>
          </dl>
        </section>

        <section aria-label="Appointment details" className={card}>
          <h2 className="font-bold text-gray-900 dark:text-white">Appointment Details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-400">Date & Time</dt><dd className="text-gray-900 dark:text-white">{appointment.appointment_date ? formatAppointmentDate(appointment.appointment_date, { weekday: 'short' }) : 'Today'} · {appointment.time_slot || '—'}</dd></div></div>
            <div className="flex items-start gap-2"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-400">Reason for Visit</dt><dd className="text-gray-900 dark:text-white">{visit.complaint || appointment.concern || 'Not specified'}</dd></div></div>
            <div className="flex items-start gap-2"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-400">Appointment Type · Queue</dt><dd className="text-gray-900 dark:text-white">{visit.appointment} · {visit.queue_number}</dd></div></div>
            <div className="flex items-start gap-2"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-400">Kiosk Triage</dt><dd className="text-gray-900 dark:text-white">{visit.priority}{visit.triage?.severity && ` · ${capitalize(visit.triage.severity)}`}{visit.triage?.red_flags?.length ? ` · Red flags: ${visit.triage.red_flags.join(', ').replaceAll('_', ' ')}` : ''}</dd></div></div>
          </dl>
        </section>
      </div>

      {saved ? (
        <section aria-label="Printable records" className={`${card} text-center`}>
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"><CheckCircle className="h-7 w-7" /></span>
          <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Consultation saved</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The visit is complete and the student was notified. Print the records filled in during this visit.</p>
          {dispenseResults.length > 0 && (
            <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm">
              {dispenseResults.map(r => (
                <li key={r.id} className={`flex items-start gap-2 rounded-md px-3 py-2 ${r.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
                  {r.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{r.name} ×{r.quantity} {r.ok ? 'dispensed, stock deducted.' : `not dispensed: ${r.error}. Record it from the Medicines page.`}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => printRecord('consultation')} className={primary}><Printer className="h-4 w-4" /> Print Consultation Form</button>
            {form.medical_certificate && <button type="button" onClick={() => printRecord('certificate')} className={outline}><FileBadge className="h-4 w-4" /> Print Medical Certificate</button>}
            <button type="button" onClick={onBack} className={outline}><ArrowLeft className="h-4 w-4" /> Back to Queue</button>
          </div>
        </section>
      ) : (
        <section aria-label="Consultation" className="overflow-hidden rounded-lg border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          <div role="tablist" aria-label="Consultation sections" className="flex gap-1 overflow-x-auto border-b border-gray-100 bg-gray-50 p-1.5 dark:border-gray-700 dark:bg-gray-900/40">
            {TABS.map(({ key, label: title, icon: Icon }) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                className={`inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors ${tab === key ? 'bg-maroon-800 text-white' : 'text-gray-500 hover:bg-white hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{title}
                {key === 'dispensing' && prescribed.length > 0 && <span className="rounded-full bg-maroon-100 px-1.5 text-[10px] text-maroon-800">{prescribed.length}</span>}
              </button>
            ))}
          </div>

          <div className="p-4 lg:p-6" role="tabpanel">
            {tab === 'form' && (
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-4">
                  {textArea('chief_complaint', 'Chief Complaint', 'Main concern, e.g. headache and dizziness for 2 days', true)}
                  {textArea('history_present_illness', 'History / Present Illness', 'Onset, duration, related symptoms…')}
                  <fieldset>
                    <legend className={`${label} flex items-center gap-1.5`}><Heart className="h-4 w-4 text-red-500" /> Vital Signs</legend>
                    <div className="grid grid-cols-2 gap-3">
                      {VITALS.map(v => (
                        <label key={v.name} className="block">
                          <span className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">{v.label}</span>
                          <span className="flex items-center gap-1.5">
                            <input name={v.name} value={form[v.name]} onChange={change} className={input} placeholder={v.placeholder} inputMode={v.name === 'bp' ? 'text' : 'decimal'} />
                            <span className="w-11 shrink-0 text-xs text-gray-400">{v.unit}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
                <div className="space-y-4">
                  {textArea('nursing_assessment', 'Nursing Assessment', 'e.g. Alert, oriented, no distress')}
                  {textArea('nursing_interventions', 'Nursing Interventions', 'e.g. Provided health education and advised rest')}
                  {textArea('treatment_plan', 'Treatment / Plan', 'e.g. Paracetamol 500 mg, 3× a day for 3 days')}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={label}>Follow-up</span>
                      <select className={input} value={form.follow_up ? 'yes' : 'no'} onChange={e => setForm(current => ({ ...current, follow_up: e.target.value === 'yes' }))}>
                        <option value="no">Not required</option>
                        <option value="yes">Required</option>
                      </select>
                    </label>
                    {form.follow_up && (
                      <label className="block">
                        <span className={label}>Follow-up Date</span>
                        <input type="date" name="follow_up_date" value={form.follow_up_date} onChange={change} className={input} />
                      </label>
                    )}
                  </div>
                  {textArea('general_remarks', 'Notes (optional)', 'Anything else worth recording')}
                </div>
              </div>
            )}

            {tab === 'certificate' && (
              <div className="mx-auto max-w-xl space-y-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">Issue a medical certificate</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">It uses the complaint and assessment from the consultation form and can be printed after saving.</span>
                  </span>
                  <input type="checkbox" name="medical_certificate" checked={form.medical_certificate} onChange={change} className="h-5 w-5 accent-maroon-800" />
                </label>
                {form.medical_certificate && (
                  <label className="block">
                    <span className={label}>Certificate Reference</span>
                    <input name="medical_certificate_ref" value={form.medical_certificate_ref} onChange={change} className={input} placeholder="MED-2026-001" maxLength={191} />
                  </label>
                )}
              </div>
            )}

            {tab === 'dispensing' && (
              <div className="space-y-5">
                {/* Prescribed medicines */}
                <section aria-labelledby="prescribed-title">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 id="prescribed-title" className="font-bold text-gray-900 dark:text-white">Prescribed Medicines</h3>
                    <button type="button" onClick={() => setAdding(open => !open)} disabled={declined} className={`${btn} bg-maroon-800 px-3 py-2 text-white hover:bg-maroon-900`}>
                      <Plus className="h-4 w-4" /> Add Medicine
                    </button>
                  </div>

                  {adding && (
                    <div className="mb-3 space-y-3 rounded-lg border border-maroon-100 bg-maroon-50/40 p-3 dark:border-maroon-900/40 dark:bg-maroon-900/10">
                      {item.medicine ? (
                        <div className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm dark:bg-gray-800">
                          <span><span className="font-semibold text-gray-900 dark:text-white">{item.medicine.name}</span> <span className="text-gray-500">· {item.medicine.quantity} {item.medicine.unit} in stock</span></span>
                          <button type="button" onClick={() => setItem(EMPTY_ITEM)} className="text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300">Change</button>
                        </div>
                      ) : (
                        <div>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <input value={medSearch} onChange={e => setMedSearch(e.target.value)} className={`${input} pl-9`} placeholder="Search the inventory…" aria-label="Search medicines" autoFocus />
                          </div>
                          <ul className="mt-2 max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-100 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                            {medLoading && <li className="p-3 text-sm text-gray-400">Loading medicines…</li>}
                            {!medLoading && medicines.length === 0 && <li className="p-3 text-sm text-gray-400">No medicines found in the inventory.</li>}
                            {!medLoading && medicines.map(m => (
                              <li key={m.id}>
                                <button type="button" disabled={m.quantity < 1} onClick={() => setItem(current => ({ ...current, medicine: m }))}
                                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700/50">
                                  <span className="text-gray-900 dark:text-white">{m.name}{m.generic_name && <span className="text-gray-400"> · {m.generic_name}</span>}</span>
                                  <span className="shrink-0 text-xs text-gray-500">{m.quantity} {m.unit}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
                        <label className="block"><span className={label}>Dose / Frequency</span><input value={item.dose} onChange={e => setItem(current => ({ ...current, dose: e.target.value }))} className={input} placeholder="1 tab 3× a day" maxLength={60} /></label>
                        <label className="block"><span className={label}>Duration</span><input value={item.duration} onChange={e => setItem(current => ({ ...current, duration: e.target.value }))} className={input} placeholder="3 days" maxLength={40} /></label>
                        <label className="block"><span className={label}>Qty</span><input type="number" min="1" value={item.quantity} onChange={e => setItem(current => ({ ...current, quantity: e.target.value }))} className={input} /></label>
                        <button type="button" onClick={addPrescribed} disabled={!item.medicine || !(Number(item.quantity) >= 1)} className={`${btn} bg-maroon-800 px-3 py-2 text-white hover:bg-maroon-900`}><Plus className="h-4 w-4" /> Add</button>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                        <tr>{['Medicine', 'Dose / Frequency', 'Duration', 'Qty', ''].map(h => <th key={h || 'action'} scope="col" className="whitespace-nowrap px-4 py-2.5">{h || <span className="sr-only">Remove</span>}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {prescribed.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-400">{declined ? 'The patient declined medicine.' : 'No medicine prescribed yet. Use Add Medicine to pick from the inventory.'}</td></tr>
                        ) : prescribed.map(p => (
                          <tr key={p.id} className={declined ? 'opacity-50' : ''}>
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{p.name}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{p.dose || '—'}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{p.duration || '—'}</td>
                            <td className="px-4 py-2.5 tabular-nums text-gray-900 dark:text-white">{p.quantity}</td>
                            <td className="px-4 py-2.5 text-right">
                              <button type="button" onClick={() => setPrescribed(current => current.filter(x => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Inventory check */}
                {prescribed.length > 0 && !declined && (
                  <section aria-labelledby="inventory-title">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 id="inventory-title" className="font-bold text-gray-900 dark:text-white">Medicine Inventory <span className="text-sm font-normal text-gray-500">(deducted on save)</span></h3>
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${allInStock
                        ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400'
                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400'}`}>
                        {allInStock ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{allInStock ? 'Sufficient stock' : 'Insufficient stock'}
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs font-medium text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                          <tr>{['Medicine', 'In Stock', 'Needed', 'Unit', 'Status'].map(h => <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {stockRows.map(row => (
                            <tr key={row.id}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{row.name}</td>
                              <td className="px-4 py-2.5 tabular-nums text-gray-600 dark:text-gray-300">{row.stock ?? '…'}</td>
                              <td className="px-4 py-2.5 tabular-nums text-gray-600 dark:text-gray-300">{row.needed}</td>
                              <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{row.unit || '—'}</td>
                              <td className="px-4 py-2.5">{row.enough === null ? <span className="text-xs text-gray-400">Checking…</span>
                                : row.enough ? <CheckCircle className="h-4 w-4 text-green-600" aria-label="Enough stock" /> : <XCircle className="h-4 w-4 text-red-600" aria-label="Not enough stock" />}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                  <input type="checkbox" checked={declined} onChange={e => setDeclined(e.target.checked)} className="h-4 w-4 accent-maroon-800" />
                  Patient declined medicine
                </label>
                <div>
                  <label htmlFor="visit-dispense-notes" className={label}>Notes (optional)</label>
                  <textarea id="visit-dispense-notes" value={dispenseNotes} onChange={e => setDispenseNotes(e.target.value)} rows={2} maxLength={TEXT_LIMIT} className={input} placeholder="e.g. Advised to rest and drink plenty of water" />
                  <Counter value={dispenseNotes} />
                </div>
              </div>
            )}

            {tab === 'review' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Review Consultation</h3>
                  {/* Progress through the visit; each step opens its tab. */}
                  <ol className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    {TABS.map((step, index) => {
                      const current = step.key === 'review';
                      const done = stepDone[step.key];
                      return (
                        <li key={step.key} className="flex items-center gap-1.5">
                          {index > 0 && <ArrowRight className="h-3.5 w-3.5 text-gray-300" aria-hidden="true" />}
                          <button type="button" onClick={() => setTab(step.key)} aria-current={current ? 'step' : undefined}
                            className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 ${current ? 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700/50'}`}>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${current ? 'bg-maroon-800 text-white' : done ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                              {done && !current ? <Check className="h-3 w-3" /> : index + 1}
                            </span>
                            {step.label.replace(' & Confirm', '')}
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </div>

                {/* Student and visit */}
                <section className={`${reviewCard} flex flex-wrap items-start justify-between gap-4`} aria-label="Student information">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-maroon-50 font-bold text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300">{initials}</span>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Student Information</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{visit.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400"><span className="font-mono">{visit.id}</span>{program && ` · ${program}`}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Age {age ?? '—'} · {capitalize(profile.gender || student?.gender) || '—'}</p>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Date & Time</p>
                    <p className="text-gray-900 dark:text-white">{appointment.appointment_date ? formatAppointmentDate(appointment.appointment_date, { weekday: 'short' }) : 'Today'} · {appointment.time_slot || '—'}</p>
                    <p className="text-gray-500 dark:text-gray-400">{visit.appointment} · Queue {visit.queue_number}</p>
                  </div>
                </section>

                <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                  <section className={reviewCard} aria-label="Consultation details">
                    <h4 className={reviewTitle}>Consultation Details</h4>
                    <dl className="space-y-3">
                      {reviewField('Chief Complaint', form.chief_complaint)}
                      {reviewField('History / Present Illness', form.history_present_illness)}
                      {reviewField('Treatment / Plan', form.treatment_plan)}
                    </dl>
                  </section>
                  <section className={reviewCard} aria-label="Vital signs">
                    <h4 className={reviewTitle}>Vital Signs</h4>
                    <ul className="space-y-2 text-sm">
                      {VITALS.map(v => {
                        const Icon = VITAL_ICONS[v.name] || Activity;
                        return (
                          <li key={v.name} className="flex items-center gap-2">
                            <Icon className="h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" aria-hidden="true" />
                            <span className="text-gray-500 dark:text-gray-400">{v.label}</span>
                            <span className="ml-auto font-semibold text-gray-900 tabular-nums dark:text-white">{form[v.name] ? `${form[v.name]} ${v.unit}` : '—'}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <section className={reviewCard} aria-label="Nursing assessment"><h4 className={reviewTitle}>Nursing Assessment</h4><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{form.nursing_assessment || <span className="text-gray-400">Not recorded</span>}</p></section>
                  <section className={reviewCard} aria-label="Nursing interventions"><h4 className={reviewTitle}>Nursing Interventions</h4><p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">{form.nursing_interventions || <span className="text-gray-400">Not recorded</span>}</p></section>
                </div>

                <section className={reviewCard} aria-label="Prescribed medicines">
                  <h4 className={reviewTitle}>Prescribed Medicines</h4>
                  {declined ? <p className="text-sm text-gray-500 dark:text-gray-400">The patient declined medicine.</p>
                    : prescribed.length === 0 ? <p className="text-sm text-gray-400">No medicine prescribed.</p> : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs text-gray-500 dark:text-gray-400"><tr>{['Medicine', 'Dose / Frequency', 'Duration', 'Qty'].map(h => <th key={h} scope="col" className="whitespace-nowrap py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {prescribed.map(p => (
                              <tr key={p.id}>
                                <td className="py-2 pr-4 text-gray-900 dark:text-white">{p.name}</td>
                                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{p.dose || '—'}</td>
                                <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{p.duration || '—'}</td>
                                <td className="py-2 pr-4 tabular-nums text-gray-900 dark:text-white">{p.quantity} {p.unit}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  {!declined && prescribed.length > 0 && !allInStock && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> Some medicines are low on stock. Adjust them in Dispensing before saving.</p>
                  )}
                </section>

                <dl className="grid gap-4 sm:grid-cols-3">
                  <div className={reviewCard}>{reviewField('Follow-up', form.follow_up ? `Required${form.follow_up_date ? ` · ${formatAppointmentDate(form.follow_up_date, { weekday: 'short' })}` : ''}` : 'Not required')}</div>
                  <div className={reviewCard}>{reviewField('Medical Certificate', form.medical_certificate ? `Issue${form.medical_certificate_ref ? ` · ${form.medical_certificate_ref}` : ''}` : 'Not issued')}</div>
                  <div className={reviewCard}>{reviewField('Notes', [form.general_remarks, dispenseNotes].filter(Boolean).join('\n'))}</div>
                </dl>

                <p className="text-xs text-gray-500 dark:text-gray-400">Saved consultations are read-only. Prescribed medicines are deducted from stock when you confirm.</p>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
            <button type="button" onClick={saveDraft} className={outline}><Save className="h-4 w-4" /> Save Draft</button>
            {tab !== 'review' && <button type="button" onClick={() => setTab('review')} className={outline}><Eye className="h-4 w-4" /> Review</button>}
            {nextTab && (
              <button type="button" onClick={() => setTab(nextTab.key)} className={primary}>Next: {nextTab.label} <ArrowRight className="h-4 w-4" /></button>
            )}
            {tab === 'review' && (
              <button type="button" onClick={submit} disabled={saving} className={primary}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />} {saving ? 'Saving…' : 'Confirm & Save'}
              </button>
            )}
          </footer>
        </section>
      )}
    </div>
  );
};

export default ConsultationVisit;
