import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertCircle, CalendarDays, GraduationCap, Mail, Pencil, Phone, RefreshCw, Shield, User } from 'lucide-react';
import api from '../../../services/api';
import ProfileSection from '../../../layouts/StudentLayout/student-shell/ProfileSection';
import { preloadForPath } from '../../../utils/preloadStudentPages';
import { formatPersonName } from '../../../utils/studentUser';

const valueOrDash = (value) => value || 'Not provided';
const fullName = (user) => [user.first_name, user.middle_name, user.last_name, user.suffix].filter(Boolean).map(formatPersonName).join(' ');
const normalizeProfile = (payload) => {
  const user = payload?.user || {};
  const profile = payload?.profile || user.profile || {};
  return { ...user, emergency_contact: payload?.emergency_contact || {}, profile: { ...(user.profile || {}), ...profile }, mobile_number: profile.mobile_number ?? user.mobile_number ?? '' };
};
const Detail = ({ label, value, className = '' }) => <div className={`min-w-0 ${className}`}><dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-gray-100">{valueOrDash(value)}</dd></div>;

/*
 * ROUTE LOADING — same restored effect as the Settings page, scoped to this
 * page. TEMP DEMO TIMER: holds the loading phase so the animation is visible
 * even though /student/profile usually answers in milliseconds on localhost.
 */
const ROUTE_LOADING_DELAY = 1600;

const Skeleton = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700 ${className}`} />
);

/* Ghost of a Detail row (label + value). */
const SkeletonDetail = ({ className = '' }) => (
  <div className={`min-w-0 ${className}`}>
    <Skeleton className="h-3 w-16" />
    <Skeleton className="mt-2 h-3.5 w-28 max-w-full" />
  </div>
);

/* Ghost of a section heading (icon + label). */
const SkeletonSectionTitle = () => (
  <div className="flex items-center gap-2">
    <Skeleton className="h-5 w-5 rounded-md" />
    <Skeleton className="h-4 w-36" />
  </div>
);

/*
 * Standalone page for the "Overview" inner tab of the Profile section.
 * Extracted from the former Profile.jsx — same content and behavior
 * (including preserving the client-side health_profile_completed flag on
 * reload, see loadOverview).
 */
const Overview = () => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  /* Cosmetic hold for the route-loading animation — see ROUTE LOADING note. */
  const [routeReady, setRouteReady] = useState(false);
  const loadOverview = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/student/profile');
      if (!response.data?.success) throw new Error();
      const normalized = normalizeProfile(response.data.data);
      /*
       * /student/profile does not include health_profile_completed, and
       * replacing localStorage wholesale would wipe the flag set after a
       * completed Health Profile. Carry the stored value over; App.jsx
       * re-syncs it from the database whenever the status endpoint runs.
       */
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      if (normalized.profile && normalized.profile.health_profile_completed === undefined) {
        normalized.profile.health_profile_completed = stored?.profile?.health_profile_completed;
      }
      setStudent(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
      window.dispatchEvent(new Event('studentProfileUpdated'));
    } catch { setError('We could not load your profile. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  /* Demo timer: keeps the loading phase on screen long enough to see it. */
  useEffect(() => {
    const timer = setTimeout(() => setRouteReady(true), ROUTE_LOADING_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const errorView = (<ProfileSection><div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center p-6 text-center"><AlertCircle className="h-10 w-10 text-red-500" /><h1 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">Profile unavailable</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{error}</p><button onClick={loadOverview} className="mt-4 inline-flex items-center gap-2 rounded-md bg-maroon-800 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-900"><RefreshCw className="h-4 w-4" /> Retry</button></div></ProfileSection>);

  /* Failed fetch → error right away; never wait on the demo timer to show it. */
  if (error && !loading) return errorView;

  /*
   * LOADING PHASE — the shell hero + tabs are real chrome; the looping
   * progress bar lives ONLY on the hero's bottom edge (same as the Settings
   * hero), never on the forms. The content card holds a 1:1 ghost of the
   * loaded layout. LOADED PHASE fades the real content in below.
   */
  if (loading || !routeReady) {
    return (
      <ProfileSection loading>
        <div className="space-y-5">
          {/* Ghost of the profile header */}
          <header className="flex flex-col gap-5 border-b border-gray-200 pb-6 dark:border-gray-700 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2.5">
                <Skeleton className="h-6 w-48 max-w-full" />
                <Skeleton className="h-3 w-40 max-w-full" />
                <Skeleton className="h-3 w-32 max-w-full" />
              </div>
            </div>
            <Skeleton className="h-11 w-32 shrink-0 self-start rounded-md sm:self-center" />
          </header>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Left — Student information ghost */}
            <section className="border-b border-gray-200 pb-5 dark:border-gray-700 lg:border-b-0 lg:border-r lg:pr-6">
              <SkeletonSectionTitle />
              <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {[...Array(8)].map((_, i) => <SkeletonDetail key={i} />)}
              </div>
              <Skeleton className="mt-5 h-3 w-2/3 max-w-full" />
            </section>

            {/* Right — Contact + Emergency contact ghosts */}
            <div className="space-y-7">
              <section>
                <SkeletonSectionTitle />
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <SkeletonDetail />
                  <SkeletonDetail className="sm:col-span-2" />
                </div>
              </section>
              <section className="border-t border-gray-200 pt-6 dark:border-gray-700">
                <SkeletonSectionTitle />
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  {[...Array(3)].map((_, i) => <SkeletonDetail key={i} />)}
                </div>
              </section>
              <div className="border-t border-gray-200 pt-5 dark:border-gray-700">
                <Skeleton className="h-3 w-3/4 max-w-full" />
              </div>
            </div>
          </div>
        </div>
      </ProfileSection>
    );
  }

  if (error || !student) return errorView;

  const profile = student.profile || {};
  const avatar = profile.profile_picture;
  const contact = student.emergency_contact || {};
  const academic = [student.course || profile.course, student.section || profile.section || student.year || profile.year].filter(Boolean).join(' ');
  return (
    <ProfileSection>
      {/* LOADED PHASE — the real profile fades in once loading completes. */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="space-y-5"
      >
      <header className="flex flex-col gap-5 border-b border-gray-200 pb-6 dark:border-gray-700 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-maroon-800 dark:bg-maroon-950 dark:text-maroon-300">{avatar ? <img src={avatar} alt="Profile" className="h-full w-full object-cover" /> : <User className="h-9 w-9" />}</div><div className="min-w-0"><h1 className="break-words text-2xl font-bold text-gray-950 dark:text-white">{fullName(student)}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Student ID: {valueOrDash(student.student_id)}</p><p className="mt-1 break-words text-sm text-gray-500 dark:text-gray-400">{valueOrDash(academic)}</p></div></div>
        <Link to="/student/profile/edit" onMouseEnter={() => preloadForPath('/student/profile/edit')} onFocus={() => preloadForPath('/student/profile/edit')} className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900 sm:self-center"><Pencil className="h-4 w-4" /> Edit profile</Link>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border-b border-gray-200 pb-5 dark:border-gray-700 lg:border-b-0 lg:border-r lg:pr-6"><h2 className="flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white"><GraduationCap className="h-5 w-5 text-maroon-700 dark:text-maroon-400" /> Student information</h2><dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2"><Detail label="First name" value={student.first_name} /><Detail label="Middle name" value={student.middle_name} /><Detail label="Last name" value={student.last_name} /><Detail label="Student ID" value={student.student_id} /><Detail label="Course and section" value={academic} /><Detail label="Gender" value={student.gender || profile.gender} /><Detail label="Birthday" value={student.birthday || profile.birthday} /><Detail label="Email" value={student.email} /></dl><p className="mt-5 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> Student identity and academic details are managed by the institution.</p></section>
        <div className="space-y-7"><section><h2 className="flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white"><Phone className="h-5 w-5 text-maroon-700 dark:text-maroon-400" /> Contact information</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><Detail label="Mobile number" value={student.mobile_number} /><Detail label="Address" value={profile.address} className="sm:col-span-2" /></dl></section><section className="border-t border-gray-200 pt-6 dark:border-gray-700"><h2 className="flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white"><Shield className="h-5 w-5 text-maroon-700 dark:text-maroon-400" /> Emergency contact</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><Detail label="Contact name" value={contact.name} /><Detail label="Relationship" value={contact.relationship} /><Detail label="Contact number" value={contact.phone} /></dl></section><div className="flex items-center gap-2 border-t border-gray-200 pt-5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"><Mail className="h-4 w-4" /> Email, mobile number, and address can be updated from Edit profile. Emergency contact details are managed in your Health Profile.</div></div>
      </div>
      </motion.div>
    </ProfileSection>
  );
};

export default Overview;
