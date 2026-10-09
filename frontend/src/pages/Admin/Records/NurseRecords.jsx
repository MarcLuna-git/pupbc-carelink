import { useEffect, useMemo, useState, useRef } from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import api from '../../../services/api';
import RecordDirectory, { RecordDetailsModal } from './RecordDirectory';
import useNurseSync from '../../../hooks/useNurseSync';
import { StudentFilters, Pagination } from '../Students/StudentDirectory';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import academics from '../../../data/registration-academics.json';
import { secondary } from '../Students/directoryOptions';
import { emptyRecordFilters, filterClinicRecords, recordAcademic, yearLabel, yearValue } from '../../../utils/clinicRecordFilters';

const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export default function NurseRecords() {
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(emptyRecordFilters);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const requestId = useRef(0);
  useNurseSync(['consultations', 'students', 'academic'], async signal => {
    const request = ++requestId.current;
    const { data } = await api.get('/nurse/clinic-history', { signal });
    if (signal.aborted || request !== requestId.current) return;
    const latest = Array.isArray(data.data) ? data.data : [];
    setRecords(latest);
    setError('');
    setSelectedRecord(previous => previous ? latest.find(record => record.id === previous.id && record.type === previous.type) || null : null);
  });
  useEffect(() => {
    const request = ++requestId.current;
    const controller = new AbortController();
    setLoading(true); setError('');
    api.get('/nurse/clinic-history', { signal: controller.signal })
      .then(({ data }) => { if (!controller.signal.aborted && request === requestId.current) setRecords(Array.isArray(data.data) ? data.data : []); })
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
  const changeFilter = (key, value) => { setPage(1); setFilters(current => ({ ...current, [key]: value, ...(key === 'course' ? { year: '', section: '' } : key === 'year' ? { section: '' } : {}) })); };
  const definitions = [
    ['course', 'Course', 'All courses', courseOptions.map(code => { const course = academics.find(item => item.code === code); return [code, course ? `${course.abbreviation} — ${course.name}` : code]; })],
    ['year', 'Year level', 'All year levels', years.map(year => [year, yearLabel(year)])],
    ['section', 'Section', 'All sections', sections.map(section => [section, section])],
    ['type', 'Record type', 'All record types', [['consultation', 'Consultations'], ['emergency', 'Emergency encounters']]],
  ];
  const clearFilters = () => { setFilters(emptyRecordFilters); setPage(1); };
  const lastPage = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, lastPage);
  const visibleRecords = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const meta = { total: filtered.length, last_page: lastPage,
    from: filtered.length ? (currentPage - 1) * 10 + 1 : 0,
    to: Math.min(currentPage * 10, filtered.length) };
  return <div className="mx-auto max-w-7xl space-y-5 text-gray-900 dark:text-gray-100">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><div className="mb-2 h-1 w-9 rounded-full bg-yellow-400" /><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Clinic History</h1><p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">View completed consultations and emergency encounters.</p></div>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"><span className="rounded-lg bg-maroon-50 p-2 text-maroon-800 dark:bg-maroon-950/40 dark:text-maroon-300"><FileText size={20} aria-hidden="true" /></span><div><p className="text-xs text-gray-500 dark:text-gray-400">{active ? 'Matching records' : 'Total records'}</p><p className="text-xl font-semibold tabular-nums" aria-live="polite">{loading || error ? '—' : filtered.length.toLocaleString()}</p></div></div>
    </header>
    <StudentFilters filters={filters} onChange={changeFilter} onClear={clearFilters} filterDefinitions={definitions} label="Clinic record filters" searchLabel="Search clinic records" searchPlaceholder="Search student, ID, or complaint" />
    <section aria-label="Clinic history directory" aria-busy={loading} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-700"><h2 className="text-sm font-semibold">Clinic records</h2><div className="flex items-center gap-3"><span className="text-xs text-gray-500 dark:text-gray-400">Newest first</span><button type="button" onClick={() => setRefresh(current => current + 1)} disabled={loading} className={secondary}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Refresh</button></div></div>
      {error ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600 dark:text-red-300">{error}</p><button type="button" className={secondary} onClick={() => setRefresh(current => current + 1)}>Try again</button></div> : <>
        {loading ? <div className="p-4"><NursePageSkeleton contentOnly label="Loading clinic records" /></div> : visibleRecords.length ? <RecordDirectory records={visibleRecords} onView={setSelectedRecord} /> : <div className="px-6 py-16 text-center"><FileText size={30} aria-hidden="true" className="mx-auto mb-4 text-gray-400" /><h2 className="font-semibold">{active ? 'No records match your current filters.' : 'No clinic records found yet.'}</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{active ? 'Try a different student, course, year, or section.' : 'Completed consultations and emergency encounters will appear here.'}</p>{active && <button type="button" onClick={clearFilters} className={`${secondary} mt-5 text-maroon-800 dark:text-maroon-300`}>Clear filters</button>}</div>}
        <Pagination meta={meta} page={currentPage} onPage={setPage} loading={loading} entity="records" />
      </>}
    </section>
    {selectedRecord && <RecordDetailsModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
  </div>;
}
