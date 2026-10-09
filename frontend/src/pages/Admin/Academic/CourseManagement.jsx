import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { BookOpen, CalendarDays, Layers, Plus, RefreshCw, Search, X, Pencil, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import { Pagination } from '../Students/StudentDirectory';
import { inputStyle, primary, secondary, focus } from '../Students/directoryOptions';
import AcademicFormDialog from './AcademicFormDialog';
import useNurseSync from '../../../hooks/useNurseSync';
import { periodLabel, academicNames } from './academicOptions';

const tabs = [{ key: 'course', label: 'Courses', icon: BookOpen }, { key: 'section', label: 'Sections', icon: Layers }, { key: 'period', label: 'Academic periods', icon: CalendarDays }];
const defaults = {
  period: { academic_year_start: '', academic_year_end: '', semester: '1st Semester', is_active: true },
  course: { code: '', name: '', is_active: true },
  section: { academic_period_id: '', course_id: '', year_level: '1st Year', section_code: '', is_active: true },
};
const paths = { period: '/nurse/academic-periods', course: '/nurse/courses', section: '/nurse/course-sections' };
const statusBadge = active => <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${active ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{active ? 'Active' : 'Inactive'}</span>;

export default function CourseManagement() {
  const [data, setData] = useState({ period: [], course: [], section: [] });
  const [tab, setTab] = useState('course');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [courseId, setCourseId] = useState('');
  const [periodId, setPeriodId] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async signal => {
    const request = ++requestId.current;
    setRefreshing(true); setLoadError('');
    try {
      const responses = await Promise.all([api.get(paths.period, { signal }), api.get(paths.course, { signal }), api.get(paths.section, { signal })]);
      if (signal?.aborted || request !== requestId.current) return;
      setData({ period: responses[0].data.data || [], course: (responses[1].data.data || []).filter(item => !item.deleted_at), section: responses[2].data.data || [] });
    } catch (err) { if (!signal?.aborted) setLoadError(err.response?.data?.message || 'Unable to load academic data. Please try again.'); }
    finally { if (!signal?.aborted) { setLoading(false); setRefreshing(false); } }
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  useNurseSync(['academic'], load);

  const courses = data.course;
  const periods = data.period;
  const sections = data.section;
  const courseFor = item => courses.find(course => course.id === item.course_id) || item.course;
  const periodFor = item => periods.find(period => period.id === item.academic_period_id) || item.academic_period;
  const sectionCount = (type, id) => sections.filter(section => section[type === 'course' ? 'course_id' : 'academic_period_id'] === id).length;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data[tab].filter(item => {
      const course = data.course.find(course => course.id === item.course_id) || item.course;
      const period = data.period.find(period => period.id === item.academic_period_id) || item.academic_period;
      const text = tab === 'course' ? `${item.code} ${item.name}` : tab === 'period' ? periodLabel(item) : `${course?.code || ''} ${course?.name || ''} ${item.year_level} ${item.section_code} ${periodLabel(period)}`;
      return (!query || text.toLowerCase().includes(query)) && (!status || Boolean(item.is_active) === (status === 'active'))
        && (tab !== 'section' || ((!courseId || item.course_id === courseId) && (!periodId || item.academic_period_id === periodId)));
    }).sort((a, b) => tab === 'period' ? Number(b.academic_year_start) - Number(a.academic_year_start) || String(a.semester).localeCompare(String(b.semester)) : tab === 'course' ? a.code.localeCompare(b.code) : `${a.course_id} ${a.year_level} ${a.section_code}`.localeCompare(`${b.course_id} ${b.year_level} ${b.section_code}`, undefined, { numeric: true }));
  }, [data, tab, search, status, courseId, periodId]);
  const activeFilters = Boolean(search || status || (tab === 'section' && (courseId || periodId)));
  const last = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, last);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const meta = { total: filtered.length, last_page: last, from: filtered.length ? (currentPage - 1) * 10 + 1 : 0, to: Math.min(currentPage * 10, filtered.length) };
  const clearFilters = () => { setSearch(''); setStatus(''); setCourseId(''); setPeriodId(''); setPage(1); };
  const switchTab = key => { setTab(key); clearFilters(); };
  const openForm = (type, item = null) => {
    const values = { ...defaults[type] };
    if (item) Object.keys(values).forEach(key => { values[key] = key === 'is_active' ? Boolean(item[key]) : item[key] ?? values[key]; });
    else if (type === 'section') { values.course_id = courseId; values.academic_period_id = periodId; }
    setModal({ type, id: item?.id, version: item?.sync_version }); setForm(values); setErrors({}); setFormError('');
  };
  const changeField = (key, value) => { setForm(previous => ({ ...previous, [key]: value })); setErrors(previous => ({ ...previous, [key]: undefined })); };
  const submit = async event => {
    event.preventDefault(); if (saving) return;
    const body = { ...form };
    ['code', 'name', 'section_code'].forEach(key => { if (key in body) body[key] = body[key].trim(); });
    const validation = {};
    if (modal.type === 'course') { if (!body.code) validation.code = 'Course abbreviation is required.'; if (!body.name) validation.name = 'Course name is required.'; }
    if (modal.type === 'section' && !body.section_code) validation.section_code = 'Section code is required.';
    if (Object.keys(validation).length) { setErrors(validation); return; }
    setSaving(true); setFormError(''); setErrors({}); setMessage('');
    try {
      const response = modal.id ? await api.put(`${paths[modal.type]}/${modal.id}`, body, { headers: { 'If-Match': modal.version } }) : await api.post(paths[modal.type], body);
      const saved = response.data.data;
      setData(previous => ({ ...previous, [modal.type]: modal.id ? previous[modal.type].map(item => item.id === modal.id ? { ...item, ...saved } : item) : [...previous[modal.type], saved] }));
      setMessage(`${modal.type === 'period' ? 'Academic period' : modal.type === 'course' ? 'Course' : 'Section'} ${modal.id ? 'updated' : 'added'} successfully.`);
      setModal(null);
    } catch (err) { setErrors(err.response?.data?.errors || {}); setFormError(err.response?.status === 422 ? 'Please review the fields below.' : err.response?.data?.message || 'Unable to save. Please try again.'); }
    finally { setSaving(false); }
  };
  const canAddSection = periods.length > 0 && courses.some(course => course.is_active);
  const edit = item => <button type="button" onClick={() => openForm(tab, item)} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-950 ${focus}`} aria-label={`Edit ${tab === 'course' ? item.code : tab === 'section' ? item.section_code : periodLabel(item)}`}><Pencil size={15} />Edit</button>;
  const title = tabs.find(item => item.key === tab).label;
  const headers = tab === 'course' ? ['Course', 'Sections', 'Status', 'Action'] : tab === 'section' ? ['Course', 'Year & section', 'Academic period', 'Status', 'Action'] : ['Academic year', 'Semester', 'Sections', 'Status', 'Action'];

  return <div className="mx-auto max-w-7xl space-y-6 text-gray-900 dark:text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-4"><div className="min-w-0 flex-1 basis-full sm:basis-auto"><div className="mb-2 h-1 w-9 rounded-full bg-yellow-400" /><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Course Management</h1><p className="mt-1.5 max-w-xl text-sm leading-relaxed text-gray-500 dark:text-gray-400">Organize courses, manage sections, and keep academic periods up to date.</p></div><button type="button" onClick={() => load()} disabled={refreshing || saving} className={`${secondary} min-h-11`}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />{refreshing ? 'Refreshing…' : 'Refresh'}</button></header>
    <div className="grid gap-3 sm:grid-cols-3">{tabs.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => switchTab(key)} aria-pressed={tab === key} className={`flex min-w-0 items-center gap-4 rounded-2xl border bg-white p-4 text-left transition sm:p-5 dark:bg-gray-800 ${tab === key ? 'border-maroon-300 ring-1 ring-maroon-100 dark:border-maroon-300/60 dark:ring-maroon-300/10' : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-500'} ${focus}`}><span className="rounded-xl bg-maroon-50 p-3 text-maroon-800 dark:bg-maroon-950/40 dark:text-maroon-300"><Icon size={22} aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span><span className="mt-1 block text-2xl font-semibold tabular-nums">{loading ? '—' : data[key].length.toLocaleString()}</span></span><ArrowRight size={16} className={`shrink-0 ${tab === key ? 'text-maroon-800 dark:text-maroon-300' : 'text-gray-300 dark:text-gray-500'}`} aria-hidden="true" /></button>)}</div>
    {message && <div role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800/40 dark:bg-green-900/20 dark:text-green-300"><CheckCircle2 size={18} className="shrink-0" /><p className="flex-1">{message}</p><button type="button" onClick={() => setMessage('')} aria-label="Dismiss success message" className={`rounded p-1 ${focus}`}><X size={16} /></button></div>}
    {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"><AlertCircle size={18} /><p className="min-w-0 flex-1">{loadError}</p><button type="button" onClick={() => load()} disabled={refreshing} className={`${secondary} bg-white dark:bg-gray-800`}>Try again</button></div>}
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" aria-label={title} aria-busy={loading || refreshing}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 p-4 sm:px-5 dark:border-gray-700"><div role="group" aria-label="Academic records view" className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900/60">{tabs.map(({ key, label }) => <button key={key} type="button" onClick={() => switchTab(key)} aria-pressed={tab === key} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition ${tab === key ? 'bg-white text-maroon-800 shadow-sm dark:bg-gray-700 dark:text-maroon-200' : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'} ${focus}`}>{label}</button>)}</div><button type="button" onClick={() => openForm(tab)} disabled={loading || refreshing || (tab === 'section' && !canAddSection)} className={`${primary} min-h-11`}><Plus size={16} />Add {academicNames[tab]}</button></div>
      <div className="space-y-3 border-b border-gray-100 p-4 sm:px-5 dark:border-gray-700"><div className={`grid min-w-0 grid-cols-1 gap-3 ${tab === 'section' ? 'sm:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(150px,1fr))]' : 'sm:grid-cols-[minmax(0,1fr)_180px]'}`}><label className="relative block min-w-0"><span className="sr-only">Search {title.toLowerCase()}</span><Search size={17} className="absolute left-3 top-3.5 text-gray-400" aria-hidden="true" /><input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={tab === 'course' ? 'Search course abbreviation or name…' : tab === 'section' ? 'Search course or section…' : 'Search academic year or semester…'} className={`${inputStyle} min-h-11 pl-10 pr-10`} />{search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search" className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 dark:text-gray-300 ${focus}`}><X size={16} /></button>}</label>
        {tab === 'section' && <><label><span className="sr-only">Filter by course</span><select value={courseId} onChange={event => { setCourseId(event.target.value); setPage(1); }} className={`${inputStyle} min-h-11`}><option value="">All courses</option>{courses.map(item => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></label><label><span className="sr-only">Filter by academic period</span><select value={periodId} onChange={event => { setPeriodId(event.target.value); setPage(1); }} className={`${inputStyle} min-h-11`}><option value="">All academic periods</option>{periods.map(item => <option key={item.id} value={item.id}>{periodLabel(item)}</option>)}</select></label></>}
        <label><span className="sr-only">Filter by status</span><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={`${inputStyle} min-h-11`}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-gray-500 dark:text-gray-400">{loading ? 'Loading academic records…' : `${filtered.length} ${title.toLowerCase()}${activeFilters ? ' match your filters' : ' available'}`}</p>{activeFilters && <button type="button" onClick={clearFilters} className={`rounded-lg px-2 py-1.5 text-xs font-semibold text-maroon-800 dark:text-maroon-300 ${focus}`}>Clear filters</button>}</div>
      </div>
      {tab === 'section' && !loading && !canAddSection && !loadError && <div className="flex flex-wrap items-center gap-3 border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/15 dark:text-amber-200"><AlertCircle size={17} /><p className="min-w-0 flex-1">Add an academic period and an active course before creating sections.</p><button type="button" onClick={() => switchTab(!periods.length ? 'period' : 'course')} className={`rounded-lg px-2 py-1 font-semibold underline ${focus}`}>Go to {!periods.length ? 'academic periods' : 'courses'}</button></div>}
      {loading ? <div className="p-5"><NursePageSkeleton contentOnly label="Loading academic records" /></div> : !visible.length ? <div className="flex flex-col items-center px-6 py-14 text-center"><span className="rounded-2xl bg-gray-50 p-4 text-gray-400 dark:bg-gray-900/50"><BookOpen size={28} /></span><h2 className="mt-4 font-semibold">{loadError ? 'Academic records unavailable' : activeFilters ? 'No matching records' : `No ${title.toLowerCase()} yet`}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{loadError ? 'Retry loading to view your academic records.' : activeFilters ? 'Try a different search term or clear your filters.' : `Add your first ${academicNames[tab]} to get started.`}</p>{activeFilters && <button type="button" onClick={clearFilters} className={`${secondary} mt-5`}>Clear filters</button>}</div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">{title}</caption><thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400"><tr>{headers.map(label => <th key={label} scope="col" className="px-5 py-3.5 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{visible.map(item => <tr key={item.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
          {tab === 'course' ? <><td className="px-5 py-4"><span className="font-semibold text-maroon-800 dark:text-maroon-300">{item.code}</span><p className="mt-1 max-w-xl break-words text-sm text-gray-600 dark:text-gray-300">{item.name}</p></td><td className="px-5 py-4 tabular-nums">{sectionCount('course', item.id)}</td></> : tab === 'section' ? <><td className="px-5 py-4"><p className="font-semibold">{courseFor(item)?.code || 'Course unavailable'}</p><p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-gray-400">{courseFor(item)?.name}</p></td><td className="px-5 py-4"><p className="font-semibold">{item.section_code}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.year_level}</p></td><td className="px-5 py-4 text-gray-600 dark:text-gray-300">{periodLabel(periodFor(item))}</td></> : <><td className="px-5 py-4 font-semibold">{item.academic_year_start}–{item.academic_year_end}</td><td className="px-5 py-4 text-gray-600 dark:text-gray-300">{item.semester}</td><td className="px-5 py-4 tabular-nums">{sectionCount('period', item.id)}</td></>}
          <td className="px-5 py-4">{statusBadge(item.is_active)}</td><td className="px-4 py-4">{edit(item)}</td>
        </tr>)}</tbody></table></div>
        <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{visible.map(item => <article key={item.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{tab === 'course' ? item.code : tab === 'section' ? `${courseFor(item)?.code || 'Course'} ${item.section_code}` : `${item.academic_year_start}–${item.academic_year_end}`}</h3><p className="mt-1 break-words text-sm leading-relaxed text-gray-600 dark:text-gray-300">{tab === 'course' ? item.name : tab === 'section' ? courseFor(item)?.name : item.semester}</p></div>{statusBadge(item.is_active)}</div><div className="mt-3 flex items-center justify-between gap-3"><p className="min-w-0 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{tab === 'section' ? `${item.year_level} · ${periodLabel(periodFor(item))}` : `${sectionCount(tab, item.id)} linked sections`}</p>{edit(item)}</div></article>)}</div>
      </>}
      <Pagination meta={meta} page={currentPage} onPage={setPage} loading={loading || refreshing} entity={title.toLowerCase()} />
    </section>
    {modal && <AcademicFormDialog type={modal.type} editing={Boolean(modal.id)} form={form} onChange={changeField} onClose={() => { if (!saving) setModal(null); }} onSubmit={submit} saving={saving} errors={errors} error={formError} courses={courses} periods={periods} />}
  </div>;
}
