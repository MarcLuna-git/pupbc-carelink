import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, CalendarDays, GraduationCap, Mail, Pencil, Phone, RefreshCw, Shield, User } from 'lucide-react';
import api from '../../../services/api';

const valueOrDash = (value) => value || 'Not provided';
const fullName = (user) => [user.first_name, user.middle_name, user.last_name, user.suffix].filter(Boolean).join(' ');
const normalizeProfile = (payload) => {
  const user = payload?.user || {};
  const profile = payload?.profile || user.profile || {};
  return { ...user, profile: { ...(user.profile || {}), ...profile }, mobile_number: profile.mobile_number ?? user.mobile_number ?? '' };
};
const Detail = ({ label, value, className = '' }) => <div className={`min-w-0 ${className}`}><dt className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-gray-100">{valueOrDash(value)}</dd></div>;

const Profile = () => {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const loadProfile = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await api.get('/student/profile');
      if (!response.data?.success) throw new Error();
      const normalized = normalizeProfile(response.data.data);
      setStudent(normalized);
      localStorage.setItem('user', JSON.stringify(normalized));
      window.dispatchEvent(new Event('studentProfileUpdated'));
    } catch { setError('We could not load your profile. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) return <div className="mx-auto max-w-5xl space-y-5 p-4 pb-28 sm:p-6 lg:pb-8"><div className="h-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" /><div className="grid gap-5 lg:grid-cols-2"><div className="h-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" /><div className="h-64 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-800" /></div></div>;
  if (error || !student) return <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center p-6 text-center"><AlertCircle className="h-10 w-10 text-red-500" /><h1 className="mt-3 text-lg font-semibold text-gray-900 dark:text-white">Profile unavailable</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{error}</p><button onClick={loadProfile} className="mt-4 inline-flex items-center gap-2 rounded-md bg-maroon-800 px-4 py-2 text-sm font-semibold text-white hover:bg-maroon-900"><RefreshCw className="h-4 w-4" /> Retry</button></div>;

  const profile = student.profile || {};
  const avatar = profile.profile_picture;
  const academic = [student.course || profile.course, student.year || profile.year, student.section || profile.section].filter(Boolean).join(' / ');
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-28 sm:p-6 lg:pb-8">
      <header className="flex flex-col gap-5 border-b border-gray-200 pb-6 dark:border-gray-700 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4"><div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-maroon-100 text-maroon-800 dark:bg-maroon-950 dark:text-maroon-300">{avatar ? <img src={avatar} alt="Profile" className="h-full w-full object-cover" /> : <User className="h-9 w-9" />}</div><div className="min-w-0"><h1 className="break-words text-2xl font-bold text-gray-950 dark:text-white">{fullName(student)}</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Student ID: {valueOrDash(student.student_id)}</p><p className="mt-1 break-words text-sm text-gray-500 dark:text-gray-400">{valueOrDash(academic)}</p></div></div>
        <Link to="/student/profile/edit" className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900 sm:self-center"><Pencil className="h-4 w-4" /> Edit profile</Link>
      </header>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="border-b border-gray-200 pb-5 dark:border-gray-700 lg:border-b-0 lg:border-r lg:pr-6"><h2 className="flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white"><GraduationCap className="h-5 w-5 text-maroon-700 dark:text-maroon-400" /> Student information</h2><dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2"><Detail label="First name" value={student.first_name} /><Detail label="Middle name" value={student.middle_name} /><Detail label="Last name" value={student.last_name} /><Detail label="Student ID" value={student.student_id} /><Detail label="Course" value={student.course || profile.course} /><Detail label="Year level" value={student.year || profile.year} /><Detail label="Section" value={student.section || profile.section} /><Detail label="Gender" value={student.gender || profile.gender} /><Detail label="Birthday" value={student.birthday || profile.birthday} /><Detail label="Email" value={student.email} /></dl><p className="mt-5 flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /> Student identity and academic details are managed by the institution.</p></section>
        <div className="space-y-7"><section><h2 className="flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white"><Phone className="h-5 w-5 text-maroon-700 dark:text-maroon-400" /> Contact information</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><Detail label="Mobile number" value={student.mobile_number} /><Detail label="Address" value={profile.address} className="sm:col-span-2" /></dl></section><section className="border-t border-gray-200 pt-6 dark:border-gray-700"><h2 className="flex items-center gap-2 text-base font-semibold text-gray-950 dark:text-white"><Shield className="h-5 w-5 text-maroon-700 dark:text-maroon-400" /> Guardian information</h2><dl className="mt-4 grid gap-5 sm:grid-cols-2"><Detail label="Guardian name" value={profile.guardian_name} /><Detail label="Relationship" value={profile.guardian_relationship} /><Detail label="Contact number" value={profile.guardian_contact} /></dl></section><div className="flex items-center gap-2 border-t border-gray-200 pt-5 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"><Mail className="h-4 w-4" /> Contact details can be updated from Edit profile.</div></div>
      </div>
    </div>
  );
};
export default Profile;
