import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseMedical,
  CalendarCheck,
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  HeartPulse,
  Loader2,
  Lock,
  Pencil,
  Phone,
  Pill,
  Save,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import api from '../../../services/api';
import { getUser, setUser } from '../../../services/session';
import StudentPageHero from '../../../components/StudentPageHero';
import HealthProfile from '../HealthProfile/HealthProfile';
import { formatPersonName } from '../../../utils/studentUser';
import { mediaUrl } from '../../../utils/mediaUrl';
import { clinicDate } from '../../../utils/appointmentDate';
import { StudentToast } from '../../../components/StudentFeedback';
import { contactNameError, contactPhoneError, formatContactPhone, ownMobileContactError } from '../../../utils/contactValidation';
import { nameOnly } from '../../../utils/inputFilters';
import PhilippineMobileInput from '../../../components/PhilippineMobileInput';
import { useStudentBreadcrumbTab } from '../../../utils/studentBreadcrumb';

/*
 * ROUTE LOADING — same restored effect as the Settings page, scoped to this
 * page. TEMP DEMO TIMER: holds the loading phase so the animation is visible
 * even though /student/profile usually answers in milliseconds on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const CARD = 'rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)]';


const fullName = (user) =>
  [user.first_name, user.middle_name, user.last_name, user.suffix].filter(Boolean).map(formatPersonName).join(' ');

const normalizeProfile = (payload) => {
  const user = payload?.user || {};
  const profile = payload?.profile || user.profile || {};
  return {
    ...user,
    emergency_contact: payload?.emergency_contact || {},
    profile: { ...(user.profile || {}), ...profile },
    mobile_number: profile.mobile_number ?? user.mobile_number ?? '',
  };
};

const readStoredUser = () => {
  try {
    return getUser('student');
  } catch {
    return {};
  }
};

const formatDate = (value) => {
  if (!value) return '';
  const day = String(value).slice(0, 10);
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' });
};

const formatInstant = (value) => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric', year: 'numeric' });
};

const capitalize = (value) => (value ? String(value).charAt(0).toUpperCase() + String(value).slice(1) : '');

/* "2" → "2nd Year"; anything else is shown as stored. */
const formatYearLevel = (year) => {
  if (!year) return '';
  if (!/^\d+$/.test(String(year))) return String(year);
  const n = Number(year);
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix} Year`;
};

const yesNoDetail = (flag, diagnosis, date) => {
  if (!flag) return 'None';
  const details = [diagnosis, formatDate(date)].filter(Boolean).join(' — ');
  return details ? `Yes — ${details}` : 'Yes';
};

const listOrNone = (items, extra) => {
  const all = [...(Array.isArray(items) ? items : []), extra].filter(Boolean);
  return all.length ? all.join(', ') : 'None';
};

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-[10px] bg-gray-200 dark:bg-gray-700 ${className}`} />
);

const EMERGENCY_RELATIONSHIPS = ['Parent', 'Guardian', 'Sibling', 'Spouse', 'Relative', 'Friend', 'Other'];

const FIELD_CLASS = 'w-full rounded-[10px] border border-slate-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-maroon-800 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white';

// Same choices as the Health Profile form.
const MEDICAL_HISTORY_OPTIONS = [
  'Convulsion / Epilepsy', 'Tonsillitis (Recurrent)', 'Hypertension (High Blood Pressure)',
  'Heart Disease', 'Bronchial Asthma', 'Tuberculosis', 'COVID-19', 'Pneumonia',
  'Bleeding Tendencies', 'Diabetes Mellitus (High Blood Sugar)', 'Kidney Disease',
  'Hernia', 'Hemorrhoids (Almoranas)',
];
const FAMILY_HISTORY_OPTIONS = [
  'Hypertension', 'Heart Disease', 'Kidney Problem', 'Anemia',
  'Asthma', 'Diabetes Mellitus', 'Epilepsy', 'Tuberculosis',
];
const TOBACCO_OPTIONS = ['Never', 'Past', 'Present'];
const ALCOHOL_OPTIONS = ['None', 'Occasional', 'Daily'];
// Yes/No questions that need a date and diagnosis when answered Yes.
const HISTORY_EVENTS = [
  { flag: 'hospitalized', date: 'hospitalization_date', diagnosis: 'hospitalization_diagnosis' },
  { flag: 'surgery', date: 'surgery_date', diagnosis: 'surgery_diagnosis' },
  { flag: 'had_covid', date: 'covid_date', diagnosis: 'covid_diagnosis' },
];

/* Single-choice dropdown with the portal's own arrow. */
const ChoiceButtons = ({ options, value, onSelect, label }) => (
  <span className="relative block">
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(event) => onSelect(event.target.value)}
      className={`${FIELD_CLASS} cursor-pointer appearance-none pr-10`}
    >
      {!options.includes(value) && <option value="">Select</option>}
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
  </span>
);

/* Multi-choice dropdown: the button lists what is picked, the panel holds the checkboxes. */
const CheckList = ({ options, selected, onToggle, label }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => { if (!ref.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${FIELD_CLASS} flex items-center gap-2 pr-10 text-left`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected.length ? '' : 'text-gray-400'}`}>
          {selected.length ? selected.join(', ') : 'Select'}
        </span>
        {selected.length > 1 && <span className="shrink-0 rounded-full bg-maroon-800 px-1.5 text-xs text-white">{selected.length}</span>}
      </button>
      <ChevronDown aria-hidden="true" className={`pointer-events-none absolute right-3.5 top-[1.2rem] h-4 w-4 -translate-y-1/2 text-gray-400 transition dark:text-gray-500 ${open ? 'rotate-180' : ''}`} />
      {open && (
        <ul role="listbox" aria-multiselectable="true" aria-label={label} className="absolute left-0 right-0 top-full z-20 mt-1 grid max-h-60 gap-0.5 overflow-y-auto rounded-[10px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-1.5 shadow-lg">
          {[...new Set([...options, ...selected])].map((option) => {
            const picked = selected.includes(option);
            return (
              <li key={option} role="option" aria-selected={picked}>
                <button
                  type="button"
                  onClick={() => onToggle(option)}
                  className={`flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-sm transition ${picked ? 'bg-gray-50 font-semibold text-maroon-800 dark:bg-gray-900/30 dark:text-maroon-300' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900/30'}`}
                >
                  <span>{option}</span>
                  {picked && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

/* Inline input for one editable InfoCard row. */
const RowEditor = ({ editor, draft, onChange }) => {
  if (editor.render) return editor.render();
  const common = {
    id: `profile-${editor.name}`,
    name: editor.name,
    value: draft[editor.name] ?? '',
    onChange,
    autoComplete: 'off',
    className: FIELD_CLASS,
  };
  if (editor.type === 'textarea') return <textarea {...common} rows={2} maxLength={editor.maxLength} placeholder={editor.placeholder} className={`${FIELD_CLASS} resize-none`} />;
  if (editor.type === 'select') {
    return (
      <span className="relative block">
        <select {...common} className={`${FIELD_CLASS} cursor-pointer appearance-none pr-10`}>
          <option value="">Select</option>
          {common.value && !editor.options.includes(common.value) && <option>{common.value}</option>}
          {editor.options.map((option) => <option key={option}>{option}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
      </span>
    );
  }
  return <input {...common} type="text" inputMode={editor.inputMode} maxLength={editor.maxLength} placeholder={editor.placeholder} />;
};

/*
 * One "My Health Information" section card: title and label/value rows. A row's
 * optional third item is its editor, shown in place of the value while the
 * section is in edit mode.
 */
const InfoCard = ({ icon: Icon, title, rows, footer, editing = false, draft = {}, onChange, fieldErrors = {} }) => (
  <section className="flex flex-col rounded-[10px] border border-[var(--sp-border)] p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2.5 font-bold text-gray-900 dark:text-white">
        <Icon className="h-5 w-5 shrink-0 text-maroon-800 dark:text-maroon-300" />
        {title}
      </h3>
    </div>
    <dl className={`grid flex-1 grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] content-start gap-x-4 gap-y-2.5 text-sm ${editing ? 'items-start' : 'items-center'}`}>
      {rows.map(([label, value, editor]) => (
        <div key={label} className="contents">
          <dt className={`text-gray-500 dark:text-gray-400 ${editing && editor ? 'pt-2' : ''}`}>
            {editing && editor && !editor.render ? <label htmlFor={`profile-${editor.name}`}>{label}</label> : label}
          </dt>
          <dd className={`break-words ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
            {editing && editor ? <><RowEditor editor={editor} draft={draft} onChange={onChange} />{fieldErrors[editor.name] && <p role="alert" className="mt-1 text-xs text-red-600">{fieldErrors[editor.name]}</p>}</> : value || 'Not provided'}
          </dd>
        </div>
      ))}
    </dl>
    {footer && <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">{footer}</p>}
  </section>
);

/* Placeholder card shown where Health Profile data is needed but missing. */
const HealthProfileMissingCard = ({ icon: Icon, title }) => (
  <section className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-gray-200 p-5 text-center dark:border-gray-700">
    <Icon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
    <p className="font-semibold text-gray-700 dark:text-gray-300">{title}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">Complete your Health Profile to fill this in.</p>
    <Link to="/student/profile?view=health-profile" className="mt-1 text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300">
      Complete Health Profile
    </Link>
  </section>
);

const BADGE_TONES = {
  good: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  warn: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
  muted: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const SummaryTile = ({ icon: Icon, title, badge, tone, lines }) => (
  <div className="flex items-start gap-3.5 rounded-[10px] border border-[var(--sp-border)] p-4">
    <Icon className="mt-0.5 h-7 w-7 shrink-0 text-maroon-700 dark:text-maroon-300" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
          {badge}
        </span>
      </div>
      {lines.filter(Boolean).map((line) => (
        <p key={line} className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{line}</p>
      ))}
    </div>
  </div>
);

const Avatar = ({ src, size = 'h-24 w-24 sm:h-28 sm:w-28' }) => (
  <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-maroon-100 text-maroon-800 shadow-md dark:border-gray-800 dark:bg-maroon-950 dark:text-maroon-300 ${size}`}>
    {src ? <img src={src} alt="Profile" className="h-full w-full object-cover" /> : <User className="h-10 w-10" />}
  </div>
);

const Overview = () => {
  const [student, setStudent] = useState(null);
  const [healthProfile, setHealthProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /* Cosmetic hold for the route-loading animation — see ROUTE LOADING note. */
  const [routeReady, setRouteReady] = useState(false);
  const photoInputRef = useRef(null);

  /*
   * One Profile page, two contents under the same hero: "My Health
   * Information" (default) and the step-by-step "Health Profile" form
   * (?view=health-profile). Switching only changes the search string, so the
   * hero stays mounted and the page never re-runs its route loading.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const showHealthProfile = searchParams.get('view') === 'health-profile';
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Photo and profile-save results show as a toast: { type: 'success' | 'error', text }
  const [notice, setNotice] = useState({ type: 'success', text: '' });
  const showNotice = (type, text) => setNotice({ type, text });

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { showNotice('error', 'Use a JPG, PNG, or WebP image.'); return; }
    if (file.size > 2 * 1024 * 1024) { showNotice('error', 'Image must be less than 2MB.'); return; }

    setNotice({ type: 'success', text: '' });
    setUploadingPhoto(true);
    try {
      const data = new FormData();
      data.append('avatar', file);
      const response = await api.post('/student/profile/avatar', data);
      const url = response.data?.data?.profile_picture;
      if (!url) throw new Error();
      const updated = { ...student, profile: { ...(student?.profile || {}), profile_picture: url } };
      setStudent(updated);
      setUser({ ...readStoredUser(), ...updated }, 'student');
      window.dispatchEvent(new Event('studentProfileUpdated'));
      showNotice('success', 'Profile photo updated.');
    } catch (err) {
      showNotice('error', err.response?.data?.errors?.avatar?.[0] || 'We could not upload your photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  /* Avatar menu: Upload photo / Remove photo. */
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const photoMenuRef = useRef(null);
  useEffect(() => {
    if (!photoMenuOpen) return undefined;
    const closeOnOutside = (event) => { if (!photoMenuRef.current?.contains(event.target)) setPhotoMenuOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setPhotoMenuOpen(false); };
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [photoMenuOpen]);

  const choosePhoto = () => {
    setPhotoMenuOpen(false);
    photoInputRef.current?.click();
  };

  const removePhoto = async () => {
    setPhotoMenuOpen(false);
    if (!window.confirm('Remove your profile photo?')) return;
    setNotice({ type: 'success', text: '' });
    setUploadingPhoto(true);
    try {
      await api.delete('/student/profile/avatar');
      const updated = { ...student, profile: { ...(student?.profile || {}), profile_picture: null } };
      setStudent(updated);
      setUser({ ...readStoredUser(), ...updated }, 'student');
      window.dispatchEvent(new Event('studentProfileUpdated'));
      showNotice('success', 'Profile photo removed.');
    } catch {
      showNotice('error', 'We could not remove your photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const loadOverview = useCallback(async ({ refresh = false } = {}) => {
    // A refresh (e.g. after saving) updates in place without the loading state.
    if (!refresh) setLoading(true);
    setError('');
    // Only the profile is required; health data and history fill in when available.
    const [profileResult, healthResult, historyResult] = await Promise.allSettled([
      api.get('/student/profile'),
      api.get('/student/health-profile'),
      api.get('/student/clinic-history'),
    ]);
    try {
      const response = profileResult.status === 'fulfilled' ? profileResult.value : null;
      if (!response?.data?.success) throw new Error();
      const normalized = normalizeProfile(response.data.data);
      /*
       * /student/profile does not include health_profile_completed, and
       * replacing localStorage wholesale would wipe the flag set after a
       * completed Health Profile. Carry the stored value over; App.jsx
       * re-syncs it from the database whenever the status endpoint runs.
       */
      const stored = readStoredUser();
      if (normalized.profile && normalized.profile.health_profile_completed === undefined) {
        normalized.profile.health_profile_completed = stored?.profile?.health_profile_completed;
      }
      setStudent(normalized);
      setUser(normalized, 'student');
      window.dispatchEvent(new Event('studentProfileUpdated'));

      if (healthResult.status === 'fulfilled' && healthResult.value.data?.success) {
        setHealthProfile(healthResult.value.data.data || null);
      }
      if (historyResult.status === 'fulfilled' && historyResult.value.data?.success) {
        const rows = historyResult.value.data.data;
        setHistory(Array.isArray(rows) ? rows : rows?.data || []);
      }
    } catch {
      setError('We could not load your profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  /* Demo timer: keeps the loading phase on screen long enough to see it. */
  useEffect(() => {
    const timer = setTimeout(() => setRouteReady(true), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const profile = student?.profile || {};
  const hp = healthProfile || {};
  const hasHealthProfile = Boolean(healthProfile);
  const contact = student?.emergency_contact || {};

  /* Inline editing of the "My Health Information" cards. */
  const [editing, setEditing] = useState(false);
  useStudentBreadcrumbTab(showHealthProfile ? 'Health Profile' : editing ? 'Edit Profile' : '');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [nameError, setNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [draft, setDraft] = useState({});
  const [healthErrors, setHealthErrors] = useState({});

  const setDraftField = (name, value) => {
    setHealthErrors((current) => ({ ...current, [name]: '' }));
    setDraft((current) => ({ ...current, [name]: value }));
  };
  const toggleDraftItem = (name, item) => {
    const list = draft[name] || [];
    setDraftField(name, list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item]);
  };

  const startEdit = () => {
    setDraft({
      mobile_number: formatContactPhone(student?.mobile_number || '') ?? student?.mobile_number ?? '',
      address: profile.address || '',
      emergency_name: contact.name || hp.emergency_name || '',
      emergency_relationship: contact.relationship || hp.emergency_relationship || '',
      emergency_phone: formatContactPhone(contact.phone || hp.emergency_phone || '') ?? (contact.phone || hp.emergency_phone || ''),
      allergy_details: hp.allergy_details || '',
      medications: hp.medications || '',
      medical_history: Array.isArray(hp.medical_history) ? hp.medical_history : [],
      other_medical_history: hp.other_medical_history || '',
      ...Object.fromEntries(HISTORY_EVENTS.flatMap(({ flag, date, diagnosis }) => [
        [flag, Boolean(hp[flag])], [date, hp[date] || ''], [diagnosis, hp[diagnosis] || ''],
      ])),
      has_disability: Boolean(hp.has_disability),
      disability_details: hp.disability_details || '',
      family_history: Array.isArray(hp.family_history) ? hp.family_history : [],
      tobacco_use: hp.tobacco_use || '',
      tobacco_amount: hp.tobacco_amount || '',
      tobacco_duration: hp.tobacco_duration || '',
      alcohol_use: hp.alcohol_use || '',
    });
    setEditError('');
    setNameError('');
    setPhoneError('');
    setHealthErrors({});
    setEditing(true);
  };

  const cancelEdit = () => {
    if (saving) return;
    setEditing(false);
    setEditError('');
    setNameError('');
    setPhoneError('');
    setHealthErrors({});
  };

  /* Same required fields as the Health Profile form. */
  const validateHealth = (values) => {
    const errors = {};
    if (!values.medical_history.length && !values.other_medical_history) errors.medical_history = 'Select at least one condition or type another illness.';
    HISTORY_EVENTS.forEach(({ flag, date, diagnosis }) => {
      if (!values[flag]) return;
      if (!values[date]) errors[flag] = 'Enter the date and diagnosis.';
      else if (values[date] > clinicDate()) errors[flag] = 'The date cannot be in the future.';
      else if (!values[diagnosis]) errors[flag] = 'Enter the date and diagnosis.';
    });
    if (values.has_disability && !values.disability_details) errors.has_disability = 'Describe the disability.';
    if (!values.allergy_details) errors.allergy_details = 'Enter your allergies, or type None.';
    if (!values.medications) errors.medications = 'Enter your medications, or type None.';
    if (!values.family_history.length) errors.family_history = 'Select at least one condition.';
    if (!values.tobacco_use) errors.tobacco_use = 'Choose an answer.';
    else if (values.tobacco_use !== 'Never' && (!values.tobacco_amount || !values.tobacco_duration)) errors.tobacco_use = 'Enter how much and how long.';
    if (!values.alcohol_use) errors.alcohol_use = 'Choose an answer.';
    return errors;
  };

  const handleDraftChange = (event) => {
    const { name, value } = event.target;
    if (name === 'emergency_name') setNameError('');
    if (name === 'emergency_phone' || name === 'mobile_number') setPhoneError('');
    const next = name === 'mobile_number' || name === 'emergency_phone'
        ? formatContactPhone(value)
        : name === 'emergency_name'
          ? nameOnly(value)
          : value;
    if (next === null) return;
    setDraft((current) => ({ ...current, [name]: next }));
  };

  const saveEdit = async () => {
    if (saving) return;
    const trimmed = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
    setEditError('');
    if (contactPhoneError(trimmed.mobile_number, true)) { setEditError('Use +639XXXXXXXXX for your mobile number.'); return; }
    const invalidName = contactNameError(trimmed.emergency_name, hasHealthProfile);
    if (invalidName) { setNameError(invalidName); return; }
    if (hasHealthProfile && !trimmed.emergency_relationship) { setEditError('Emergency contact name and relationship are required.'); return; }
    const invalidPhone = contactPhoneError(trimmed.emergency_phone, hasHealthProfile);
    if (invalidPhone) { setPhoneError(invalidPhone); return; }
    const ownPhoneError = ownMobileContactError(trimmed.emergency_phone, trimmed.mobile_number);
    if (ownPhoneError) { setPhoneError(ownPhoneError); return; }
    if (hasHealthProfile) {
      const errors = validateHealth(trimmed);
      setHealthErrors(errors);
      if (Object.keys(errors).length) { setEditError('Please fix the highlighted fields.'); return; }
    }

    setSaving(true);
    setEditError('');
    try {
      await api.put('/student/profile', {
        mobile_number: trimmed.mobile_number,
        address: trimmed.address,
        // Without a Health Profile the emergency contact lives on the student profile.
        ...(hasHealthProfile ? {} : {
          guardian_name: trimmed.emergency_name || null,
          guardian_relationship: trimmed.emergency_relationship || null,
          guardian_contact: trimmed.emergency_phone || null,
        }),
      });
      if (hasHealthProfile) {
        await api.put('/student/health-profile', {
          emergency_name: trimmed.emergency_name,
          emergency_relationship: trimmed.emergency_relationship,
          emergency_phone: trimmed.emergency_phone,
          allergy_details: trimmed.allergy_details,
          medications: trimmed.medications,
          medical_history: trimmed.medical_history,
          other_medical_history: trimmed.other_medical_history || null,
          // A "No" answer clears its date and diagnosis.
          ...Object.fromEntries(HISTORY_EVENTS.flatMap(({ flag, date, diagnosis }) => [
            [flag, trimmed[flag]],
            [date, trimmed[flag] ? trimmed[date] : null],
            [diagnosis, trimmed[flag] ? trimmed[diagnosis] : null],
          ])),
          has_disability: trimmed.has_disability,
          disability_details: trimmed.has_disability ? trimmed.disability_details : null,
          family_history: trimmed.family_history,
          tobacco_use: trimmed.tobacco_use,
          tobacco_amount: trimmed.tobacco_use === 'Never' ? null : trimmed.tobacco_amount,
          tobacco_duration: trimmed.tobacco_use === 'Never' ? null : trimmed.tobacco_duration,
          alcohol_use: trimmed.alcohol_use,
        });
        window.dispatchEvent(new CustomEvent('healthProfileUpdated'));
      }
      setEditing(false);
      showNotice('success', 'Your profile was updated.');
      await loadOverview({ refresh: true });
    } catch (err) {
      const responseErrors = err.response?.data?.errors || {};
      const contactError = responseErrors.emergency_name || responseErrors.guardian_name;
      const emergencyPhoneError = responseErrors.emergency_phone || responseErrors.guardian_contact;
      if (contactError) setNameError(Array.isArray(contactError) ? contactError[0] : contactError);
      if (emergencyPhoneError) setPhoneError(Array.isArray(emergencyPhoneError) ? emergencyPhoneError[0] : emergencyPhoneError);
      const messages = Object.entries(responseErrors).filter(([key]) => !['emergency_name', 'guardian_name', 'emergency_phone', 'guardian_contact'].includes(key)).flatMap(([, values]) => values).filter((value) => typeof value === 'string');
      if (messages.length || (!contactError && !emergencyPhoneError)) showNotice('error', messages.join(' ') || err.response?.data?.message || 'We could not save your changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /* Profile completeness — the share of these items that are filled in. */
  const completion = useMemo(() => {
    if (!student) return { percent: 0 };
    const checks = [
      profile.profile_picture,
      student.mobile_number,
      profile.address,
      student.email,
      student.birthday || profile.birthday,
      student.gender || profile.gender,
      contact.name || hp.emergency_name,
      contact.phone || hp.emergency_phone,
      hasHealthProfile && hp.completed_at,
    ];
    const done = checks.filter(Boolean).length;
    return { percent: Math.round((done / checks.length) * 100) };
  }, [student, profile, contact, hp, hasHealthProfile]);

  /* Health summary — derived from clinic history and the Health Profile. */
  const summary = useMemo(() => {
    const visits = [...history].sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
    const last = visits[0] || null;
    const today = clinicDate();
    const upcoming = visits
      .filter((v) => v.follow_up_required && v.follow_up_date && String(v.follow_up_date).slice(0, 10) >= today)
      .map((v) => String(v.follow_up_date).slice(0, 10))
      .sort();
    const conditions = [...(Array.isArray(hp.medical_history) ? hp.medical_history : []), hp.other_medical_history].filter(Boolean);
    return { last, upcoming, conditions, visitCount: visits.length };
  }, [history, hp]);

  const openHealthProfile = () => setSearchParams({ view: 'health-profile' });
  const closeHealthProfile = () => {
    setSearchParams({});
    // The form may have changed what the cards and completion show.
    loadOverview({ refresh: true });
  };

  /*
   * LOADING PHASE — the hero is real right away (name from the stored
   * session) with the looping progress bar on its bottom edge ONLY; the
   * content below renders as 1:1 ghosts.
   */
  const pageLoading = loading || !routeReady;
  const ready = !pageLoading && !error && Boolean(student);
  const heroUser = ready ? student : readStoredUser();
  const heroProfile = heroUser?.profile || {};
  const course = heroUser?.course || heroProfile.course;
  const yearLevel = formatYearLevel(heroUser?.year || heroProfile.year);
  const section = heroUser?.section || heroProfile.section;
  const last = summary.last;

  const errorCard = (
    <div className={`${CARD} mx-auto flex min-h-[40vh] flex-col items-center justify-center p-6 text-center`}>
      <AlertCircle className="h-10 w-10 text-red-500" />
      <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">Profile unavailable</h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{error || 'We could not load your profile. Please try again.'}</p>
      <button onClick={() => loadOverview()} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-maroon-800 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-900">
        Retry
      </button>
    </div>
  );

  const loadingCards = (
    <>
      <div className={`${CARD} p-4 lg:p-6`}>
        <Skeleton className="mb-2 h-6 w-44" />
        <Skeleton className="mb-5 h-3.5 w-72 max-w-full" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <div key={key} className="rounded-[10px] border border-[var(--sp-border)] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-7 w-16 rounded-[10px]" />
              </div>
              <div className="space-y-3">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="flex gap-4">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 flex-1" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={`${CARD} p-4 lg:p-6`}>
        <Skeleton className="mb-5 h-6 w-56" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-20 rounded-[10px]" />
          <Skeleton className="h-20 rounded-[10px]" />
          <Skeleton className="h-20 rounded-[10px]" />
        </div>
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full min-w-0 space-y-3"
    >
      <StudentToast message={notice.text} type={notice.type} onClose={() => setNotice((current) => ({ ...current, text: '' }))} />
      <StudentPageHero
        id="profile-title"
        title={fullName(heroUser || {}) || 'Profile'}
        description={[course, yearLevel].filter(Boolean).join(' • ') || 'Student'}
        loading={pageLoading}
        leading={(
          <div className="relative shrink-0">
            <Avatar src={mediaUrl(heroProfile.profile_picture)} />
            {ready && (
              <>
                <div ref={photoMenuRef} className="absolute bottom-1 right-1">
                  <button
                    type="button"
                    onClick={() => setPhotoMenuOpen((open) => !open)}
                    disabled={uploadingPhoto}
                    aria-label="Profile photo options"
                    aria-haspopup="menu"
                    aria-expanded={photoMenuOpen}
                    title="Profile photo"
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-maroon-800 text-white transition hover:bg-maroon-900 disabled:opacity-60 dark:border-gray-800"
                  >
                    {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  </button>
                  {/* Opens to the right so the hero's rounded edge never clips it. */}
                  {photoMenuOpen && (
                    <div role="menu" className="absolute bottom-0 left-full z-20 ml-2 w-40 overflow-hidden rounded-[10px] border border-[var(--sp-border)] bg-white py-1 text-sm dark:bg-gray-800">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={choosePhoto}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Upload className="h-4 w-4" /> Upload photo
                      </button>
                      {profile.profile_picture && (
                        <button
                          type="button"
                          role="menuitem"
                          onClick={removePhoto}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" /> Remove photo
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
              </>
            )}
          </div>
        )}
      >
        {ready ? (
          <>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300 sm:text-sm">Student ID: {student.student_id || '—'}</p>
          </>
        ) : (
          <>
            <Skeleton className="mt-1 h-4 w-44 max-w-full" />
          </>
        )}
      </StudentPageHero>

      {/* Privacy notice: everything on this page is personal and health information. */}
      <div role="note" className={`${CARD} flex items-start gap-3 p-4 lg:px-6`}>
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-gray-900 dark:text-white">Your information is confidential</p>
          <p className="mt-0.5 text-gray-700 dark:text-gray-300">
            Your profile and health information can only be seen by you and authorized PUP Biñan clinic staff, and are handled
            under the Data Privacy Act of 2012 (RA 10173). Do not share your password or QR code with anyone.
          </p>
        </div>
      </div>

      {/* Profile completion — its own card under the hero. */}
      {ready ? (
        <div className={`${CARD} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between lg:px-6`}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ShieldCheck className={`h-6 w-6 shrink-0 ${completion.percent >= 100 ? 'text-green-600 dark:text-green-400' : 'text-maroon-800 dark:text-maroon-300'}`} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                {completion.percent >= 100 ? 'Your profile is complete' : 'Complete your profile'}
                <span className={completion.percent >= 100 ? 'text-green-700 dark:text-green-400' : 'text-maroon-800 dark:text-maroon-300'}>
                  {completion.percent}%
                </span>
              </p>
              <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div
                  className={`h-full rounded-full ${completion.percent >= 100 ? 'bg-green-600' : 'bg-maroon-800'}`}
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </div>
          </div>
          {/* Opens the Health Profile form under the same hero. */}
          <button
            type="button"
            onClick={showHealthProfile ? closeHealthProfile : openHealthProfile}
            aria-pressed={showHealthProfile}
            className="inline-flex items-center gap-1.5 self-start rounded-[10px] bg-maroon-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:text-gray-300 sm:self-auto"
          >
            {showHealthProfile ? (
              <><ArrowLeft className="h-4 w-4" /> Go Back</>
            ) : (
              'Go'
            )}
          </button>
        </div>
      ) : (
        <div className={`${CARD} flex items-center justify-between gap-3 p-4 lg:px-6`}>
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full max-w-md rounded-full" />
            </div>
          </div>
          <Skeleton className="h-8 w-44 rounded-full" />
        </div>
      )}

      {showHealthProfile ? (
        <HealthProfile onBack={closeHealthProfile} />
      ) : error && !loading ? (
        errorCard
      ) : pageLoading ? (
        loadingCards
      ) : !student ? (
        errorCard
      ) : (
      <>

      {/* My Health Information */}
      <div className={`${CARD} p-4 lg:p-6`}>
        <div className={`mb-5 flex items-start justify-between gap-3 ${editing ? 'flex-wrap' : ''}`}>
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <ClipboardList className="mt-0.5 h-6 w-6 shrink-0 text-maroon-800 dark:text-maroon-300" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Health Information</h2>
                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--sp-border)] bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-900 dark:bg-gray-900/30 dark:text-white">
                  <Lock className="h-3 w-3 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />Confidential
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Keep your information up to date for better and safer care.</p>
            </div>
          </div>
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--sp-border)] px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <X className="h-3.5 w-3.5" /> Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-[10px] bg-maroon-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:text-gray-300 disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              aria-label="Edit health information"
              title="Edit"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--sp-border)] text-maroon-800 transition hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>

        {editError && <p role="alert" className="mb-4 rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{editError}</p>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            icon={User}
            title="Personal Information"
            rows={[
              ['Full Name', fullName(student)],
              ['Date of Birth', formatDate(student.birthday || profile.birthday)],
              ['Sex', capitalize(student.gender || profile.gender)],
              ['Year Level', yearLevel],
              ['Course', course],
              ['Section', section],
            ]}
            footer={<><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Identity and academic details are managed by the institution.</>}
          />

          <InfoCard
            icon={Phone}
            title="Contact Information"
            editing={editing}
            draft={draft}
            onChange={handleDraftChange}
            rows={[
              ['Mobile Number', student.mobile_number, { name: 'mobile_number', render: () => <PhilippineMobileInput id="profile-mobile_number" name="mobile_number" value={draft.mobile_number} onChange={handleDraftChange} autoComplete="off" className={FIELD_CLASS} aria-label="Your mobile number, the 10 digits after +63" /> }],
              ['Email Address', student.email],
              ['Home Address', profile.address, { name: 'address', type: 'textarea', maxLength: 1000, placeholder: 'Enter your address' }],
            ]}
            footer={editing ? <><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Change your email address in Settings.</> : null}
          />

          <InfoCard
            icon={Users}
            title="Emergency Contact"
            editing={editing}
            draft={draft}
            onChange={handleDraftChange}
            fieldErrors={{ emergency_name: nameError, emergency_phone: phoneError }}
            rows={[
              ['Name', contact.name || hp.emergency_name, { name: 'emergency_name', maxLength: 100, placeholder: 'Juan Dela Cruz' }],
              ['Relationship', contact.relationship || hp.emergency_relationship, { name: 'emergency_relationship', type: 'select', options: EMERGENCY_RELATIONSHIPS }],
              ['Mobile Number', contact.phone || hp.emergency_phone, { name: 'emergency_phone', render: () => <PhilippineMobileInput id="profile-emergency_phone" name="emergency_phone" value={draft.emergency_phone} onChange={handleDraftChange} autoComplete="off" className={FIELD_CLASS} aria-label="Emergency contact mobile number, the 10 digits after +63" /> }],
            ]}
          />

          {hasHealthProfile ? (
            <>
              <InfoCard
                icon={HeartPulse}
                title="Health Information"
                editing={editing}
                draft={draft}
                onChange={handleDraftChange}
                fieldErrors={healthErrors}
                rows={[
                  ['Known Conditions', listOrNone(hp.medical_history, hp.other_medical_history), {
                    name: 'medical_history',
                    render: () => (
                      <div className="space-y-2">
                        <CheckList label="Known conditions" options={MEDICAL_HISTORY_OPTIONS} selected={draft.medical_history || []} onToggle={(item) => toggleDraftItem('medical_history', item)} />
                        <input
                          aria-label="Other illness"
                          value={draft.other_medical_history ?? ''}
                          onChange={(event) => setDraftField('other_medical_history', event.target.value)}
                          maxLength={191}
                          placeholder="Other illness (optional)"
                          className={FIELD_CLASS}
                        />
                      </div>
                    ),
                  }],
                  ...[
                    ['Hospitalization', HISTORY_EVENTS[0]],
                    ['Surgery', HISTORY_EVENTS[1]],
                    ['COVID-19 History', HISTORY_EVENTS[2]],
                  ].map(([label, { flag, date, diagnosis }]) => [label, yesNoDetail(hp[flag], hp[diagnosis], hp[date]), {
                    name: flag,
                    render: () => (
                      <div className="space-y-2">
                        <ChoiceButtons label={label} options={['No', 'Yes']} value={draft[flag] ? 'Yes' : 'No'} onSelect={(answer) => setDraftField(flag, answer === 'Yes')} />
                        {draft[flag] && (
                          <>
                            <input type="date" aria-label={`${label} date`} max={clinicDate()} value={draft[date] ?? ''} onChange={(event) => setDraftField(date, event.target.value)} className={FIELD_CLASS} />
                            <input aria-label={`${label} diagnosis`} value={draft[diagnosis] ?? ''} onChange={(event) => setDraftField(diagnosis, event.target.value)} maxLength={191} placeholder="Diagnosis" className={FIELD_CLASS} />
                          </>
                        )}
                      </div>
                    ),
                  }]),
                  ['Disability', hp.has_disability ? hp.disability_details || 'Yes' : 'None', {
                    name: 'has_disability',
                    render: () => (
                      <div className="space-y-2">
                        <ChoiceButtons label="Disability" options={['No', 'Yes']} value={draft.has_disability ? 'Yes' : 'No'} onSelect={(answer) => setDraftField('has_disability', answer === 'Yes')} />
                        {draft.has_disability && (
                          <input aria-label="Disability details" value={draft.disability_details ?? ''} onChange={(event) => setDraftField('disability_details', event.target.value)} maxLength={2000} placeholder="Type of disability" className={FIELD_CLASS} />
                        )}
                      </div>
                    ),
                  }],
                ]}
              />

              <InfoCard
                icon={ShieldAlert}
                title="Allergies & Family History"
                editing={editing}
                draft={draft}
                onChange={handleDraftChange}
                fieldErrors={healthErrors}
                rows={[
                  ['Allergies', hp.allergy_details || 'None', { name: 'allergy_details', maxLength: 191, placeholder: 'Penicillin, Seafood, None' }],
                  ['Family History', listOrNone(hp.family_history), {
                    name: 'family_history',
                    render: () => <CheckList label="Family history" options={FAMILY_HISTORY_OPTIONS} selected={draft.family_history || []} onToggle={(item) => toggleDraftItem('family_history', item)} />,
                  }],
                ]}
              />

              <InfoCard
                icon={Pill}
                title="Medications & Lifestyle"
                editing={editing}
                draft={draft}
                onChange={handleDraftChange}
                fieldErrors={healthErrors}
                rows={[
                  ['Current Medications', hp.medications || 'None', { name: 'medications', type: 'textarea', maxLength: 2000, placeholder: 'List medications or type None' }],
                  ['Tobacco Use', hp.tobacco_use || 'None', {
                    name: 'tobacco_use',
                    render: () => (
                      <div className="space-y-2">
                        <ChoiceButtons label="Tobacco use" options={TOBACCO_OPTIONS} value={draft.tobacco_use} onSelect={(answer) => setDraftField('tobacco_use', answer)} />
                        {draft.tobacco_use && draft.tobacco_use !== 'Never' && (
                          <>
                            <input aria-label="How much tobacco" value={draft.tobacco_amount ?? ''} onChange={(event) => setDraftField('tobacco_amount', event.target.value)} maxLength={100} placeholder="How much?" className={FIELD_CLASS} />
                            <input aria-label="How long" value={draft.tobacco_duration ?? ''} onChange={(event) => setDraftField('tobacco_duration', event.target.value)} maxLength={100} placeholder="How long?" className={FIELD_CLASS} />
                          </>
                        )}
                      </div>
                    ),
                  }],
                  ['Alcohol Use', hp.alcohol_use || 'None', {
                    name: 'alcohol_use',
                    render: () => <ChoiceButtons label="Alcohol use" options={ALCOHOL_OPTIONS} value={draft.alcohol_use} onSelect={(answer) => setDraftField('alcohol_use', answer)} />,
                  }],
                ]}
              />
            </>
          ) : (
            <>
              <HealthProfileMissingCard icon={HeartPulse} title="Health Information" />
              <HealthProfileMissingCard icon={ShieldAlert} title="Allergies & Family History" />
              <HealthProfileMissingCard icon={Pill} title="Medications & Lifestyle" />
            </>
          )}
        </div>
      </div>

      {/* Health Summary */}
      <div className={`${CARD} p-4 lg:p-6`}>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <BriefcaseMedical className="mt-0.5 h-6 w-6 text-maroon-800 dark:text-maroon-300" />
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Health Summary</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your key health records at a glance.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryTile
            icon={CalendarCheck}
            title="Last Clinic Visit"
            badge={last ? 'Recorded' : 'No visits'}
            tone={last ? 'good' : 'muted'}
            lines={last
              ? [formatInstant(last.occurred_at), last.chief_complaint || last.reason || last.appointment?.service, `${summary.visitCount} visit${summary.visitCount === 1 ? '' : 's'} in total`]
              : ['Your clinic visits will appear here.']}
          />
          <SummaryTile
            icon={CalendarClock}
            title="Follow-ups"
            badge={summary.upcoming.length ? `${summary.upcoming.length} upcoming` : 'Up to date'}
            tone={summary.upcoming.length ? 'warn' : 'good'}
            lines={summary.upcoming.length
              ? [`Next: ${formatDate(summary.upcoming[0])}`, 'Return to the clinic on this date.']
              : ['No follow-up visits scheduled.']}
          />
          <SummaryTile
            icon={HeartPulse}
            title="Health Profile"
            badge={hasHealthProfile && hp.completed_at ? 'Complete' : 'Incomplete'}
            tone={hasHealthProfile && hp.completed_at ? 'good' : 'warn'}
            lines={hasHealthProfile
              ? [
                summary.conditions.length ? `Known conditions: ${summary.conditions.join(', ')}` : 'No known conditions',
                hp.updated_at ? `Last updated: ${formatInstant(hp.updated_at)}` : '',
              ]
              : ['Complete it to unlock appointments and QR check-in.']}
          />
        </div>
      </div>
      </>
      )}
    </motion.div>
  );
};

export default Overview;
