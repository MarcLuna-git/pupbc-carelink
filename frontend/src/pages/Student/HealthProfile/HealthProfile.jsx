import { getUser, setUser } from '../../../services/session';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Check, Loader2, Heart, Shield, ClipboardList, AlertCircle, Info, PenLine, Users } from 'lucide-react';
import api from '../../../services/api';
import { StudentToast } from '../../../components/StudentFeedback';
import { contactNameError, contactPhoneError, formatContactPhone, ownMobileContactError, signatureNameError } from '../../../utils/contactValidation';
import { digitsOnly, nameOnly, wordsOnly } from '../../../utils/inputFilters';
import PhilippineMobileInput from '../../../components/PhilippineMobileInput';

const getManilaDateString = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const fieldSteps = {
  emergency_name: 1, emergency_relationship: 1, emergency_phone: 1,
  medical_history: 2, allergy_details: 2, other_medical_history: 2, medications: 2,
  hospitalized: 3, hospitalization_date: 3, hospitalization_diagnosis: 3,
  surgery: 3, surgery_date: 3, surgery_diagnosis: 3, had_covid: 3, covid_date: 3, covid_diagnosis: 3,
  occupation: 4, marital_status: 4, tobacco_use: 4, tobacco_amount: 4, tobacco_duration: 4,
  alcohol_use: 4, other_substance_use: 4, has_disability: 4, disability_details: 4,
  last_menstrual_period: 4, has_children: 4, number_of_children: 4, age_first_pregnancy: 4,
  gravidity: 4, term: 4, premature: 4, abortion: 4, living_children: 4,
  family_history: 5, consent_signature: 6, consent_date: 6, agree_privacy: 6, agree_terms: 6,
};

const textLimits = {
  emergency_name: 100, emergency_relationship: 100, consent_signature: 191,
  allergy_details: 191, other_medical_history: 191, hospitalization_diagnosis: 191,
  surgery_diagnosis: 191, covid_diagnosis: 191, occupation: 191,
  marital_status: 50, tobacco_use: 20, tobacco_amount: 100, tobacco_duration: 100, alcohol_use: 20,
  medications: 2000, other_substance_use: 2000, disability_details: 2000,
};

const CARD = 'rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)]';

const STEP_ICONS = [Shield, ClipboardList, AlertCircle, Heart, Users, PenLine];

// Header copy for each form step; the card header pages along with the form.
const STEP_HEADERS = [
  { title: 'Emergency Contact', description: 'Who should we contact in case of emergency?' },
  { title: 'Medical History', description: 'Please check all illnesses that apply to you.' },
  { title: 'Hospitalization, Surgery & COVID-19', description: 'All questions are optional.' },
  { title: 'Personal & Social History', description: 'Optional. Helps us provide better care.' },
  { title: 'Family Medical History', description: 'Select any conditions present in your immediate family. Leave unchecked if none are known. You can update this information later.' },
  { title: 'Consent & Signature', description: 'Confirm that your answers are true and sign to finish.' },
];

/*
 * Health Profile content of the Profile page (below the shared hero, in
 * place of "My Health Information"). Kept outside HealthProfile so the form
 * inputs are not remounted (and lose focus) on every keystroke.
 */
const HealthProfileShell = ({ completed, step = null, totalSteps = STEP_HEADERS.length, loading = false, children }) => {
  const header = step ? STEP_HEADERS[step - 1] : null;
  const HeaderIcon = step ? STEP_ICONS[step - 1] : ClipboardList;
  return (
  <section aria-labelledby="health-profile-title" className={`${CARD} p-4 lg:p-6`}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sp-border)] pb-4">
      {loading ? (
        // Ghost of the header while the record loads, like the rest of the page.
        <div className="flex items-start gap-2.5" aria-hidden="true">
          <div className="mt-0.5 h-6 w-6 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
          <div className="space-y-2">
            <div className="h-5 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="h-3.5 w-72 max-w-full animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="h-6 w-52 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      ) : (
      <div className="flex items-start gap-2.5">
        <HeaderIcon className="mt-0.5 h-6 w-6 text-maroon-800 dark:text-maroon-300" />
        <div>
          {header && <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Health Profile · Step {step} of {totalSteps}</p>}
          <h2 id="health-profile-title" className="text-lg font-bold text-maroon-800 dark:text-maroon-300">{header ? header.title : 'Health Profile'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{header ? header.description : 'Your medical information helps the clinic give you safer, faster care.'}</p>
          {/* Only a not-yet-completed profile gets a status label. */}
          {!completed && (
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#f6deda] px-2.5 py-1 text-xs font-semibold text-maroon-800 dark:bg-maroon-900/40 dark:text-maroon-200">
              <Info className="h-3.5 w-3.5" /> Required before booking appointments
            </span>
          )}
        </div>
      </div>
      )}
    </div>
    {children}
  </section>
  );
};

const HealthProfile = ({ onBack }) => {
  const navigate = useNavigate();
  const user = getUser('student');
  const isFemale = user.gender === 'female' || user.gender === 'Female';

  // `?step=N` opens a section directly (the Profile page's Edit buttons).
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(() => {
    const requested = Number(searchParams.get('step'));
    return Number.isInteger(requested) && requested >= 1 && requested <= 6 ? requested : 1;
  });
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileExists, setProfileExists] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const totalSteps = 6;

  const [form, setForm] = useState({
    emergency_name: '', emergency_relationship: '', emergency_phone: '',
    medical_history: [],
    allergy_details: '',
    other_medical_history: '',
    medications: '',
    hospitalized: false, hospitalization_date: '', hospitalization_diagnosis: '',
    surgery: false, surgery_date: '', surgery_diagnosis: '',
    had_covid: false, covid_date: '', covid_diagnosis: '',
    occupation: '', marital_status: '',
    tobacco_use: '', tobacco_amount: '', tobacco_duration: '',
    alcohol_use: '', other_substance_use: '',
    has_disability: false, disability_details: '',
    last_menstrual_period: '', has_children: false, number_of_children: '',
    age_first_pregnancy: '', gravidity: false, term: false, premature: false,
    abortion: false, living_children: false,
    family_history: [],
    consent_signature: '', agree_privacy: false, agree_terms: false,
    consent_date: getManilaDateString(),
  });

  const [errors, setErrors] = useState({});
  const profileCompleted = profileExists && Boolean(user?.profile?.health_profile_completed);

  useEffect(() => {
    let active = true;
    setPageLoading(true);
    setLoadFailed(false);
    api.get('/student/health-profile').then(({ data }) => {
      if (!active) return;
      if (data?.success !== true) throw new Error('Profile could not be loaded');
      setProfileExists(Boolean(data.data));
      if (data.data) {
        setForm(current => Object.fromEntries(Object.entries(current).map(([key, initial]) => {
          let value = data.data[key] ?? initial;
          // A saved profile may contain nulls or JSON-backed list values.
          if (key === 'medical_history' || key === 'family_history') {
            value = Array.isArray(value) ? value : [];
          } else if (key === 'consent_date') {
            value = getManilaDateString();
          } else if (key.includes('date') || key === 'last_menstrual_period') {
            value = typeof value === 'string' ? value.slice(0, 10) : '';
          }
          return [key, value];
        })));
      }
      setMessage('');
    }).catch(() => {
      if (active) {
        // Never show an empty editable form when an existing record may have failed to load.
        setLoadFailed(true);
        setMessageType('error');
        setMessage('Your saved health profile could not be loaded. No changes have been made. Please try again.');
      }
    }).finally(() => { if (active) setPageLoading(false); });
    return () => { active = false; };
  }, [reloadKey]);

  const medicalHistoryList = [
    "Convulsion / Epilepsy", "Tonsillitis (Recurrent)", "Hypertension (High Blood Pressure)",
    "Heart Disease", "Bronchial Asthma", "Tuberculosis", "COVID-19", "Pneumonia",
    "Bleeding Tendencies", "Diabetes Mellitus (High Blood Sugar)", "Kidney Disease",
    "Hernia", "Hemorrhoids (Almoranas)"
  ];

  const familyHistoryList = [
    "Hypertension", "Heart Disease", "Kidney Problem", "Anemia",
    "Asthma", "Diabetes Mellitus", "Epilepsy", "Tuberculosis"
  ];

  const handleMedicalHistoryToggle = (condition) => {
    const current = form.medical_history;
    setForm({ ...form, medical_history: current.includes(condition) ? current.filter(c => c !== condition) : [...current, condition] });
  };

  const handleFamilyHistoryToggle = (condition) => {
    const current = form.family_history;
    setForm({ ...form, family_history: current.includes(condition) ? current.filter(c => c !== condition) : [...current, condition] });
  };

  /*
   * Steps that still have something to fill in (red dot on the step tab):
   * a missing required answer, an unanswered optional question, or a "Yes"
   * without its details.
   */
  const blank = (value) => !String(value ?? '').trim();
  const ownPhoneError = ownMobileContactError(form.emergency_phone, user.mobile_number)
    || ownMobileContactError(form.emergency_phone, user.profile?.mobile_number);
  const stepMissing = {
    1: Boolean(contactNameError(form.emergency_name, true)) || blank(form.emergency_relationship) || Boolean(contactPhoneError(form.emergency_phone, true)) || Boolean(ownPhoneError),
    2: form.medical_history.length === 0 || blank(form.allergy_details) || blank(form.medications),
    3: [['hospitalized', 'hospitalization_date', 'hospitalization_diagnosis'], ['surgery', 'surgery_date', 'surgery_diagnosis'], ['had_covid', 'covid_date', 'covid_diagnosis']]
      .some(([answer, date, diagnosis]) => form[answer] && (blank(form[date]) || blank(form[diagnosis]))),
    4: blank(form.occupation) || blank(form.marital_status) || blank(form.tobacco_use) || blank(form.alcohol_use)
      || (['Past', 'Present'].includes(form.tobacco_use) && (blank(form.tobacco_amount) || blank(form.tobacco_duration)))
      || (form.has_disability && blank(form.disability_details)),
    5: form.family_history.length === 0,
    6: Boolean(signatureNameError(form.consent_signature, user)) || !form.agree_privacy || !form.agree_terms,
  };
  const stepsNeedingInput = new Set(Object.keys(stepMissing).filter((key) => stepMissing[key]).map(Number));

  const validateStep = (s) => {
    const newErrors = {};

    if (s === 1) {
      const nameError = contactNameError(form.emergency_name, true);
      if (nameError) newErrors.emergency_name = nameError;
      if (!form.emergency_relationship.trim()) newErrors.emergency_relationship = 'Relationship is required';
      const phoneError = contactPhoneError(form.emergency_phone, true);
      if (phoneError) newErrors.emergency_phone = phoneError;
      else if (ownPhoneError) newErrors.emergency_phone = ownPhoneError;
    }

    if (s === 6) {
      const signatureError = signatureNameError(form.consent_signature, user);
      if (signatureError) newErrors.consent_signature = signatureError;
      if (!form.agree_privacy) newErrors.agree_privacy = 'You must agree to the Privacy Policy';
      if (!form.agree_terms) newErrors.agree_terms = 'You must agree to the Terms of Service';
    }

    Object.entries(textLimits).forEach(([field, limit]) => {
      if (fieldSteps[field] === s && [...form[field].trim()].length > limit) {
        newErrors[field] = `${field.replaceAll('_', ' ')} must be at most ${limit} characters`;
      }
    });
    ['hospitalization_date', 'surgery_date', 'covid_date', ...(isFemale ? ['last_menstrual_period'] : [])].forEach(field => {
      const value = form[field];
      if (fieldSteps[field] === s && value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value || value > getManilaDateString())) {
        newErrors[field] = `${field.replaceAll('_', ' ')} must be a valid date no later than today`;
      }
    });
    if (s === 4 && isFemale) {
      [['number_of_children', 0, 30], ['age_first_pregnancy', 1, 100]].forEach(([field, min, max]) => {
        if (form[field] !== '' && (!/^\d+$/.test(String(form[field])) || Number(form[field]) < min || Number(form[field]) > max)) {
          newErrors[field] = `${field.replaceAll('_', ' ')} must be a whole number from ${min} to ${max}`;
        }
      });
    }
    if (s === 2 || s === 5) {
      const field = s === 2 ? 'medical_history' : 'family_history';
      if (form[field].some(value => typeof value !== 'string' || [...value].length > 255)) {
        newErrors[field] = 'Each history entry must be text of at most 255 characters';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let formatted = type === 'checkbox' ? checked : value;

    if (name === 'emergency_phone') {
      formatted = formatContactPhone(value);
      if (formatted === null) return;
    }
    // Names take letters only; counts and ages take digits only.
    if (name === 'emergency_name' || name === 'consent_signature') formatted = nameOnly(value);
    if (name === 'occupation') formatted = wordsOnly(value);
    if (name === 'number_of_children' || name === 'age_first_pregnancy') formatted = digitsOnly(value, name === 'number_of_children' ? 2 : 3);

    setForm({ ...form, [name]: formatted });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const nextStep = () => { if (validateStep(step)) { setStep(step + 1); setMessage(''); } };
  const prevStep = () => { setStep(step - 1); setMessage(''); };

  const handleSubmit = async () => {
    if (loading || loadFailed) return;
    for (let currentStep = 1; currentStep <= totalSteps; currentStep++) {
      if (!validateStep(currentStep)) { setStep(currentStep); return; }
    }
    setLoading(true); setMessage('');

    try {
      let payload = { ...form, consent_date: getManilaDateString() };

      if (!isFemale) {
        ['last_menstrual_period','has_children','number_of_children','age_first_pregnancy','gravidity','term','premature','abortion','living_children'].forEach(f => delete payload[f]);
      }

      const response = await api[profileExists ? 'put' : 'post']('/student/health-profile', payload);
      if (!response.data.success) throw new Error('Profile could not be saved');

      if (response.data.success) {
        setProfileExists(true);
        const currentUser = getUser('student');
        setUser({ ...currentUser, profile: { ...(currentUser.profile || {}), health_profile_completed: true } }, 'student');
        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('healthProfileUpdated'));
        setShowCompletion(true);
      }
    } catch (err) {
      setMessageType('error');
      if (err.response?.status === 409 || err.response?.status === 404) setLoadFailed(true);
      const responseErrors = err.response?.data?.errors || {};
      const firstInvalidField = responseErrors.consent_signature ? 'consent_signature' : Object.keys(responseErrors)[0]?.split('.')[0];
      if (fieldSteps[firstInvalidField]) setStep(fieldSteps[firstInvalidField]);
      setErrors(Object.fromEntries(Object.entries(responseErrors).map(([key, values]) => [key, values[0]])));
      const otherErrors = Object.entries(responseErrors).filter(([key]) => fieldSteps[key.split('.')[0]] !== 1 && key.split('.')[0] !== 'consent_signature').flatMap(([, values]) => values);
      setMessage(otherErrors.join(' ') || (Object.keys(responseErrors).length ? '' : err.response?.data?.message || 'Failed to save.'));
    } finally { setLoading(false); }
  };

  const steps = ['Emergency', 'Medical', 'History', 'Personal', 'Family', 'Consent'];
  const summaryErrors = Object.entries(errors).filter(([field, value]) => field !== 'consent_signature' && value).map(([, value]) => value);
  const progress = Math.round((step / totalSteps) * 100);
  const inputClass = (field) => `w-full border rounded-xl px-4 py-3 text-sm dark:bg-gray-700 dark:text-white dark:border-gray-600 focus:outline-none focus:border-maroon-800 transition ${errors[field] ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 bg-white'}`;
  const labelClass = 'text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5';
  const errorClass = 'text-red-500 text-xs mt-0.5';
  const optionalClass = 'text-xs text-gray-600 dark:text-gray-300 ml-1 font-normal italic';

  const YesNoButtons = ({ name, value, onChange }) => (
    <div className="flex items-center space-x-3">
      <button type="button" onClick={() => onChange({...form, [name]: false})} className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${!value ? 'bg-maroon-800 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>No</button>
      <button type="button" onClick={() => onChange({...form, [name]: true})} className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${value ? 'bg-maroon-800 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>Yes</button>
    </div>
  );

  const CheckboxGrid = ({ items, selected, onToggle }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((item) => {
        const isSelected = selected.includes(item);
        return (
          <button key={item} type="button" onClick={() => onToggle(item)}
            className={`flex items-center space-x-3 px-4 py-3 rounded-2xl border text-left text-sm font-medium transition-all ${
              isSelected ? 'bg-maroon-50 border-maroon-300 text-maroon-800 dark:bg-maroon-900/20 dark:border-maroon-600 dark:text-maroon-300'
              : 'bg-white border-gray-200 text-gray-600 hover:border-maroon-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
            }`}>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${isSelected ? 'bg-maroon-800 border-maroon-800 dark:bg-maroon-600 dark:border-maroon-600' : 'border-gray-300 dark:border-gray-500'}`}>
              {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
            </div>
            <span>{item}</span>
          </button>
        );
      })}
    </div>
  );

  if (pageLoading) {
    return (
      <HealthProfileShell loading>
        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]" aria-busy="true">
          <div className="hidden space-y-2 lg:block">
            {steps.map((label) => <div key={label} className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />)}
          </div>
          <div className="space-y-4">
            <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
            {[0, 1, 2].map((key) => <div key={key} className="h-12 animate-pulse rounded-xl bg-gray-200 dark:bg-gray-700" />)}
          </div>
        </div>
      </HealthProfileShell>
    );
  }

  if (loadFailed) {
    return (
      <HealthProfileShell completed={false}>
        <div role="alert" className="space-y-4 py-6 text-center">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto" aria-hidden="true" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Unable to load health profile</h2>
          <p className="text-sm text-gray-700 dark:text-gray-200">Your saved information is safe. To avoid accidentally replacing existing medical information, editing is unavailable until your record loads.</p>
          <button type="button" onClick={() => setReloadKey(key => key + 1)} className="px-5 py-3 rounded-xl bg-maroon-800 text-white font-semibold transition-colors hover:text-gray-300">Try again</button>
        </div>
      </HealthProfileShell>
    );
  }

  if (showCompletion) {
    return (
      <HealthProfileShell completed>
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          role="status"
          className="py-6 text-center lg:py-10"
        >
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-5">
            <Check className="w-10 h-10 text-green-600 dark:text-green-400" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Health Profile Completed!</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
            Your health profile has been saved successfully. You can now book clinic appointments and use other clinic services.
          </p>
          <div className="mx-auto mt-6 max-w-sm space-y-3">
            <button
              type="button"
              onClick={() => navigate('/student/appointments')}
              className="w-full flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-maroon-800 text-white text-sm font-semibold transition-colors hover:text-gray-300"
            >
              <span>Proceed to Appointments</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setShowCompletion(false); setStep(1); setMessage(''); }}
              className="w-full px-5 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition"
            >
              Review my answers
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="block w-full px-5 py-3 text-sm font-semibold text-maroon-800 hover:underline dark:text-maroon-300"
              >
                Back to My Health Information
              </button>
            )}
          </div>
        </motion.div>
      </HealthProfileShell>
    );
  }

  return (
    <HealthProfileShell completed={profileCompleted} step={step} totalSteps={totalSteps}>
      <div>
      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">

        {/* Step list (tablet/desktop). Saved profiles can jump to any step. */}
        <nav aria-label="Health Profile steps" className="hidden lg:block">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Step {step} of {totalSteps}</p>
          <ol className="space-y-1">
            {steps.map((label, index) => {
              const number = index + 1;
              const StepIcon = STEP_ICONS[index];
              const current = number === step;
              const reachable = profileExists || number <= step;
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => { if (reachable) { setStep(number); setMessage(''); } }}
                    disabled={!reachable}
                    aria-current={current ? 'step' : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      current
                        ? 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-200'
                        : reachable
                          ? 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700/50'
                          : 'cursor-not-allowed text-gray-300 dark:text-gray-600'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      current ? 'bg-maroon-800 text-white' : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
                    }`}>
                      <StepIcon className="h-4 w-4" />
                    </span>
                    {label}
                    {stepsNeedingInput.has(number) && (
                      <span className="absolute right-2 top-2 h-3 w-3 rounded-full bg-red-700" title="Some information is still missing">
                        <span className="sr-only">Some information is still missing</span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="min-w-0 lg:border-l lg:border-[var(--sp-border)] lg:pl-6">

        {!profileCompleted && (
          <div className="mb-5 p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 text-sm text-blue-700 dark:text-blue-400 flex items-start space-x-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span>Complete the required fields in each step, then submit to finish your Health Profile.</span>
          </div>
        )}

        <div className="mb-6 lg:hidden">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2"><span>Step {step} of {totalSteps}</span><span>{progress}%</span></div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
            <motion.div className="h-2 bg-maroon-800 rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
          <div className="flex justify-between mt-2">
            {steps.map((s, i) => <span key={i} className={`text-xs font-medium hidden sm:block ${step > i ? 'text-maroon-800 dark:text-maroon-400' : 'text-gray-300 dark:text-gray-600'}`}>{s}</span>)}
            <span className="text-xs font-medium sm:hidden">{steps[step-1]}</span>
          </div>
        </div>

        <StudentToast message={message} type={messageType} onClose={() => setMessage('')} />
        {step !== 1 && summaryErrors.length > 0 && <div role="alert" className="p-3 rounded-2xl text-sm mb-4 bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">{summaryErrors.join('. ')}</div>}

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Full Name <span className="text-red-400">*</span></label>
                  <input className={inputClass('emergency_name')} name="emergency_name" value={form.emergency_name} onChange={handleChange} placeholder="Juan Dela Cruz" maxLength={100} />
                  {errors.emergency_name && <p className={errorClass}>{errors.emergency_name}</p>}
                </div>
                <div>
                  <label className={labelClass}>Relationship <span className="text-red-400">*</span></label>
                  <select className={inputClass('emergency_relationship')} name="emergency_relationship" value={form.emergency_relationship} onChange={handleChange}>
                    {form.emergency_relationship && !['Parent', 'Guardian', 'Sibling', 'Spouse', 'Relative', 'Friend', 'Other'].includes(form.emergency_relationship) && <option>{form.emergency_relationship}</option>}
                    <option value="">Select</option><option>Parent</option><option>Guardian</option><option>Sibling</option><option>Spouse</option><option>Relative</option><option>Friend</option><option>Other</option>
                  </select>
                  {errors.emergency_relationship && <p className={errorClass}>{errors.emergency_relationship}</p>}
                </div>
                <div>
                  <label className={labelClass}>Phone Number <span className="text-red-400">*</span></label>
                  <PhilippineMobileInput className={inputClass('emergency_phone')} name="emergency_phone" value={form.emergency_phone} onChange={handleChange} aria-label="Emergency contact mobile number, the 10 digits after +63" />
                  {errors.emergency_phone && <p className={errorClass}>{errors.emergency_phone}</p>}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-3">A. Past Medical History</label>
                  <CheckboxGrid items={[...new Set([...medicalHistoryList, ...form.medical_history])]} selected={form.medical_history} onToggle={handleMedicalHistoryToggle} />
                  {form.medical_history.length > 0 && <p className="text-xs text-maroon-600 mt-2">Selected: {form.medical_history.join(', ')}</p>}
                </div>
                <div><label className={labelClass}>B. Allergy to <span className={optionalClass}>(optional)</span></label><input className={inputClass('allergy_details')} name="allergy_details" value={form.allergy_details} onChange={handleChange} placeholder="Penicillin, Seafood, Dust, None" maxLength={191} /></div>
                <div><label className={labelClass}>C. Other Illness <span className={optionalClass}>(optional)</span></label><input className={inputClass('other_medical_history')} name="other_medical_history" value={form.other_medical_history} onChange={handleChange} placeholder="Specify other illness..." maxLength={191} /></div>
                <div><label className={labelClass}>D. Current Medications <span className={optionalClass}>(optional)</span></label><input className={inputClass('medications')} name="medications" value={form.medications} onChange={handleChange} placeholder="List medications or type None" maxLength={2000} /></div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {[
                  { label: 'Have you been hospitalized?', name: 'hospitalized', dateName: 'hospitalization_date', diagName: 'hospitalization_diagnosis' },
                  { label: 'Have you undergone surgery?', name: 'surgery', dateName: 'surgery_date', diagName: 'surgery_diagnosis' },
                ].map(item => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl"><span className="text-sm">{item.label}</span><YesNoButtons name={item.name} value={form[item.name]} onChange={setForm} /></div>
                    {form[item.name] && (<><div><label className={labelClass}>Date</label><input type="date" max={getManilaDateString()} className={inputClass(item.dateName)} name={item.dateName} value={form[item.dateName]} onChange={handleChange} /></div><div><label className={labelClass}>Diagnosis</label><input className={inputClass(item.diagName)} name={item.diagName} value={form[item.diagName]} onChange={handleChange} placeholder="Diagnosis..." maxLength={191} /></div></>)}
                  </div>
                ))}
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl"><span className="text-sm">Have you tested positive for COVID-19?</span><YesNoButtons name="had_covid" value={form.had_covid} onChange={setForm} /></div>
                  {form.had_covid && (<><div><label className={labelClass}>Date</label><input type="date" max={getManilaDateString()} className={inputClass('covid_date')} name="covid_date" value={form.covid_date} onChange={handleChange} /></div><div><label className={labelClass}>Diagnosis</label><input className={inputClass('covid_diagnosis')} name="covid_diagnosis" value={form.covid_diagnosis} onChange={handleChange} placeholder="Diagnosis..." maxLength={191} /></div></>)}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <div><label className={labelClass}>Occupation <span className={optionalClass}>(optional)</span></label><input className={inputClass('occupation')} name="occupation" value={form.occupation} onChange={handleChange} placeholder="Your occupation" maxLength={191} /></div>
                <div><label className={labelClass}>Marital Status <span className={optionalClass}>(optional)</span></label><select className={inputClass('marital_status')} name="marital_status" value={form.marital_status} onChange={handleChange}><option value="">Select</option><option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option><option>Prefer not to say</option></select></div>
                <div>
                  <label className={labelClass}>Tobacco Use <span className={optionalClass}>(optional)</span></label>
                  <div className="flex gap-2">{['Never', 'Past', 'Present'].map(opt => <button key={opt} type="button" onClick={() => setForm({...form, tobacco_use: opt})} className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${form.tobacco_use === opt ? 'bg-maroon-800 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'}`}>{opt}</button>)}</div>
                  {(form.tobacco_use === 'Past' || form.tobacco_use === 'Present') && (<div className="grid grid-cols-2 gap-3 mt-3"><div><label className={labelClass}>How much?</label><input className={inputClass('tobacco_amount')} name="tobacco_amount" maxLength={100} value={form.tobacco_amount} onChange={handleChange} /></div><div><label className={labelClass}>How long?</label><input className={inputClass('tobacco_duration')} name="tobacco_duration" maxLength={100} value={form.tobacco_duration} onChange={handleChange} /></div></div>)}
                </div>
                <div><label className={labelClass}>Alcohol Use <span className={optionalClass}>(optional)</span></label><select className={inputClass('alcohol_use')} name="alcohol_use" value={form.alcohol_use} onChange={handleChange}><option value="">Select</option><option>None</option><option>Occasional</option><option>Daily</option></select></div>
                <div><label className={labelClass}>Other Substance Use <span className={optionalClass}>(optional)</span></label><textarea className={inputClass('other_substance_use')} name="other_substance_use" maxLength={2000} value={form.other_substance_use} onChange={handleChange} rows={2} placeholder="Specify if any..." /></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl"><span className="text-sm">Do you have a disability?</span><YesNoButtons name="has_disability" value={form.has_disability} onChange={setForm} /></div>
                  {form.has_disability && <div><label className={labelClass}>Please describe</label><input className={inputClass('disability_details')} name="disability_details" value={form.disability_details} onChange={handleChange} placeholder="Type of disability..." maxLength={2000} /></div>}
                </div>
                {isFemale && (
                  <div className="border-t border-pink-200 dark:border-pink-800/30 pt-4 mt-4">
                    <p className="text-xs font-semibold text-pink-600 dark:text-pink-400 mb-3">Female Health Information <span className={optionalClass}>(optional)</span></p>
                    <div className="space-y-3">
                      <div><label className={labelClass}>Last Menstrual Period</label><input type="date" max={getManilaDateString()} className={inputClass('last_menstrual_period')} name="last_menstrual_period" value={form.last_menstrual_period} onChange={handleChange} /></div>
                      <div className="space-y-2"><div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl"><span className="text-sm">Do you have children?</span><YesNoButtons name="has_children" value={form.has_children} onChange={setForm} /></div>
                        {form.has_children && (<div className="grid grid-cols-2 gap-3"><div><label className={labelClass}>Number of Children</label><input className={inputClass('number_of_children')} name="number_of_children" value={form.number_of_children} onChange={handleChange} inputMode="numeric" maxLength={2} /></div><div><label className={labelClass}>Age on First Pregnancy</label><input className={inputClass('age_first_pregnancy')} name="age_first_pregnancy" value={form.age_first_pregnancy} onChange={handleChange} inputMode="numeric" maxLength={3} /></div></div>)}
                      </div>
                      <div><label className={labelClass}>Obstetric History</label><div className="grid grid-cols-2 gap-2">{[{ name: 'gravidity', label: 'Gravidity' },{ name: 'term', label: 'Term' },{ name: 'premature', label: 'Premature' },{ name: 'abortion', label: 'Abortion' },{ name: 'living_children', label: 'Living Children' }].map(item => (<label key={item.name} className="flex items-center space-x-2 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"><input type="checkbox" name={item.name} checked={form[item.name]} onChange={handleChange} className="w-4 h-4 rounded accent-maroon-800" /><span className="text-xs text-gray-600 dark:text-gray-300">{item.label}</span></label>))}</div></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <CheckboxGrid items={[...new Set([...familyHistoryList, ...form.family_history])]} selected={form.family_history} onToggle={handleFamilyHistoryToggle} />
                {form.family_history.length > 0 && <p className="text-xs text-maroon-600 mt-2">Selected: {form.family_history.join(', ')}</p>}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-2xl p-4 text-xs text-yellow-700 dark:text-yellow-400 leading-relaxed"><strong>Important:</strong> I certify that all information is true. I consent to data processing per RA 10173.</div>
                <div><label className={labelClass}>Full Name (Electronic Signature) <span className="text-red-400">*</span></label><input className={inputClass('consent_signature')} name="consent_signature" value={form.consent_signature} onChange={handleChange} placeholder="Type your full name" maxLength={191} aria-invalid={Boolean(errors.consent_signature)} />{errors.consent_signature && <p role="alert" className={errorClass}>{errors.consent_signature}</p>}</div>
                <div><label className={labelClass}>Date</label><input className={`${inputClass('consent_date')} bg-gray-50 dark:bg-gray-600 text-gray-500 cursor-not-allowed`} value={form.consent_date} disabled /></div>
                <div className="flex items-start space-x-2"><input type="checkbox" name="agree_privacy" checked={form.agree_privacy} onChange={handleChange} className="mt-1 w-4 h-4 rounded accent-maroon-800 flex-shrink-0" /><span className="text-xs text-gray-500 dark:text-gray-400">I agree to the <span className="text-maroon-600 dark:text-maroon-400 underline">Privacy Policy</span> <span className="text-red-400">*</span></span></div>{errors.agree_privacy && <p className={errorClass}>{errors.agree_privacy}</p>}
                <div className="flex items-start space-x-2"><input type="checkbox" name="agree_terms" checked={form.agree_terms} onChange={handleChange} className="mt-1 w-4 h-4 rounded accent-maroon-800 flex-shrink-0" /><span className="text-xs text-gray-500 dark:text-gray-400">I agree to the <span className="text-maroon-600 dark:text-maroon-400 underline">Terms of Service</span> <span className="text-red-400">*</span></span></div>{errors.agree_terms && <p className={errorClass}>{errors.agree_terms}</p>}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          {step > 1 ? <button onClick={prevStep} className="flex items-center space-x-1 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"><ArrowLeft className="w-4 h-4" /><span>Back</span></button> : <div />}
          {step < totalSteps ? (
            <button onClick={nextStep} className="flex items-center space-x-1 px-6 py-2.5 bg-maroon-800 text-white text-sm font-semibold rounded-xl transition-colors hover:text-gray-300"><span>Next</span><ArrowRight className="w-4 h-4" /></button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="flex items-center space-x-1 px-6 py-2.5 bg-maroon-800 text-white text-sm font-semibold rounded-xl transition-colors hover:text-gray-300 disabled:opacity-50">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>{loading ? 'Saving...' : 'Submit Health Profile'}</span>
            </button>
          )}
        </div>

        </div>
      </div>
      </div>
    </HealthProfileShell>
  );
};

export default HealthProfile;
