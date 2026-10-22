import { useEffect, useMemo, useState, useRef } from 'react';
import { FileText, ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import RecordDirectory, { RecordDetailsModal } from './RecordDirectory';
import useNurseSync from '../../../hooks/useNurseSync';
import { StudentFilters } from '../Students/StudentDirectory';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageHero from '../../../components/NursePageHero';
import NurseListCard from '../../../components/NurseListCard';
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
  const changeFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value, ...(key === 'course' ? { year: '', section: '' } : key === 'year' ? { section: '' } : {}) })); };
  const definitions = [
    ['course', 'Course', 'All courses', courseOptions.map(code => { const course = academics.find(item => item.code === code); return [code, course ? `${course.abbreviation} — ${course.name}` : code]; })],
    ['year', 'Year level', 'All year levels', years.map(year => [year, yearLabel(year)])],
    ['section', 'Section', 'All sections', sections.map(section => [section, section])],
    ['type', 'Record type', 'All record types', [['consultation', 'Consultations'], ['emergency', 'Emergency encounters']]],
  ];
  const clearFilters = () => { setFilters(emptyRecordFilters); };
  const visibleRecords = filtered;
  return <div className="mx-auto max-w-[1440px] space-y-5 text-gray-900 dark:text-gray-100">
    <NursePageHero
      id="nurse-records-title"
      title="Clinic History"
      description="View completed consultations and emergency encounters."
      art={FileText}
    >
      <div className="mt-4 inline-flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-700/50">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-maroon-800 shadow-sm dark:bg-gray-800 dark:text-maroon-400"><FileText size={16} aria-hidden="true" /></span>
        <div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{active ? 'Matching records' : 'Total records'}</p>
          {loading
            ? <span role="status" className="mt-1 block h-5 w-12 animate-pulse rounded-md bg-gray-200 dark:bg-gray-600"><span className="sr-only">Loading record count</span></span>
            : <p className="text-lg font-bold leading-tight tabular-nums" aria-live="polite">{error ? <span className="text-sm font-semibold text-gray-400">Unavailable</span> : filtered.length.toLocaleString()}</p>}
        </div>
      </div>
    </NursePageHero>

    <NurseListCard
      aria-label="Clinic history directory"
      aria-busy={loading}
      icon={ClipboardList}
      title="Clinic records"
      description="Completed consultations and emergency encounters, newest first."
      toolbar={<StudentFilters embedded filters={filters} onChange={changeFilter} onClear={clearFilters} filterDefinitions={definitions} label="Clinic record filters" searchLabel="Search clinic records" searchPlaceholder="Search student, ID, or complaint" />}
    >
      {error ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600 dark:text-red-300">{error}</p><button type="button" className={secondary} onClick={() => setRefresh(current => current + 1)}>Try again</button></div> : <>
        {loading ? <div className="p-4"><NursePageSkeleton contentOnly label="Loading clinic records" /></div> : visibleRecords.length ? <RecordDirectory records={visibleRecords} onView={setSelectedRecord} /> : <div className="px-6 py-16 text-center"><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50"><FileText size={30} aria-hidden="true" className="text-gray-300 dark:text-gray-500" /></span><h2 className="font-semibold">{active ? 'No records match your current filters.' : 'No clinic records found yet.'}</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{active ? 'Try a different student, course, year, or section.' : 'Completed consultations and emergency encounters will appear here.'}</p>{active && <button type="button" onClick={clearFilters} className={`${secondary} mt-5 text-maroon-800 dark:text-maroon-300`}>Clear filters</button>}</div>}
      </>}
    </NurseListCard>
    {selectedRecord && <RecordDetailsModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
  </div>;
}
