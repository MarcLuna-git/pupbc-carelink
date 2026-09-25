import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Layers, Loader2, Plus, RefreshCw, Save } from 'lucide-react';
import api from '../../../services/api';

const emptyPeriod = { academic_year_start: '', academic_year_end: '', semester: '1st Semester', is_active: true };
const emptyCourse = { code: '', name: '', is_active: true };
const emptySection = { academic_period_id: '', course_id: '', year_level: '1st Year', section_code: '', is_active: true };

function Panel({ title, icon: Icon, children }) {
  return <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"><header className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-700"><Icon size={18} className="text-maroon-800 dark:text-maroon-300" /><h2 className="text-sm font-semibold">{title}</h2></header>{children}</section>;
}

export default function CourseManagement() {
  const [periods, setPeriods] = useState([]);
  const [courses, setCourses] = useState([]);
  const [sections, setSections] = useState([]);
  const [period, setPeriod] = useState(emptyPeriod);
  const [course, setCourse] = useState(emptyCourse);
  const [section, setSection] = useState(emptySection);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [periodResponse, courseResponse, sectionResponse] = await Promise.all([
        api.get('/nurse/academic-periods'), api.get('/nurse/courses'), api.get('/nurse/course-sections'),
      ]);
      setPeriods(periodResponse.data.data || []); setCourses(courseResponse.data.data || []); setSections(sectionResponse.data.data || []);
    } catch (err) { setError(err.response?.data?.message || 'Unable to load academic data.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const submit = async (event, type) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('');
    try {
      const path = type === 'period' ? '/nurse/academic-periods' : type === 'course' ? '/nurse/courses' : '/nurse/course-sections';
      const body = type === 'period' ? period : type === 'course' ? course : section;
      await api.post(path, body); setMessage(`${type === 'period' ? 'Academic period' : type === 'course' ? 'Course' : 'Section'} added.`);
      if (type === 'period') setPeriod(emptyPeriod); else if (type === 'course') setCourse(emptyCourse); else setSection(emptySection);
      await load();
    } catch (err) { setError(Object.values(err.response?.data?.errors || {}).flat().join(' ') || err.response?.data?.message || 'Unable to save record.'); }
    finally { setSaving(false); }
  };
  const input = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900';
  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-maroon-800" /></div>;

  return <div className="mx-auto max-w-7xl space-y-5 text-gray-900 dark:text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Course Management</h1><p className="mt-1 text-sm text-gray-500">Manage academic periods, courses, and course-specific sections.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"><RefreshCw size={16} />Refresh</button></header>
    {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="grid gap-5 xl:grid-cols-3">
      <Panel title="Academic period" icon={CalendarDays}><form onSubmit={event => submit(event, 'period')} className="space-y-3 p-5"><div className="grid grid-cols-2 gap-3"><input required type="number" min="2000" max="2100" className={input} placeholder="2026" value={period.academic_year_start} onChange={e => setPeriod({ ...period, academic_year_start: e.target.value })} /><input required type="number" min="2001" max="2101" className={input} placeholder="2027" value={period.academic_year_end} onChange={e => setPeriod({ ...period, academic_year_end: e.target.value })} /></div><select className={input} value={period.semester} onChange={e => setPeriod({ ...period, semester: e.target.value })}><option>1st Semester</option><option>2nd Semester</option><option>Summer</option></select><button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />Add period</button></form><div className="divide-y border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">{periods.map(item => <div key={item.id} className="flex items-center justify-between px-5 py-3 text-sm"><span>{item.academic_year_start}-{item.academic_year_end} · {item.semester}</span>{item.is_active && <span className="text-xs text-green-600">Active</span>}</div>)}</div></Panel>
      <Panel title="Courses" icon={BookOpen}><form onSubmit={event => submit(event, 'course')} className="space-y-3 p-5"><input required className={input} placeholder="Course code" value={course.code} onChange={e => setCourse({ ...course, code: e.target.value.toUpperCase() })} /><input required className={input} placeholder="Course name" value={course.name} onChange={e => setCourse({ ...course, name: e.target.value })} /><button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Plus size={16} />Add course</button></form><div className="divide-y border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">{courses.filter(item => !item.deleted_at).map(item => <div key={item.id} className="flex items-center justify-between px-5 py-3 text-sm"><span><b>{item.code}</b> · {item.name}</span>{!item.is_active && <span className="text-xs text-amber-600">Inactive</span>}</div>)}</div></Panel>
      <Panel title="Course sections" icon={Layers}><form onSubmit={event => submit(event, 'section')} className="space-y-3 p-5"><select required className={input} value={section.academic_period_id} onChange={e => setSection({ ...section, academic_period_id: e.target.value })}><option value="">Select period</option>{periods.map(item => <option key={item.id} value={item.id}>{item.academic_year_start}-{item.academic_year_end} · {item.semester}</option>)}</select><select required className={input} value={section.course_id} onChange={e => setSection({ ...section, course_id: e.target.value })}><option value="">Select course</option>{courses.filter(item => item.is_active && !item.deleted_at).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select><div className="grid grid-cols-2 gap-3"><select className={input} value={section.year_level} onChange={e => setSection({ ...section, year_level: e.target.value })}>{['1st Year', '2nd Year', '3rd Year', '4th Year'].map(value => <option key={value}>{value}</option>)}</select><input required className={input} placeholder="Section code" value={section.section_code} onChange={e => setSection({ ...section, section_code: e.target.value })} /></div><button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save size={16} />Save section</button></form><div className="max-h-64 divide-y overflow-y-auto border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">{sections.map(item => <div key={item.id} className="px-5 py-3 text-sm"><b>{item.course?.code || 'Course'}</b> · {item.year_level} · {item.section_code}<p className="text-xs text-gray-500">{item.academic_period?.academic_year_start}-{item.academic_period?.academic_year_end} · {item.academic_period?.semester}</p></div>)}</div></Panel>
    </div>
  </div>;
}
