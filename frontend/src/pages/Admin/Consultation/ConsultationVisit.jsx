import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Stethoscope, ClipboardPenLine, CalendarClock, MessageSquareText, ClipboardList, UserRound, Phone, Mail, GraduationCap, CalendarRange, Users, CircleUserRound, IdCard, MapPin,
  Heart, FileBadge, FileSignature, FileText, Pill, Search, Save, Loader2, CheckCircle, ArrowRight, Printer, Eye, Activity, Plus, Trash2, XCircle, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../../services/api';
import { getUser } from '../../../services/session';
import { formatAppointmentDate } from '../../../utils/appointmentDate';
import { bloodPressureOnly, decimalOnly, digitsOnly } from '../../../utils/inputFilters';
import { buildRecordDocument, openRecordDocument, studentDetails } from '../../Student/HealthRecords/recordDocuments';
import useSignatoryVersion from '../../../hooks/useSignatoryVersion';
import PhilippineMobileInput from '../../../components/PhilippineMobileInput';

/*
 * One clinic visit, opened from the queue: who the student is, why they came,
 * then the consultation form, medical certificate and medicine steps, a review
 * that shows the clinic's printed Consultation Form exactly as it will print,
 * and the printable records once it is saved.
 */

// Certificate reference: MED + this year + today's month and day, e.g. MED-2026-1108 on November 8, 2026.
const certificateRef = (date = new Date()) => `MED-${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
const EMPTY_FORM = {
  chief_complaint: '', history_present_illness: '',
  bp: '', hr: '', rr: '', temp: '', o2_sat: '',
  nursing_assessment: '', nursing_interventions: '', treatment_plan: '',
  follow_up: false, follow_up_date: '', general_remarks: '',
  consultation_form: true,
  medical_certificate: false, medical_certificate_ref: '',
  liability_form: false, liability_activity: '',
  ojt_certificate: false, ojt_certificate_ref: '', ojt_company: '',
  sick_certificate: false, sick_certificate_ref: '', sick_rest_days: '',
  // Patient information on the printed form. null = not edited, so the student's profile value is shown.
  patient_age: null, patient_address: null, patient_contact: null, patient_emergency_name: null, patient_emergency_relationship: null, patient_emergency_contact: null,
};
// These parts of the clinic's consultation form cannot be left blank; everything else is optional.
const REQUIRED_FIELDS = {
  chief_complaint: 'Enter the chief complaint.',
  history_present_illness: 'Enter the history / present illness.',
  nursing_assessment: 'Enter the nursing assessment.',
  nursing_interventions: 'Enter the nursing interventions.',
};
const missingRequired = form => Object.fromEntries(Object.entries(REQUIRED_FIELDS).filter(([name]) => !String(form[name] || '').trim()));

const TABS = [
  { key: 'form', label: 'Consult Form', icon: ClipboardPenLine },
  { key: 'dispensing', label: 'Prescribe Medicine', icon: Pill },
  { key: 'certificate', label: 'Additional Documents', icon: FileBadge },
  { key: 'review', label: 'Review and Confirm', icon: Eye },
];
const MEDICINE_MODES = [
  { key: 'none', title: 'No medicine', note: 'Consultation only. No medicine is given.', icon: Stethoscope },
  { key: 'dispense', title: 'Dispense from clinic stock', note: 'The medicine is handed over now and deducted from the inventory.', icon: Pill },
  { key: 'prescription', title: 'Prescription only', note: 'A prescription for the student to buy outside. Nothing is deducted from stock.', icon: FileText },
];
const EMPTY_ITEM = { medicine: null, dose: '', duration: '', quantity: '1' };
const EMPTY_RX = { name: '', dose: '', duration: '', quantity: '' };
const VITALS = [
  { name: 'bp', label: 'Blood Pressure', unit: 'mmHg', placeholder: '120/80', filter: bloodPressureOnly },
  { name: 'rr', label: 'Respiratory Rate', unit: '/min', placeholder: '16', filter: v => digitsOnly(v, 3) },
  { name: 'temp', label: 'Temperature', unit: '°C', placeholder: '36.5', filter: v => decimalOnly(v, 2, 1) },
  { name: 'o2_sat', label: 'Pulse Oxygen Rate', unit: '%', placeholder: '98', filter: v => digitsOnly(v, 3) },
  { name: 'hr', label: 'Pulse Rate', unit: 'bpm', placeholder: '72', filter: v => digitsOnly(v, 3) },
];
const TEXT_LIMIT = 500;
// "Save progress" keeps the unfinished form on the server (any nurse device can continue it);
// a copy in this browser opens the form instantly and covers a save made while offline.
const draftKey = checkinId => `consultation-draft-${checkinId}`;
const readDraft = checkinId => {
  try { return JSON.parse(localStorage.getItem(draftKey(checkinId)) || 'null') || {}; } catch { return {}; }
};

const ageFrom = birthday => {
  const born = birthday ? new Date(birthday) : null;
  if (!born || Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age -= 1;
  return age;
};
const capitalize = value => (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');


const input = 'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const inputError = 'border-red-500 focus:border-red-500 focus:ring-red-500/20 dark:border-red-400';
const label = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';
const card = 'rounded-[10px] border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800 lg:p-5';
const btn = 'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${btn} bg-maroon-800 text-white hover:bg-maroon-900`;
const outline = `${btn} border border-maroon-200 bg-white text-maroon-800 hover:bg-maroon-50 dark:border-maroon-800/50 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20`;

const Counter = ({ value }) => <span className="mt-1 block text-right text-xs text-gray-500 tabular-nums dark:text-gray-400">{value.length}/{TEXT_LIMIT}</span>;

const rxLine = p => [p.name, p.dose, p.duration && `for ${p.duration}`, p.quantity && `×${p.quantity}`].filter(Boolean).join(' · ');

const ConsultationVisit = ({ visit, onBack, onDone = onBack, doneLabel = 'Back to Consultation', onQueue, onSaved, onConflict, notify }) => {
  const draft = useMemo(() => readDraft(visit.checkin_id), [visit.checkin_id]);
  // The kiosk sends ['none'] when no red flag was ticked; that is not a red flag to show.
  const redFlags = (visit.triage?.red_flags || []).filter(flag => flag !== 'none');
  const [tab, setTab] = useState('form');
  const [form, setForm] = useState(() => (draft.form
    ? { ...EMPTY_FORM, ...draft.form }
    : { ...EMPTY_FORM, chief_complaint: visit.complaint || '' }));
  // Medicine step: nothing, dispense from the clinic's stock, or a prescription only.
  const [mode, setMode] = useState(() => draft.mode || (draft.prescribed?.length && !draft.declined ? 'dispense' : 'none'));
  // Medicines to dispense; stock is deducted for these only when the consultation is saved.
  const [prescribed, setPrescribed] = useState(() => draft.prescribed || []);
  // Prescription-only lines are free text: the student may buy them anywhere.
  const [rx, setRx] = useState(() => draft.rx || []);
  const [rxItem, setRxItem] = useState(EMPTY_RX);
  const [dispenseNotes, setDispenseNotes] = useState(() => draft.dispenseNotes || '');
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
  // The nurse who attended the patient (defaults to the signed-in nurse); named on the printed documents.
  const signedInNurse = getUser('nurse') || {};
  const [nurses, setNurses] = useState([]);
  const [attendingId, setAttendingId] = useState(signedInNurse.id || '');
  // Required-field errors show once the nurse tried to move on, or after leaving a field.
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [preview, setPreview] = useState(null);
  // Review: which document the preview shows (the consultation form, then each optional one ticked).
  const [previewDoc, setPreviewDoc] = useState('consultation');
  const [previewHeight, setPreviewHeight] = useState(1100);
  const previewFrame = useRef(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState(null);
  // Typing before the server's draft arrives keeps what was typed.
  const edited = useRef(false);
  // Auto-save waits for the server's draft, so an empty form never overwrites it.
  const [draftLoaded, setDraftLoaded] = useState(false);
  const skipAutoSave = useRef(true);
  const pendingDraft = useRef(null);

  const applyDraft = d => {
    skipAutoSave.current = true;
    // The server stores blank fields as null; the form's inputs need their empty defaults.
    if (d.form) setForm({ ...EMPTY_FORM, ...Object.fromEntries(Object.entries(d.form).filter(([, value]) => value !== null)) });
    if (d.mode) setMode(d.mode);
    if (d.prescribed) setPrescribed(d.prescribed);
    if (d.rx) setRx(d.rx);
    if (d.dispenseNotes !== undefined) setDispenseNotes(d.dispenseNotes || '');
    if (d.attendingId) setAttendingId(d.attendingId);
  };

  useEffect(() => {
    let active = true;
    api.get(`/nurse/consultation-drafts/${visit.checkin_id}`).then(({ data }) => {
      if (!active || !data.data) return;
      setDraftInfo(data.data);
      if (!edited.current) applyDraft(data.data.data || {});
    }).catch(() => {}).finally(() => { if (active) setDraftLoaded(true); });
    return () => { active = false; };
  }, [visit.checkin_id]);

  const errors = useMemo(() => missingRequired(form), [form]);
  const fieldError = name => ((showErrors || touched[name]) ? (errors[name] || serverErrors[name]) : undefined);

  // Student details for the Patient Details card and the printed form and certificate.
  useEffect(() => {
    let active = true;
    api.get(`/nurse/students/${visit.user_id}`).then(({ data }) => { if (active) setStudent(data.data); }).catch(() => {});
    return () => { active = false; };
  }, [visit.user_id]);

  useEffect(() => {
    let active = true;
    api.get('/nurse/nurses').then(({ data }) => { if (active) setNurses(data.data || []); }).catch(() => {});
    return () => { active = false; };
  }, []);

  // Medicine search for the "Dispense from clinic stock" step.
  useEffect(() => {
    if (tab !== 'dispensing' || mode !== 'dispense' || !adding) return undefined;
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
  }, [tab, mode, adding, medSearch]);

  // Current stock of each medicine to dispense, for the inventory check.
  const prescribedIds = [...new Set(prescribed.map(p => p.medicine_id))].join(',');
  useEffect(() => {
    if (!prescribedIds || saved) return undefined;
    let active = true;
    Promise.all(prescribedIds.split(',').map(id => api.get(`/nurse/medicines/${id}`).then(({ data }) => data.data).catch(() => null)))
      .then(list => { if (active) setStock(Object.fromEntries(list.filter(Boolean).map(m => [m.id, m]))); });
    return () => { active = false; };
  }, [prescribedIds, tab, saved]);

  const change = e => {
    const { name, type, checked } = e.target;
    const filter = VITALS.find(v => v.name === name)?.filter;
    const value = filter ? filter(e.target.value) : e.target.value;
    edited.current = true;
    setForm(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
      // Ticking Medical Certificate fills in the reference; the nurse can still change it.
      ...(name === 'medical_certificate' && checked && !current.medical_certificate_ref ? { medical_certificate_ref: certificateRef() } : {}),
      ...(name === 'ojt_certificate' && checked && !current.ojt_certificate_ref ? { ojt_certificate_ref: certificateRef() } : {}),
      ...(name === 'sick_certificate' && checked && !current.sick_certificate_ref ? { sick_certificate_ref: certificateRef() } : {}),
    }));
    if (serverErrors[name]) setServerErrors(current => ({ ...current, [name]: undefined }));
  };

  // Auto-save: every change is kept on this device at once and on the server a moment
  // later (and right away when the nurse leaves the page), so leaving never loses the form.
  useEffect(() => {
    if (saved || saving) { pendingDraft.current = null; return undefined; }
    if (!draftLoaded) return undefined;
    // The first run only shows what was loaded; edits typed before that still count.
    if (skipAutoSave.current) { skipAutoSave.current = false; if (!edited.current) return undefined; }
    const data = { form, mode, prescribed, rx, dispenseNotes, attendingId };
    try { localStorage.setItem(draftKey(visit.checkin_id), JSON.stringify(data)); } catch { /* the server copy still counts */ }
    pendingDraft.current = data;
    const timer = setTimeout(() => {
      pendingDraft.current = null;
      api.put(`/nurse/consultation-drafts/${visit.checkin_id}`, { data })
        .then(({ data: res }) => setDraftInfo(res.data)).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [draftLoaded, saved, saving, form, mode, prescribed, rx, dispenseNotes, attendingId, visit.checkin_id]);

  // Leaving the page before the timer fires: send what is still waiting.
  useEffect(() => () => {
    if (pendingDraft.current) api.put(`/nurse/consultation-drafts/${visit.checkin_id}`, { data: pendingDraft.current }).catch(() => {});
  }, [visit.checkin_id]);

  const saveDraft = async () => {
    if (savingDraft) return;
    const data = { form, mode, prescribed, rx, dispenseNotes, attendingId };
    pendingDraft.current = null;
    try { localStorage.setItem(draftKey(visit.checkin_id), JSON.stringify(data)); } catch { /* the server copy still counts */ }
    setSavingDraft(true);
    try {
      const { data: res } = await api.put(`/nurse/consultation-drafts/${visit.checkin_id}`, { data });
      setDraftInfo(res.data);
      notify('Draft saved. Continue this visit on any device; it is not in the records until you confirm.', 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Could not reach the server. Progress is kept on this device only for now.', 'error');
    } finally { setSavingDraft(false); }
  };

  const focusSoon = name => setTimeout(() => document.getElementById(`visit-${name}`)?.focus(), 50);

  // Leaving the form for a later step needs the required fields; going back never does.
  const goTo = key => {
    if (key !== 'form' && Object.keys(errors).length) {
      setShowErrors(true);
      setTab('form');
      notify('Fill in the required fields (marked *) first.', 'error');
      focusSoon(Object.keys(errors)[0]);
      return;
    }
    setTab(key);
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

  const addRx = () => {
    if (!rxItem.name.trim()) return;
    setRx(current => [...current, {
      id: `rx-${Date.now()}`, name: rxItem.name.trim(), dose: rxItem.dose.trim(), duration: rxItem.duration.trim(),
      quantity: rxItem.quantity.trim(),
    }]);
    setRxItem(EMPTY_RX);
  };

  // Total asked per medicine across rows, compared with what is in stock.
  const needed = prescribed.reduce((totals, p) => ({ ...totals, [p.medicine_id]: (totals[p.medicine_id] || 0) + p.quantity }), {});
  const stockRows = Object.keys(needed).map(id => {
    const medicine = stock[id];
    const enough = medicine ? medicine.quantity >= needed[id] && !medicine.is_expired : null;
    return { id, name: medicine?.name || prescribed.find(p => p.medicine_id === id)?.name, stock: medicine?.quantity, unit: medicine?.unit, needed: needed[id], enough };
  });
  const allInStock = stockRows.every(row => row.enough !== false);

  // Deduct each medicine to dispense, reading its latest stock version first.
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
    if (Object.keys(errors).length) {
      setShowErrors(true); setTab('form');
      notify('Fill in the required fields (marked *) before saving.', 'error');
      focusSoon(Object.keys(errors)[0]);
      return;
    }
    if (form.liability_form && !form.liability_activity.trim()) {
      setTab('certificate'); setShowErrors(true);
      notify('Enter the activity for the medical liability form, or untick it.', 'error');
      focusSoon('liability_activity');
      return;
    }
    if (form.ojt_certificate && !form.ojt_company.trim()) {
      setTab('certificate'); setShowErrors(true);
      notify('Enter the company for the OJT medical certificate, or untick it.', 'error');
      focusSoon('ojt_company');
      return;
    }
    if (mode === 'dispense' && !prescribed.length) { setTab('dispensing'); notify('Add the medicine to dispense, or choose "No medicine".', 'error'); return; }
    if (mode === 'prescription' && !rx.length) { setTab('dispensing'); notify('Add the prescription, or choose "No medicine".', 'error'); return; }
    if (mode === 'dispense' && !allInStock) { setTab('dispensing'); notify('Some medicines are low on stock. Adjust the quantities first.', 'error'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/nurse/consultations', {
        user_id: visit.user_id,
        appointment_id: visit.appointment_id || null,
        appointment_checkin_id: visit.checkin_id || null,
        attending_nurse_id: attendingId || null,
        chief_complaint: form.chief_complaint,
        history_present_illness: form.history_present_illness,
        vital_signs: { bp: form.bp || null, hr: form.hr || null, rr: form.rr || null, temp: form.temp || null, o2_sat: form.o2_sat || null },
        nursing_assessment: form.nursing_assessment,
        nursing_interventions: form.nursing_interventions,
        treatment_plan: form.treatment_plan || null,
        // A prescription and the dispensing notes are kept with the consultation notes.
        general_remarks: [
          form.general_remarks,
          mode === 'prescription' && ['Prescription (not dispensed from clinic stock):', ...rx.map(rxLine)].join('\n'),
          dispenseNotes && `Dispensing notes: ${dispenseNotes}`,
        ].filter(Boolean).join('\n') || null,
        medical_certificate: form.medical_certificate,
        medical_certificate_ref: form.medical_certificate ? form.medical_certificate_ref || null : null,
        liability_form: form.liability_form,
        liability_activity: form.liability_form ? form.liability_activity.trim() : null,
        ojt_certificate: form.ojt_certificate,
        ojt_certificate_ref: form.ojt_certificate ? form.ojt_certificate_ref || null : null,
        ojt_company: form.ojt_certificate ? form.ojt_company.trim() : null,
        sick_certificate: form.sick_certificate,
        sick_certificate_ref: form.sick_certificate ? form.sick_certificate_ref || null : null,
        sick_rest_days: form.sick_certificate && form.sick_rest_days ? Number(form.sick_rest_days) : null,
        follow_up_required: form.follow_up,
        follow_up_date: form.follow_up ? form.follow_up_date || null : null,
      });
      // The visit is finished on the server: stop re-claiming it (the claim would now be refused)
      // before stock moves, which takes a moment.
      onSaved();
      try { localStorage.removeItem(draftKey(visit.checkin_id)); } catch { /* nothing to clear */ }
      // Stock moves only after the consultation itself is on record.
      if (mode === 'dispense' && prescribed.length) setDispenseResults(await dispensePrescribed());
      setSaved(data.data);
    } catch (err) {
      const apiErrors = err.response?.data?.errors;
      const fromServer = Object.fromEntries(Object.keys(REQUIRED_FIELDS).filter(name => apiErrors?.[name]).map(name => [name, apiErrors[name][0]]));
      if (err.response?.status === 422 && Object.keys(fromServer).length) {
        setServerErrors(fromServer); setShowErrors(true); setTab('form');
        notify(Object.values(fromServer)[0], 'error');
        focusSoon(Object.keys(fromServer)[0]);
      } else if (err.response?.status === 409) onConflict(err.response.data?.message || 'This visit was changed by another nurse.');
      else notify(err.response?.data?.message || 'Failed to save consultation.', 'error');
    } finally { setSaving(false); }
  };

  const profile = student?.student_profile || {};
  const age = ageFrom(profile.birthday || student?.birthday);
  const appointment = visit.appointment_details || {};
  // Year may already read "4th Year"; only add the word when it is a bare "4th".
  const yearLevel = profile.year ? (/year/i.test(profile.year) ? profile.year : `${profile.year} Year`) : '';
  // One line for the printed consultation form and certificate.
  const program = [profile.course, yearLevel, profile.section && `Section ${profile.section}`].filter(Boolean).join(' · ');

  // Patient details for the printed form: the student's profile, unless the nurse typed something else in Step 1.
  const health = student?.health_profile;
  const profileInfo = studentDetails(student, profile, health && { name: health.emergency_name, relationship: health.emergency_relationship, phone: health.emergency_phone });
  // The emergency contact is typed as two fields (name, relationship) and printed as "Name — Relationship".
  const emergencyName = form.patient_emergency_name ?? (health?.emergency_name || profile.guardian_name || '');
  const emergencyRelationship = form.patient_emergency_relationship ?? (health?.emergency_relationship || profile.guardian_relationship || '');
  const patientInfo = {
    ...profileInfo,
    age: form.patient_age ?? profileInfo.age,
    address: form.patient_address ?? profileInfo.address,
    contact: form.patient_contact ?? profileInfo.contact,
    emergencyName,
    emergencyRelationship,
    emergencyContact: form.patient_emergency_contact ?? profileInfo.emergencyContact,
  };

  // An editable Patient Details field: starts from the student's profile; whatever the nurse types is what prints on the form.
  const patientField = (name, title, { span = '', phone = false, ...props }) => {
    const key = { patient_age: 'age', patient_contact: 'contact', patient_address: 'address', patient_emergency_name: 'emergencyName', patient_emergency_relationship: 'emergencyRelationship', patient_emergency_contact: 'emergencyContact' }[name];
    return (
      <div className={`min-w-0 ${span}`}>
        <label htmlFor={`visit-${name}`} className="mb-1 block text-xs text-gray-500 dark:text-gray-400">{title}</label>
        {phone
          ? <PhilippineMobileInput id={`visit-${name}`} name={name} value={patientInfo[key] ?? ''} onChange={change} disabled={!!saved} className={`${input} disabled:opacity-70`} />
          : <input id={`visit-${name}`} name={name} value={patientInfo[key]} onChange={change} disabled={!!saved} className={`${input} disabled:opacity-70`} {...props} />}
      </div>
    );
  };

  const attendingNurse = nurses.find(n => n.id === attendingId);
  const nurseName = n => `Nurse ${[n?.first_name, n?.last_name].filter(Boolean).join(' ')}`.trim();

  // The record and student details behind the printed Consultation Form (used by the preview and by Print).
  const buildDocument = () => {
    const nurse = attendingNurse || signedInNurse;
    const medicineLines = mode === 'dispense'
      ? (dispenseResults.length ? dispenseResults.filter(r => r.ok) : prescribed)
        .map(p => [`${p.name} ×${p.quantity}`, p.dose, p.duration && `for ${p.duration}`].filter(Boolean).join(' · '))
      : mode === 'prescription' ? rx.map(p => `Rx: ${rxLine(p)}`) : [];
    const record = {
      id: saved?.id || visit.checkin_id,
      date: saved?.created_at || new Date().toISOString(),
      recordType: 'consultation',
      complaint: form.chief_complaint,
      history: form.history_present_illness,
      diagnosis: form.nursing_assessment,
      assessment: form.nursing_assessment,
      interventions: form.nursing_interventions,
      treatment: form.treatment_plan,
      dispensed: medicineLines,
      vitals: { bp: form.bp, hr: form.hr, temp: form.temp, rr: form.rr, o2: form.o2_sat },
      followUpRequired: form.follow_up,
      followUpDate: form.follow_up_date,
      medicalCertificate: form.medical_certificate,
      medicalCertificateRef: form.medical_certificate_ref,
      liabilityForm: form.liability_form,
      liabilityActivity: form.liability_activity,
      ojtCertificate: form.ojt_certificate,
      ojtCertificateRef: form.ojt_certificate_ref,
      ojtCompany: form.ojt_company,
      sickCertificate: form.sick_certificate,
      sickCertificateRef: form.sick_certificate_ref,
      sickRestDays: form.sick_rest_days,
      appointment: { service: visit.appointment },
      staff: nurseName(nurse),
      staffRole: 'Clinic Nurse',
    };
    return { record, details: { ...patientInfo, emergencyName: [emergencyName, emergencyRelationship].filter(Boolean).join(' — '), emergencyPerson: emergencyName, name: visit.name.trim(), studentId: visit.id, program } };
  };

  const printRecord = kind => {
    const { record, details } = buildDocument();
    const ok = openRecordDocument(kind, record, 'print', details);
    if (!ok) notify('Allow pop-ups to print the record.', 'error');
  };

  // Review shows the clinic's own templates, filled in, exactly as they will print: the Consultation
  // Form first, then each additional document the nurse ticked, one page at a time.
  const reviewDocs = [
    form.consultation_form && { kind: 'consultation', label: 'Consultation Form' },
    form.medical_certificate && { kind: 'certificate', label: 'Medical Certificate' },
    form.sick_certificate && { kind: 'sick', label: 'Medical Certificate (Sick)' },
    form.ojt_certificate && { kind: 'ojt', label: 'Medical Certificate (OJT)' },
    form.liability_form && { kind: 'liability', label: 'Medical Liability Form' },
  ].filter(Boolean);
  const signatoryVersion = useSignatoryVersion(); // redraws the preview when the signatory is switched
  const docIndex = Math.max(0, reviewDocs.findIndex(d => d.kind === previewDoc));
  const currentDoc = reviewDocs[docIndex] || null;
  const previewKey = tab === 'review' && currentDoc ? JSON.stringify([currentDoc.kind, form, mode, prescribed, rx, attendingId, student?.id, nurses.length, signatoryVersion]) : '';
  useEffect(() => {
    if (tab !== 'review' || !currentDoc) return undefined;
    let active = true;
    setPreview(null);
    const { record, details } = buildDocument();
    buildRecordDocument(currentDoc.kind, record, details)
      .then(html => { if (active) setPreview(html); })
      .catch(() => { if (active) setPreview(''); });
    return () => { active = false; };
  }, [previewKey]);

  const fitPreview = () => {
    const doc = previewFrame.current?.contentDocument;
    if (doc?.documentElement) setPreviewHeight(Math.max(640, doc.documentElement.scrollHeight + 8));
  };

  const tabIndex = TABS.findIndex(t => t.key === tab);
  const nextTab = TABS[tabIndex + 1];

  const textArea = (name, title, placeholder, required = false) => {
    const error = fieldError(name);
    return (
      <div>
        <label htmlFor={`visit-${name}`} className={label}>{title}{required && <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>}</label>
        <textarea
          id={`visit-${name}`} name={name} value={form[name]} onChange={change} rows={3} maxLength={TEXT_LIMIT}
          onBlur={() => setTouched(current => ({ ...current, [name]: true }))}
          aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={error ? `visit-${name}-error` : undefined}
          className={`${input} ${error ? inputError : ''}`} placeholder={placeholder}
        />
        {error && <p id={`visit-${name}-error`} role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{error}</p>}
        <Counter value={form[name]} />
      </div>
    );
  };

  const missingCount = Object.keys(errors).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-maroon-800 hover:underline dark:text-maroon-300">
          <ArrowLeft className="h-4 w-4" /> Back to Consultation
        </button>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${saved
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400'
          : 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800/30 dark:bg-purple-900/20 dark:text-purple-300'}`}>
          {saved ? <CheckCircle className="h-3.5 w-3.5" /> : <Stethoscope className="h-3.5 w-3.5" />}{saved ? 'Completed' : 'In Consultation'}
        </span>
      </div>

      {/* Student and appointment */}
      <div className="grid gap-4 lg:grid-cols-[13fr_7fr]">
        {/* Laid out like Appointment Details: a titled card of labelled fields. */}
        <section aria-label="Patient details" className={card}>
          <h2 className="font-bold text-gray-900 dark:text-white">Patient Details</h2>
          {/* From registration: read-only. */}
          <dl className="mt-3 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <div className="flex items-start gap-2"><CircleUserRound className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Name</dt><dd className="font-semibold text-gray-900 dark:text-white">{visit.name}</dd></div></div>
            <div className="flex items-start gap-2"><IdCard className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Student ID</dt><dd className="font-mono text-gray-900 dark:text-white">{visit.id}</dd></div></div>
            <div className="flex items-start gap-2"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Sex</dt><dd className="text-gray-900 dark:text-white">{capitalize(profile.gender || student?.gender) || '—'}</dd></div></div>
            <div className="flex items-start gap-2"><GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Program</dt><dd className="text-gray-900 dark:text-white">{profile.course || '—'}</dd></div></div>
            <div className="flex items-start gap-2"><CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Year Level</dt><dd className="text-gray-900 dark:text-white">{yearLevel || '—'}</dd></div></div>
            <div className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Section</dt><dd className="text-gray-900 dark:text-white">{profile.section || '—'}</dd></div></div>
            <div className="flex items-start gap-2 sm:col-span-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div className="min-w-0"><dt className="text-xs text-gray-500 dark:text-gray-400">Email</dt><dd className="break-all text-gray-900 dark:text-white">{student?.email || '—'}</dd></div></div>
          </dl>

          {/* Additional information: filled in from the profile; the nurse can correct or complete it, and it prints on the Consultation Form. */}
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Additional Information</h3>
            <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Printed on the Consultation Form.</p>
            <div className="grid gap-3 sm:grid-cols-12">
              {patientField('patient_age', 'Age', { inputMode: 'numeric', maxLength: 3, placeholder: 'e.g. 19', span: 'sm:col-span-2' })}
              {patientField('patient_contact', 'Contact #', { phone: true, span: 'sm:col-span-4' })}
              {patientField('patient_address', 'Address', { maxLength: 255, placeholder: 'House no., street, barangay, city', span: 'sm:col-span-6' })}
              {/* Emergency contact: the guardian's name, relationship and number sit together on one row. */}
              {patientField('patient_emergency_name', 'Contact person in case of emergency', { maxLength: 191, placeholder: 'Full name', span: 'sm:col-span-4' })}
              {patientField('patient_emergency_relationship', 'Relationship', { maxLength: 60, placeholder: 'e.g. Mother', span: 'sm:col-span-4' })}
              {patientField('patient_emergency_contact', 'Emergency contact #', { phone: true, span: 'sm:col-span-4' })}
            </div>
          </div>
        </section>

        <section aria-label="Appointment details" className={card}>
          <h2 className="font-bold text-gray-900 dark:text-white">Appointment Details</h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex items-start gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-500 dark:text-gray-400">Date & Time</dt><dd className="text-gray-900 dark:text-white">{appointment.appointment_date ? formatAppointmentDate(appointment.appointment_date, { weekday: 'short' }) : 'Today'} · {appointment.time_slot || '—'}</dd></div></div>
            <div className="flex items-start gap-2"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-500 dark:text-gray-400">Reason for Visit</dt><dd className="text-gray-900 dark:text-white">{visit.complaint || appointment.concern || 'Not specified'}</dd></div></div>
            <div className="flex items-start gap-2"><ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-500 dark:text-gray-400">Appointment Type · Queue</dt><dd className="text-gray-900 dark:text-white">{visit.appointment} · {visit.queue_number}</dd></div></div>
            <div className="flex items-start gap-2"><Activity className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-500 dark:text-gray-400">Kiosk Triage</dt><dd className="text-gray-900 dark:text-white">{visit.priority}{visit.triage?.severity && ` · ${capitalize(visit.triage.severity)}`}{visit.triage?.pain_level != null && ` · Pain ${visit.triage.pain_level}/10`}{visit.triage?.symptom_duration && ` · Symptoms for ${visit.triage.symptom_duration.replace('-', '–').toLowerCase()}`}{redFlags.length ? ` · Red flags: ${redFlags.join(', ').replaceAll('_', ' ')}` : ''}</dd></div></div>
            {visit.triage?.notes && <div className="flex items-start gap-2"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-maroon-700 dark:text-maroon-300" /><div><dt className="text-xs text-gray-500 dark:text-gray-400">Other Concern (from kiosk)</dt><dd className="whitespace-pre-line text-gray-900 dark:text-white">{visit.triage.notes}</dd></div></div>}
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
                <li key={r.id} className={`flex items-start gap-2 rounded-[10px] px-3 py-2 ${r.ok ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'}`}>
                  {r.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                  <span>{r.name} ×{r.quantity} {r.ok ? 'dispensed, stock deducted.' : `not dispensed: ${r.error}. Record it from the Medicines page.`}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {form.consultation_form && <button type="button" onClick={() => printRecord('consultation')} className={primary}><Printer className="h-4 w-4" /> Print Consultation Form</button>}
            {form.medical_certificate && <button type="button" onClick={() => printRecord('certificate')} className={outline}><FileBadge className="h-4 w-4" /> Print Medical Certificate</button>}
            {form.sick_certificate && <button type="button" onClick={() => printRecord('sick')} className={outline}><FileBadge className="h-4 w-4" /> Print Medical Certificate (Sick)</button>}
            {form.ojt_certificate && <button type="button" onClick={() => printRecord('ojt')} className={outline}><FileBadge className="h-4 w-4" /> Print Medical Certificate (OJT)</button>}
            {form.liability_form && <button type="button" onClick={() => printRecord('liability')} className={outline}><FileSignature className="h-4 w-4" /> Print Medical Liability Form</button>}
            <button type="button" onClick={onDone} className={outline}><FileText className="h-4 w-4" /> {doneLabel}</button>
            {/* Saved: one click back to the Queue for the next student. */}
            {onQueue && <button type="button" onClick={onQueue} className={primary}><ArrowLeft className="h-4 w-4" /> Back to Queue</button>}
          </div>
        </section>
      ) : (
        <section aria-label="Consultation" className="overflow-hidden rounded-[10px] border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
          {/* Step process: numbered circles joined by a line; finished steps show a check. */}
          <nav aria-label="Consultation steps" className="overflow-x-auto border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
            <ol className="flex min-w-max items-center">
              {TABS.map(({ key, label: title }, index) => {
                const done = index < tabIndex;
                const current = index === tabIndex;
                return (
                  <li key={key} className={`flex items-center ${index < TABS.length - 1 ? 'flex-1' : ''}`}>
                    <button type="button" onClick={() => goTo(key)} aria-current={current ? 'step' : undefined}
                      className="group flex shrink-0 cursor-pointer items-center gap-2 rounded-full pr-1 text-sm font-semibold">
                      {/* Plain progress: passed steps keep their number in a maroon outline, no success check. */}
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs transition-colors ${
                        current ? 'border-maroon-800 bg-maroon-800 text-white'
                          : done ? 'border-maroon-800 bg-white text-maroon-800 dark:border-maroon-300 dark:bg-gray-800 dark:text-maroon-300'
                            : 'border-gray-300 bg-white text-gray-500 group-hover:border-maroon-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {index + 1}
                      </span>
                      <span className={current ? 'text-maroon-800 dark:text-maroon-300' : done ? 'text-gray-900 dark:text-white' : 'text-gray-500 group-hover:text-gray-800 dark:text-gray-400'}>
                        {title}
                      </span>
                    </button>
                    {index < TABS.length - 1 && (
                      <span className={`mx-3 h-0.5 min-w-6 flex-1 rounded-full ${done ? 'bg-maroon-800 dark:bg-maroon-300' : 'bg-gray-200 dark:bg-gray-700'}`} aria-hidden="true" />
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="p-4 lg:p-6">
            {tab === 'form' && (
              <div>
                <p className="mb-4 text-xs text-gray-600 dark:text-gray-300"><span className="text-red-600 dark:text-red-400">*</span> Required. The other fields can be left blank when they do not apply.</p>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    {nurses.length > 0 && (
                      <div>
                        <label htmlFor="visit-attending-nurse" className={label}>Attending nurse</label>
                        <select id="visit-attending-nurse" value={attendingId} onChange={e => setAttendingId(e.target.value)} className={input}>
                          {nurses.map(n => <option key={n.id} value={n.id}>{nurseName(n)}</option>)}
                        </select>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Named as the nurse on this visit and on the printed consultation form and certificate.</p>
                      </div>
                    )}
                    {textArea('chief_complaint', 'Chief Complaint', 'Main concern, e.g. headache and dizziness for 2 days', true)}
                    {textArea('history_present_illness', 'History / Present Illness', 'Onset, duration, related symptoms…', true)}
                    <fieldset>
                      <legend className={`${label} flex items-center gap-1.5`}><Heart className="h-4 w-4 text-red-500" aria-hidden="true" /> Vital Signs (optional)</legend>
                      <div className="grid grid-cols-2 gap-3">
                        {VITALS.map(v => (
                          <label key={v.name} className="block">
                            <span className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{v.label}</span>
                            <span className="flex items-center gap-1.5">
                              <input name={v.name} value={form[v.name]} onChange={change} className={input} placeholder={v.placeholder} inputMode={v.name === 'temp' ? 'decimal' : 'numeric'} maxLength={7} />
                              <span className="w-11 shrink-0 text-xs text-gray-600 dark:text-gray-300">{v.unit}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                  <div className="space-y-4">
                    {textArea('nursing_assessment', 'Nursing Assessment', 'e.g. Alert, oriented, no distress', true)}
                    {textArea('nursing_interventions', 'Nursing Interventions', 'e.g. Provided health education and advised rest', true)}
                    {textArea('treatment_plan', 'Treatment / Plan (optional)', 'e.g. Rest, fluids; return if symptoms persist')}
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
              </div>
            )}

            {tab === 'certificate' && (
              <div className="space-y-4">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">Additional Documents</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">Optional forms released with this visit. Tick only the ones the student needs; you can check them in Review.</p>
                </div>
                <div className="mx-auto max-w-xl space-y-4">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">Issue a Consultation Form</span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">Checked by default at the start of the consultation. You can check or uncheck any documents you need.</span>
                  </span>
                  <input type="checkbox" name="consultation_form" checked={form.consultation_form} onChange={change} className="h-5 w-5 cursor-pointer accent-maroon-800" />
                </label>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">Issue a Medical Certificate <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span></span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">Only when the student needs one. It uses the complaint and assessment from the consultation form and can be printed after saving.</span>
                  </span>
                  <input type="checkbox" name="medical_certificate" checked={form.medical_certificate} onChange={change} className="h-5 w-5 cursor-pointer accent-maroon-800" />
                </label>
                {form.medical_certificate && (
                  <label className="block">
                    <span className={label}>Certificate Reference</span>
                    <input name="medical_certificate_ref" value={form.medical_certificate_ref} onChange={change} className={input} placeholder={certificateRef()} maxLength={191} />
                  </label>
                )}

                {/* Medical Certificate (OJT): the student is essentially normal and may undergo On the Job Training at a company. */}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">Issue a Medical Certificate (OJT) <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span></span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">For a student going on On the Job Training. It certifies they are essentially normal at the time of examination and can be printed after saving.</span>
                  </span>
                  <input type="checkbox" name="ojt_certificate" checked={form.ojt_certificate} onChange={change} className="h-5 w-5 cursor-pointer accent-maroon-800" />
                </label>
                {form.ojt_certificate && (() => {
                  const missing = (showErrors || touched.ojt_company) && !form.ojt_company.trim();
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className={label}>Certificate Reference</span>
                        <input name="ojt_certificate_ref" value={form.ojt_certificate_ref} onChange={change} className={input} placeholder={certificateRef()} maxLength={191} />
                      </label>
                      <div>
                        <label htmlFor="visit-ojt_company" className={label}>OJT Company<span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span></label>
                        <input id="visit-ojt_company" name="ojt_company" value={form.ojt_company} onChange={change}
                          onBlur={() => setTouched(current => ({ ...current, ojt_company: true }))}
                          aria-required="true" aria-invalid={missing || undefined}
                          className={`${input} ${missing ? inputError : ''}`} placeholder="Company or establishment name" maxLength={191} />
                        {missing && <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Enter where the student will do the OJT.</p>}
                      </div>
                    </div>
                  );
                })()}

                {/* Medical Certificate (Sick): examined for an illness that needs medical attendance for a number of days. */}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">Issue a Medical Certificate (Sick) <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span></span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">For a student who needs rest because of an illness. It uses the impression from the consultation form and the days of medical attendance, and can be printed after saving.</span>
                  </span>
                  <input type="checkbox" name="sick_certificate" checked={form.sick_certificate} onChange={change} className="h-5 w-5 cursor-pointer accent-maroon-800" />
                </label>
                {form.sick_certificate && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className={label}>Certificate Reference</span>
                      <input name="sick_certificate_ref" value={form.sick_certificate_ref} onChange={change} className={input} placeholder={certificateRef()} maxLength={191} />
                    </label>
                    <label className="block">
                      <span className={label}>Days of Medical Attendance</span>
                      <input name="sick_rest_days" value={form.sick_rest_days} onChange={e => change({ target: { name: 'sick_rest_days', type: 'text', value: e.target.value.replace(/\D/g, '').slice(0, 3) } })} className={input} inputMode="numeric" placeholder="e.g. 3" maxLength={3} />
                    </label>
                  </div>
                )}

                {/* Medical Liability Form: the student declares they are fit to join an activity and signs it. */}
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                  <span>
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">Issue a Medical Liability Form <span className="font-normal text-gray-500 dark:text-gray-400">(optional)</span></span>
                    <span className="block text-xs text-gray-600 dark:text-gray-300">For a student joining an activity (field trip, sports fest, OJT). They declare they are fit to join and sign it. It can be printed after saving.</span>
                  </span>
                  <input type="checkbox" name="liability_form" checked={form.liability_form} onChange={change} className="h-5 w-5 cursor-pointer accent-maroon-800" />
                </label>
                {form.liability_form && (() => {
                  const missing = (showErrors || touched.liability_activity) && !form.liability_activity.trim();
                  return (
                    <div>
                      <label htmlFor="visit-liability_activity" className={label}>Activity<span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span></label>
                      <input id="visit-liability_activity" name="liability_activity" value={form.liability_activity} onChange={change}
                        onBlur={() => setTouched(current => ({ ...current, liability_activity: true }))}
                        aria-required="true" aria-invalid={missing || undefined}
                        className={`${input} ${missing ? inputError : ''}`} placeholder="e.g. Sports Fest 2026, Educational Field Trip" maxLength={191} />
                      {missing
                        ? <p role="alert" className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />Enter the activity the student will join.</p>
                        : <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Printed on the form: “…fit to join the activities on our <em>activity</em>.”</p>}
                    </div>
                  );
                })()}
                </div>
              </div>
            )}

            {tab === 'dispensing' && (
              <div className="space-y-5">
                <fieldset>
                  <legend className="mb-2 font-bold text-gray-900 dark:text-white">What does the student receive?</legend>
                  <div role="radiogroup" className="grid gap-3 md:grid-cols-3">
                    {MEDICINE_MODES.map(({ key, title, note, icon: Icon }) => (
                      <label key={key} className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 transition-colors ${mode === key
                        ? 'border-maroon-800 bg-maroon-50 dark:border-maroon-400 dark:bg-maroon-900/20'
                        : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/40'}`}>
                        <input type="radio" name="medicine-mode" value={key} checked={mode === key} onChange={() => { setMode(key); setAdding(false); }} className="mt-1 h-4 w-4 cursor-pointer accent-maroon-800" />
                        <span>
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white"><Icon className="h-4 w-4 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />{title}</span>
                          <span className="mt-0.5 block text-xs text-gray-600 dark:text-gray-300">{note}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {mode === 'dispense' && (<>
                  <section aria-labelledby="prescribed-title">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 id="prescribed-title" className="font-bold text-gray-900 dark:text-white">Medicines to dispense</h3>
                      <button type="button" onClick={() => setAdding(open => !open)} className={`${btn} bg-maroon-800 px-3 py-2 text-white hover:bg-maroon-900`}>
                        <Plus className="h-4 w-4" /> Add Medicine
                      </button>
                    </div>

                    {adding && (
                      <div className="mb-3 space-y-3 rounded-[10px] border border-maroon-100 bg-maroon-50/40 p-3 dark:border-maroon-900/40 dark:bg-maroon-900/10">
                        {item.medicine ? (
                          <div className="flex items-center justify-between gap-2 rounded-[10px] bg-white px-3 py-2 text-sm dark:bg-gray-800">
                            <span><span className="font-semibold text-gray-900 dark:text-white">{item.medicine.name}</span> <span className="text-gray-600 dark:text-gray-300">· {item.medicine.quantity} {item.medicine.unit} in stock</span></span>
                            <button type="button" onClick={() => setItem(EMPTY_ITEM)} className="cursor-pointer text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300">Change</button>
                          </div>
                        ) : (
                          <div>
                            <div className="relative">
                              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                              <input value={medSearch} onChange={e => setMedSearch(e.target.value)} className={`${input} pl-9`} placeholder="Search the inventory…" aria-label="Search medicines" autoFocus />
                            </div>
                            <ul className="mt-2 max-h-52 divide-y divide-gray-100 overflow-y-auto rounded-[10px] border border-gray-100 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800">
                              {medLoading && <li className="p-3 text-sm text-gray-600 dark:text-gray-300">Loading medicines…</li>}
                              {!medLoading && medicines.length === 0 && <li className="p-3 text-sm text-gray-600 dark:text-gray-300">No medicines found in the inventory.</li>}
                              {!medLoading && medicines.map(m => (
                                <li key={m.id}>
                                  <button type="button" disabled={m.quantity < 1} onClick={() => setItem(current => ({ ...current, medicine: m }))}
                                    className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-700/50">
                                    <span className="text-gray-900 dark:text-white">{m.name}{m.generic_name && <span className="text-gray-600 dark:text-gray-300"> · {m.generic_name}</span>}</span>
                                    <span className="shrink-0 text-xs text-gray-600 dark:text-gray-300">{m.quantity} {m.unit}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_100px_auto] sm:items-end">
                          <label className="block"><span className={label}>Dose / Frequency</span><input value={item.dose} onChange={e => setItem(current => ({ ...current, dose: e.target.value }))} className={input} placeholder="1 tab 3× a day" maxLength={60} /></label>
                          <label className="block"><span className={label}>Duration</span><input value={item.duration} onChange={e => setItem(current => ({ ...current, duration: e.target.value }))} className={input} placeholder="3 days" maxLength={40} /></label>
                          <label className="block"><span className={label}>Qty</span><input inputMode="numeric" maxLength={4} value={item.quantity} onChange={e => setItem(current => ({ ...current, quantity: digitsOnly(e.target.value, 4) }))} className={input} /></label>
                          <button type="button" onClick={addPrescribed} disabled={!item.medicine || !(Number(item.quantity) >= 1)} className={`${btn} bg-maroon-800 px-3 py-2 text-white hover:bg-maroon-900`}><Plus className="h-4 w-4" /> Add</button>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto rounded-[10px] border border-gray-100 dark:border-gray-700">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs font-medium text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                          <tr>{['Medicine', 'Dose / Frequency', 'Duration', 'Qty', ''].map(h => <th key={h || 'action'} scope="col" className="whitespace-nowrap px-4 py-2.5">{h || <span className="sr-only">Remove</span>}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {prescribed.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300">No medicine added yet. Use Add Medicine to pick from the inventory.</td></tr>
                          ) : prescribed.map(p => (
                            <tr key={p.id}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{p.name}</td>
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{p.dose || '—'}</td>
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{p.duration || '—'}</td>
                              <td className="px-4 py-2.5 tabular-nums text-gray-900 dark:text-white">{p.quantity}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button type="button" onClick={() => setPrescribed(current => current.filter(x => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="cursor-pointer rounded-[10px] p-1.5 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  {prescribed.length > 0 && (
                    <section aria-labelledby="inventory-title">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <h3 id="inventory-title" className="font-bold text-gray-900 dark:text-white">Medicine Inventory <span className="text-sm font-normal text-gray-600 dark:text-gray-300">(deducted on save)</span></h3>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${allInStock
                          ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800/30 dark:bg-green-900/20 dark:text-green-400'
                          : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800/30 dark:bg-red-900/20 dark:text-red-400'}`}>
                          {allInStock ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}{allInStock ? 'Sufficient stock' : 'Insufficient stock'}
                        </span>
                      </div>
                      <div className="overflow-x-auto rounded-[10px] border border-gray-100 dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-gray-50 text-xs font-medium text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                            <tr>{['Medicine', 'In Stock', 'Needed', 'Unit', 'Status'].map(h => <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5">{h}</th>)}</tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {stockRows.map(row => (
                              <tr key={row.id}>
                                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{row.name}</td>
                                <td className="px-4 py-2.5 tabular-nums text-gray-700 dark:text-gray-300">{row.stock ?? '…'}</td>
                                <td className="px-4 py-2.5 tabular-nums text-gray-700 dark:text-gray-300">{row.needed}</td>
                                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{row.unit || '—'}</td>
                                <td className="px-4 py-2.5">{row.enough === null ? <span className="text-xs text-gray-600">Checking…</span>
                                  : row.enough ? <CheckCircle className="h-4 w-4 text-green-700" aria-label="Enough stock" /> : <XCircle className="h-4 w-4 text-red-700" aria-label="Not enough stock" />}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>)}

                {mode === 'prescription' && (
                  <section aria-labelledby="rx-title">
                    <h3 id="rx-title" className="mb-3 font-bold text-gray-900 dark:text-white">Prescription</h3>
                    <div className="mb-3 grid gap-3 rounded-[10px] border border-maroon-100 bg-maroon-50/40 p-3 dark:border-maroon-900/40 dark:bg-maroon-900/10 sm:grid-cols-[2fr_1.2fr_1fr_90px_auto] sm:items-end">
                      <label className="block"><span className={label}>Medicine *</span><input value={rxItem.name} onChange={e => setRxItem(current => ({ ...current, name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRx(); } }} className={input} placeholder="e.g. Paracetamol 500 mg" maxLength={120} /></label>
                      <label className="block"><span className={label}>Dose / Frequency</span><input value={rxItem.dose} onChange={e => setRxItem(current => ({ ...current, dose: e.target.value }))} className={input} placeholder="1 tab 3× a day" maxLength={60} /></label>
                      <label className="block"><span className={label}>Duration</span><input value={rxItem.duration} onChange={e => setRxItem(current => ({ ...current, duration: e.target.value }))} className={input} placeholder="3 days" maxLength={40} /></label>
                      <label className="block"><span className={label}>Qty</span><input inputMode="numeric" value={rxItem.quantity} onChange={e => setRxItem(current => ({ ...current, quantity: digitsOnly(e.target.value, 4) }))} className={input} placeholder="optional" maxLength={4} /></label>
                      <button type="button" onClick={addRx} disabled={!rxItem.name.trim()} className={`${btn} bg-maroon-800 px-3 py-2 text-white hover:bg-maroon-900`}><Plus className="h-4 w-4" /> Add</button>
                    </div>
                    <div className="overflow-x-auto rounded-[10px] border border-gray-100 dark:border-gray-700">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-xs font-medium text-gray-600 dark:bg-gray-900/50 dark:text-gray-300">
                          <tr>{['Medicine', 'Dose / Frequency', 'Duration', 'Qty', ''].map(h => <th key={h || 'action'} scope="col" className="whitespace-nowrap px-4 py-2.5">{h || <span className="sr-only">Remove</span>}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {rx.length === 0 ? (
                            <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-300">No prescription added yet.</td></tr>
                          ) : rx.map(p => (
                            <tr key={p.id}>
                              <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">{p.name}</td>
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{p.dose || '—'}</td>
                              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{p.duration || '—'}</td>
                              <td className="px-4 py-2.5 tabular-nums text-gray-900 dark:text-white">{p.quantity || '—'}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button type="button" onClick={() => setRx(current => current.filter(x => x.id !== p.id))} aria-label={`Remove ${p.name}`} className="cursor-pointer rounded-[10px] p-1.5 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <div>
                  <label htmlFor="visit-dispense-notes" className={label}>Notes (optional)</label>
                  <textarea id="visit-dispense-notes" value={dispenseNotes} onChange={e => setDispenseNotes(e.target.value)} rows={2} maxLength={TEXT_LIMIT} className={input} placeholder="e.g. Advised to rest and drink plenty of water" />
                  <Counter value={dispenseNotes} />
                </div>
              </div>
            )}

            {tab === 'review' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">{reviewDocs.length > 1 ? 'Review Documents' : 'Review Consultation Form'}</h3>

                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {reviewDocs.length > 1
                    ? `These are the ${reviewDocs.length} documents for this visit, as they will print. Check each one, then confirm to save the visit.`
                    : "This is the clinic's Consultation Form as it will print. Check it, then confirm to save the visit."}
                </p>

                {/* More than one document: page through them (Previous / Next, or pick one). */}
                {reviewDocs.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
                    <div role="tablist" aria-label="Document to preview" className="flex flex-wrap gap-1.5">
                      {reviewDocs.map((d, i) => {
                        const active = i === docIndex;
                        return (
                          <button key={d.kind} type="button" role="tab" aria-selected={active} onClick={() => setPreviewDoc(d.kind)}
                            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-semibold transition ${active
                              ? 'bg-maroon-800 text-white'
                              : 'text-gray-700 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800'}`}>
                            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${active ? 'bg-white/20' : 'bg-gray-200 dark:bg-gray-700'}`}>{i + 1}</span>
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">Page {docIndex + 1} of {reviewDocs.length}</span>
                      <button type="button" onClick={() => setPreviewDoc(reviewDocs[docIndex - 1].kind)} disabled={docIndex === 0} aria-label="Previous document"
                        className="cursor-pointer rounded-[10px] border border-gray-200 bg-white p-1.5 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={() => setPreviewDoc(reviewDocs[docIndex + 1].kind)} disabled={docIndex === reviewDocs.length - 1} aria-label="Next document"
                        className="cursor-pointer rounded-[10px] border border-gray-200 bg-white p-1.5 text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}

                {preview === null ? (
                  <div role="status" className="flex items-center justify-center gap-2 rounded-[10px] border border-gray-100 py-16 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300"><Loader2 className="h-4 w-4 animate-spin" /> Preparing the {currentDoc.label}…</div>
                ) : preview === '' ? (
                  <p role="alert" className="rounded-[10px] bg-red-50 p-4 text-sm font-medium text-red-800 dark:bg-red-900/20 dark:text-red-300">The form preview could not be loaded. You can still save the visit and print it afterwards.</p>
                ) : (
                  <iframe
                    ref={previewFrame}
                    title={`${currentDoc.label} preview`}
                    srcDoc={preview}
                    sandbox="allow-same-origin"
                    onLoad={fitPreview}
                    style={{ height: previewHeight }}
                    className="w-full rounded-[10px] border border-gray-200 bg-[#f4f1f0] dark:border-gray-600"
                  />
                )}

                {mode === 'dispense' && prescribed.length > 0 && !allInStock && (
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> Some medicines are low on stock. Adjust them in the Medicines step before saving.</p>
                )}
                {missingCount > 0 && (
                  <p role="alert" className="flex items-center gap-1.5 text-sm font-semibold text-red-700 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> {missingCount} required {missingCount === 1 ? 'field is' : 'fields are'} still empty. Go back to the Consult Form step.</p>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-300">Saved consultations are read-only. {mode === 'dispense' ? 'Medicines to dispense are deducted from stock when you confirm.' : mode === 'prescription' ? 'The prescription is saved with the notes; nothing is deducted from stock.' : ''}</p>
              </div>
            )}
          </div>

          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
            {/* Temporary: saved on the server until the consultation is confirmed, not in the patient's records. */}
            {draftInfo?.saved_at && (
              <span className="mr-auto text-xs text-gray-500 dark:text-gray-400">
                Draft saved {new Date(draftInfo.saved_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{draftInfo.saved_by ? ` by ${draftInfo.saved_by}` : ''}
              </span>
            )}
            <button type="button" onClick={saveDraft} disabled={savingDraft} className={outline}
              title="Saves what you typed so far. Continue later on any device; it is not in the patient's records until you confirm the consultation.">
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save progress as draft
            </button>
            {tab !== 'review' && <button type="button" onClick={() => goTo('review')} className={outline}><Eye className="h-4 w-4" /> Preview</button>}
            {nextTab && (
              <button type="button" onClick={() => goTo(nextTab.key)} className={primary}>Next: {nextTab.label} <ArrowRight className="h-4 w-4" /></button>
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
