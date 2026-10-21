import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BriefcaseMedical,
  CalendarCheck,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  Lock,
  Pencil,
  Phone,
  Pill,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import api from '../../../services/api';
import StudentPageHero, { HeroRefreshButton } from '../../../components/StudentPageHero';
import { preloadForPath } from '../../../utils/preloadStudentPages';
import { formatPersonName } from '../../../utils/studentUser';
import { clinicDate } from '../../../utils/appointmentDate';

/*
 * ROUTE LOADING — same restored effect as the Settings page, scoped to this
 * page. TEMP DEMO TIMER: holds the loading phase so the animation is visible
 * even though /student/profile usually answers in milliseconds on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const CARD = 'rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface)]';

const PROFILE_EDIT = '/student/profile/edit';
// Health Profile form steps: 1 Emergency, 2 Medical, 3 History, 4 Personal, 5 Family.
const healthProfileStep = (step) => `/student/health-profile?step=${step}`;

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
    return JSON.parse(localStorage.getItem('user') || '{}');
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
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />
);

/* One "My Health Profile" section card: title, Edit link and label/value rows. */
const InfoCard = ({ icon: Icon, title, editTo, rows, footer }) => (
  <section className="flex flex-col rounded-xl border border-[var(--sp-border)] p-4 sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2.5 font-bold text-maroon-800 dark:text-maroon-300">
        <Icon className="h-5 w-5" />
        {title}
      </h3>
      {editTo && (
        <Link
          to={editTo}
          onMouseEnter={() => preloadForPath(editTo.split('?')[0])}
          onFocus={() => preloadForPath(editTo.split('?')[0])}
          aria-label={`Edit ${title}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sp-border)] px-3 py-1.5 text-xs font-semibold text-maroon-800 transition hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      )}
    </div>
    <dl className="grid flex-1 grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] content-start gap-x-4 gap-y-2.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-gray-500 dark:text-gray-400">{label}</dt>
          <dd className={`break-words ${value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
            {value || 'Not provided'}
          </dd>
        </div>
      ))}
    </dl>
    {footer && <p className="mt-4 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">{footer}</p>}
  </section>
);

/* Placeholder card shown where Health Profile data is needed but missing. */
const HealthProfileMissingCard = ({ icon: Icon, title }) => (
  <section className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 p-5 text-center dark:border-gray-700">
    <Icon className="h-6 w-6 text-gray-300 dark:text-gray-600" />
    <p className="font-semibold text-gray-700 dark:text-gray-300">{title}</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">Complete your Health Profile to fill this in.</p>
    <Link to="/student/health-profile" className="mt-1 text-xs font-semibold text-maroon-800 hover:underline dark:text-maroon-300">
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
  <div className="flex items-start gap-3.5 rounded-xl border border-[var(--sp-border)] p-4">
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  /* Cosmetic hold for the route-loading animation — see ROUTE LOADING note. */
  const [routeReady, setRouteReady] = useState(false);

  const loadOverview = useCallback(async ({ refresh = false } = {}) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
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
      localStorage.setItem('user', JSON.stringify(normalized));
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
      setRefreshing(false);
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

  /* Profile completeness — the share of these items that are filled in. */
  const completion = useMemo(() => {
    if (!student) return { percent: 0, next: null };
    const checks = [
      [profile.profile_picture, PROFILE_EDIT],
      [student.mobile_number, PROFILE_EDIT],
      [profile.address, PROFILE_EDIT],
      [student.email, PROFILE_EDIT],
      [student.birthday || profile.birthday, null],
      [student.gender || profile.gender, null],
      [contact.name || hp.emergency_name, healthProfileStep(1)],
      [contact.phone || hp.emergency_phone, healthProfileStep(1)],
      [hasHealthProfile && hp.completed_at, '/student/health-profile'],
    ];
    const done = checks.filter(([value]) => Boolean(value)).length;
    const next = checks.find(([value, to]) => !value && to)?.[1] || null;
    return { percent: Math.round((done / checks.length) * 100), next };
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

  const errorView = (
    <div className="w-full min-w-0 space-y-3">
      <StudentPageHero id="profile-title" eyebrow="Student profile" title="Profile" description="View your personal information and Health Profile." />
      <div className={`${CARD} mx-auto flex min-h-[40vh] flex-col items-center justify-center p-6 text-center`}>
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h2 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">Profile unavailable</h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{error}</p>
        <button onClick={() => loadOverview()} className="mt-4 inline-flex items-center gap-2 rounded-md bg-maroon-800 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-900">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    </div>
  );

  /* Failed fetch → error right away; never wait on the demo timer to show it. */
  if (error && !loading) return errorView;

  /*
   * LOADING PHASE — the hero is real (name from the stored session), with
   * the looping progress bar on its bottom edge ONLY. The health profile
   * cards and summary render as 1:1 ghosts.
   */
  if (loading || !routeReady) {
    const stored = readStoredUser();
    return (
      <div className="w-full min-w-0 space-y-3">
        <StudentPageHero
          id="profile-title"
          eyebrow={null}
          title={fullName(stored) || 'Profile'}
          description={[stored.course || stored.profile?.course, formatYearLevel(stored.year || stored.profile?.year)].filter(Boolean).join(' • ') || 'Student'}
          leading={<Avatar src={stored.profile?.profile_picture} />}
          loading
        >
          <Skeleton className="mt-2 h-3.5 w-36" />
          <Skeleton className="mt-3 h-8 w-44 rounded-full" />
        </StudentPageHero>

        <div className={`${CARD} p-4 lg:p-6`}>
          <Skeleton className="mb-2 h-6 w-44" />
          <Skeleton className="mb-5 h-3.5 w-72 max-w-full" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((key) => (
              <div key={key} className="rounded-xl border border-[var(--sp-border)] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-7 w-16 rounded-lg" />
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
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !student) return errorView;

  const course = student.course || profile.course;
  const yearLevel = formatYearLevel(student.year || profile.year);
  const section = student.section || profile.section;
  const firstName = formatPersonName(student.first_name) || 'there';
  const last = summary.last;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="w-full min-w-0 space-y-3"
    >
      <StudentPageHero
        id="profile-title"
        eyebrow={null}
        title={fullName(student)}
        description={[course, yearLevel].filter(Boolean).join(' • ') || 'Student'}
        leading={<Avatar src={profile.profile_picture} />}
        action={<HeroRefreshButton onClick={() => loadOverview({ refresh: true })} refreshing={refreshing} label="Refresh profile" />}
      >
        <p className="text-xs text-gray-700 dark:text-gray-300 sm:text-sm">Student ID: {student.student_id || '—'}</p>
        {completion.next ? (
          <Link
            to={completion.next}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#f6deda] px-3 py-1.5 text-xs font-semibold text-maroon-800 transition hover:bg-[#f1cfc9] dark:bg-maroon-900/40 dark:text-maroon-200 dark:hover:bg-maroon-900/60"
          >
            <ShieldCheck className="h-4 w-4" /> Profile {completion.percent}% Complete <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
            <ShieldCheck className="h-4 w-4" /> Profile 100% Complete
          </span>
        )}
        <p className="mt-3 hidden font-bold text-maroon-800 dark:text-maroon-300 sm:block">Hello, {firstName}!</p>
        <p className="hidden text-xs text-gray-600 dark:text-gray-400 sm:block">Keep your health in check for a brighter tomorrow.</p>
      </StudentPageHero>

      {/* My Health Profile */}
      <div className={`${CARD} p-4 lg:p-6`}>
        <div className="mb-5 flex items-start gap-2.5">
          <ClipboardList className="mt-0.5 h-6 w-6 text-maroon-800 dark:text-maroon-300" />
          <div>
            <h2 className="text-lg font-bold text-maroon-800 dark:text-maroon-300">My Health Profile</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Keep your information up to date for better and safer care.</p>
          </div>
        </div>

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
            editTo={PROFILE_EDIT}
            rows={[
              ['Mobile Number', student.mobile_number],
              ['Email Address', student.email],
              ['Home Address', profile.address],
            ]}
          />

          <InfoCard
            icon={Users}
            title="Emergency Contact"
            editTo={healthProfileStep(1)}
            rows={[
              ['Name', contact.name || hp.emergency_name],
              ['Relationship', contact.relationship || hp.emergency_relationship],
              ['Mobile Number', contact.phone || hp.emergency_phone],
            ]}
          />

          {hasHealthProfile ? (
            <>
              <InfoCard
                icon={HeartPulse}
                title="Health Information"
                editTo={healthProfileStep(2)}
                rows={[
                  ['Known Conditions', listOrNone(hp.medical_history, hp.other_medical_history)],
                  ['Hospitalization', yesNoDetail(hp.hospitalized, hp.hospitalization_diagnosis, hp.hospitalization_date)],
                  ['Surgery', yesNoDetail(hp.surgery, hp.surgery_diagnosis, hp.surgery_date)],
                  ['COVID-19 History', yesNoDetail(hp.had_covid, hp.covid_diagnosis, hp.covid_date)],
                  ['Disability', hp.has_disability ? hp.disability_details || 'Yes' : 'None'],
                ]}
              />

              <InfoCard
                icon={ShieldAlert}
                title="Allergies & Family History"
                editTo={healthProfileStep(2)}
                rows={[
                  ['Allergies', hp.allergy_details || 'None'],
                  ['Family History', listOrNone(hp.family_history)],
                ]}
              />

              <InfoCard
                icon={Pill}
                title="Medications & Lifestyle"
                editTo={healthProfileStep(2)}
                rows={[
                  ['Current Medications', hp.medications || 'None'],
                  ['Tobacco Use', hp.tobacco_use || 'None'],
                  ['Alcohol Use', hp.alcohol_use || 'None'],
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
              <h2 className="text-lg font-bold text-maroon-800 dark:text-maroon-300">Health Summary</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Your key health records at a glance.</p>
            </div>
          </div>
          <Link
            to="/student/health-records"
            onMouseEnter={() => preloadForPath('/student/health-records')}
            className="inline-flex items-center gap-2 rounded-lg border border-maroon-800 px-3 py-2 text-xs font-semibold text-maroon-800 transition hover:bg-maroon-50 dark:border-maroon-700 dark:text-maroon-300 dark:hover:bg-maroon-900/20"
          >
            <FileText className="h-4 w-4" /> View Records <ArrowRight className="h-3.5 w-3.5" />
          </Link>
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
    </motion.div>
  );
};

export default Overview;
