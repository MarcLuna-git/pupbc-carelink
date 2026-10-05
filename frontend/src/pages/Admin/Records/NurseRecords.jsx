import { useEffect, useMemo, useState } from 'react';
import { FileText, Search, X, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import ClinicHistoryList from '../../../components/ClinicHistoryList';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import academics from '../../../data/registration-academics.json';
import { inputStyle, secondary } from '../Students/directoryOptions';
import { emptyRecordFilters, filterClinicRecords, recordAcademic, yearLabel, yearValue } from '../../../utils/clinicRecordFilters';

const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export default function NurseRecords() {
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(emptyRecordFilters);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get('/nurse/clinic-history', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted) setRecords(Array.isArray(data.data) ? data.data : []); })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load clinic history. Please try again.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [refresh]);
  const filtered = useMemo(() => filterClinicRecords(records, filters), [records, filters]);
  const courseOptions = unique([...academics.map(course => course.code), ...records.map(record => recordAcademic(record, 'course'))]);
  const courseRecords = records.filter(record => !filters.course || recordAcademic(record, 'course') === filters.course);
  const years = unique(courseRecords.map(record => yearValue(recordAcademic(record, 'year'))));
  const sections = unique(courseRecords.filter(record => !filters.year || yearValue(recordAcademic(record, 'year')) === filters.year).map(record => recordAcademic(record, 'section')));
  const active = Object.values(filters).some(Boolean);
  const changeFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'course' ? { year: '', section: '' } : key === 'year' ? { section: '' } : {}) }));
  const definitions = [
    ['course', 'Course', 'All courses', courseOptions.map(code => { const course = academics.find(item => item.code === code); return [code, course ? `${course.abbreviation} — ${course.name}` : code]; })],
    ['year', 'Year level', 'All year levels', years.map(year => [year, yearLabel(year)])],
    ['section', 'Section', 'All sections', sections.map(section => [section, section])],
    ['type', 'Record type', 'All record types', [['consultation', 'Consultations'], ['emergency', 'Emergency encounters']]],
  ];
  return <div className="mx-auto max-w-6xl space-y-5 text-gray-900 dark:text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-bold">Clinic Records</h1><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View completed consultations and emergency encounters by student course, year, and section.</p></div>
      <button type="button" onClick={() => setRefresh(current => current + 1)} disabled={loading} className={`${secondary} min-h-11`}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button>
    </header>
    <section aria-label="Clinic record filters" className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <label className="block"><span className="sr-only">Search records by student, ID, or complaint</span><span className="relative block"><Search size={18} className="absolute left-3 top-3 text-gray-400" aria-hidden="true" /><input type="search" className={`${inputStyle} min-h-11 pl-10 pr-10`} placeholder="Search student, student ID, or complaint…" value={filters.search} onChange={event => changeFilter('search', event.target.value)} />{filters.search && <button type="button" aria-label="Clear search" onClick={() => changeFilter('search', '')} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-gray-500 dark:text-gray-300"><X size={16} /></button>}</span></label>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{definitions.map(([key, label, all, options]) => <label key={key} className="min-w-0"><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</span><select className={`${inputStyle} min-h-11`} value={filters[key]} onChange={event => changeFilter(key, event.target.value)}><option value="">{all}</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>)}</div>
      {active && <div className="mt-3 flex justify-end"><button type="button" onClick={() => setFilters(emptyRecordFilters)} className="min-h-11 px-3 text-sm font-semibold text-maroon-800 dark:text-maroon-300">Clear all filters</button></div>}
    </section>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</div>}
    {loading ? <NursePageSkeleton contentOnly label="Loading clinic records" /> : !error && <>
      <p aria-live="polite" className="text-sm text-gray-500 dark:text-gray-400">Showing {filtered.length} of {records.length} records</p>
      {filtered.length ? <ClinicHistoryList records={filtered} /> : <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800"><FileText className="mx-auto h-10 w-10 text-gray-400" /><h2 className="mt-3 font-semibold">{active ? 'No records match your filters' : 'No completed records yet'}</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{active ? 'Try another course, year, section, or search term.' : 'Completed consultations and emergency encounters will appear here.'}</p></div>}
    </>}
  </div>;
}
