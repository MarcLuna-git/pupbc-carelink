import { useEffect, useMemo, useState, useRef } from 'react';
import { FileText, ClipboardList } from 'lucide-react';
import api from '../../../services/api';
import RecordDirectory, { RecordDetailsModal, RECORD_SORTS } from './RecordDirectory';
import useNurseSync from '../../../hooks/useNurseSync';
import { Pagination } from '../Students/StudentDirectory';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard from '../../../components/NurseListCard';
import { secondary } from '../Students/directoryOptions';

const PER_PAGE = 4;
export default function NurseRecords({ embedded = false }) {
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [page, setPage] = useState(1);
  // Column sort, like the student's Health Records: first click newest/Z-A (descending), second ascending, third back to newest first.
  const [columnSort, setColumnSort] = useState(null);
  const cycleSort = key => { setColumnSort(current => current?.key !== key ? { key, dir: 'desc' } : current.dir === 'desc' ? { key, dir: 'asc' } : null); setPage(1); };
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
  const filtered = useMemo(() => {
    if (!columnSort) return records;
    const value = RECORD_SORTS[columnSort.key];
    const sign = columnSort.dir === 'asc' ? 1 : -1;
    return [...records].sort((a, b) => {
      const x = value(a); const y = value(b);
      return sign * (typeof x === 'number' ? x - y : x.localeCompare(y));
    });
  }, [records, columnSort]);
  const lastPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, lastPage);
  const visibleRecords = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);
  const pageMeta = { total: filtered.length, last_page: lastPage, from: filtered.length ? (currentPage - 1) * PER_PAGE + 1 : 0, to: Math.min(currentPage * PER_PAGE, filtered.length) };
  // Shown inside Consultation → Individual Release, under the patients being seen; it then has no page title of its own.
  return <div className={embedded ? 'space-y-5' : 'mx-auto max-w-[1440px] space-y-5 text-gray-900 dark:text-gray-100'}>
    {!embedded && <NursePageTitle path="/nurse/records" />}

    <NurseListCard
      aria-label="Clinic history directory"
      aria-busy={loading}
      icon={ClipboardList}
      title="Past visits"
      description="Completed consultations and emergency encounters, newest first."
    >
      {error ? <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600 dark:text-red-300">{error}</p><button type="button" className={secondary} onClick={() => setRefresh(current => current + 1)}>Try again</button></div> : <>
        {loading ? <div className="p-4"><NursePageSkeleton contentOnly label="Loading clinic records" /></div> : visibleRecords.length ? <><RecordDirectory records={visibleRecords} onView={setSelectedRecord} sort={columnSort} onSort={cycleSort} /><Pagination meta={pageMeta} page={currentPage} onPage={setPage} loading={false} entity="records" hideShowingText centered /></> : <div className="px-6 py-16 text-center"><span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50"><FileText size={30} aria-hidden="true" className="text-gray-300 dark:text-gray-500" /></span><h2 className="font-semibold">No clinic records found yet.</h2><p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Completed consultations and emergency encounters will appear here.</p></div>}
      </>}
    </NurseListCard>
    {selectedRecord && <RecordDetailsModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />}
  </div>;
}
