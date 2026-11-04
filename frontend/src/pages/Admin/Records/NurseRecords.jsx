import { useEffect, useMemo, useState, useRef } from 'react';
import { FileText, ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import RecordDirectory, { RecordDetailsModal } from './RecordDirectory';
import useNurseSync from '../../../hooks/useNurseSync';
import { StudentFilters, Pagination } from '../Students/StudentDirectory';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import academics from '../../../data/registration-academics.json';
import useAcademicCatalog from '../../../hooks/useAcademicCatalog';
import { secondary } from '../Students/directoryOptions';
import { emptyRecordFilters, filterClinicRecords, recordAcademic, yearLabel, yearValue } from '../../../utils/clinicRecordFilters';

const PER_PAGE = 10;
const unique = values => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export default function NurseRecords() {
  const [records, setRecords] = useState([]);
  const [filters, setFilters] = useState(emptyRecordFilters);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [page, setPage] = useState(1);
  const catalog = useAcademicCatalog();
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
  const courseOptions = unique([...catalog.map(course => course.code), ...academics.map(course => course.code), ...records.map(record => recordAcademic(record, 'course'))]);
  const courseLabel = code => {
    const managed = catalog.find(item => item.code === code);
    if (managed) return `${managed.code} — ${managed.name}`;
    const legacy = academics.find(item => item.code === code);
    return legacy ? `${legacy.abbreviation} — ${legacy.name}` : code;
  };
  const courseRecords = records.filter(record => !filters.course || recordAcademic(record, 'course') === filters.course);
  const years = unique(courseRecords.map(record => yearValue(recordAcademic(record, 'year'))));
  const sections = unique(courseRecords.filter(record => !filters.year || yearValue(recordAcademic(record, 'year')) === filters.year).map(record => recordAcademic(record, 'section')));
  const active = Object.values(filters).some(Boolean);
  const changeFilter = (key, value) => { setFilters(current => ({ ...current, [key]: value, ...(key === 'course' ? { year: '', section: '' } : key === 'year' ? { section: '' } : {}) })); setPage(1); };
  const definitions = [
    ['course', 'Course', 'All courses', courseOptions.map(code => [code, courseLabel(code)])],
    ['year', 'Year level', 'All year levels', years.map(year => [year, yearLabel(year)])],
    ['section', 'Section', 'All sections', sections.map(section => [section, section])],
    ['type', 'Record type', 'All record types', [['consultation', 'Consultations'], ['emergency', 'Emergency encounters']]],
  ];
  const clearFilters = () => { setFilters(emptyRecordFilters); setPage(1); };
  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, lastPage);
  const visibleRecords = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const pageMeta = { total: filtered.length, last_page: lastPage, from: filtered.length ? (currentPage - 1) * PER_PAGE + 1 : 0, to: Math.min(currentPage * PER_PAGE, filtered.length) };
  return <div className="mx-auto max-w-[1440px] space-y-5 text-gray-900 dark:text-gray-100">
    <NursePageTitle path="/nurse/records" />

    <NurseListCard
      aria-label="Clinic history directory"
      aria-busy={loading}
      icon={ClipboardList}
      title={<>Clinic records<CountChip>{loading ? '…' : error ? '—' : filtered.length.toLocaleString()}</CountChip></>}
      description={`${active ? 'Records matching your filters, newest' : 'Completed consultations and emergency encounters, newest'} first.`}
      toolbar={<StudentFilters embedded filters={filters} onChange={changeFilter} onClear={clearFilters} filterDefinitions={definitions} label="Clinic record filters" searchLabel="Search clinic records" searchPlaceholder="Search student, ID, or complaint" dateLabel="Visit date" />}
    >
      {error ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600 dark:text-red-300">{error}</p><button type="button" className={secondary} onClick={() => setRefresh(current => current + 1)}>Try again</button></div> : <>
        {loading ? <div className="p-4"><NursePageSkeleton contentOnly label="Loading clinic records" /></div> : visibleRecords.length ? <><RecordDirectory records={visibleRecords} onView={setSelectedRecord} /><Pagination meta={pageMeta} page={currentPage} onPage={setPage} loading={false} entity="records" summary="pages" /></> : <div className="px-6 py-16 text-center"><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50"><FileText size={30} aria-hidden="true" className="text-gray-300 dark:text-gray-500" /></span><h2 className="font-semibold">{active ? 'No records match your current filters.' : 'No clinic records found yet.'}</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{active ? 'Try a different student, course, year, or section.' : 'Completed consultations and emergency encounters will appear here.'}</p>{active && <button type="button" onClick={clearFilters} className={`${secondary} mt-5 text-maroon-800 dark:text-maroon-300`}>Clear filters</button>}</div>}
      </>}
    </NurseListCard>
    {selectedRecord && <RecordDetailsModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
  </div>;
}
