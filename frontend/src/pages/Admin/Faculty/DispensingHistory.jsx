import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, History } from 'lucide-react';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import { Pagination } from '../Students/StudentDirectory';
import { personName } from '../Medicine/medicineOptions';
import { currentMonth, dateTimeLabel, quantityLabel } from './facultyOptions';

/*
 * Dispensing History: every medicine given to faculty, newest first, for a range of dates (this month to
 * start with) and, optionally, one faculty member.
 */
const PER_PAGE = 10;
const COLUMNS = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1.2fr)]';
const control = 'h-11 rounded-[10px] border border-gray-200 bg-white text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30';
const dateInput = 'h-9 min-w-0 flex-1 rounded-[10px] border-0 bg-transparent px-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-maroon-500/30 dark:text-white dark:[color-scheme:dark]';

export default function DispensingHistory({ faculty, facultyId, onFacultyId }) {
  const [range, setRange] = useState(() => currentMonth());
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const backwards = Boolean(range.from && range.to && range.from > range.to);

  const fetchRows = useCallback(async (signal, silent = false) => {
    if (backwards) { setRows([]); setMeta({ total: 0, last_page: 1, from: 0, to: 0 }); setInitial(false); return; }
    const id = ++requestId.current;
    try {
      if (!silent) { setError(''); setRefreshing(true); }
      const params = { page, per_page: PER_PAGE };
      if (facultyId) params.faculty_id = facultyId;
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      const { data } = await api.get('/nurse/faculty-dispensings', { params, signal });
      if (signal?.aborted || id !== requestId.current) return;
      const list = data.data;
      if (list.last_page && page > list.last_page) { setPage(list.last_page); return; }
      setRows(list.data || []);
      setMeta({ total: list.total ?? 0, last_page: list.last_page || 1, from: list.from || 0, to: list.to || 0 });
      setError('');
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      if (silent) throw err;
      setError('Failed to load the dispensing history.');
    } finally {
      if (id === requestId.current) { setInitial(false); setRefreshing(false); }
    }
  }, [page, facultyId, range, backwards]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRows(controller.signal);
    return () => controller.abort();
  }, [fetchRows]);

  useNurseSync(['faculty'], signal => fetchRows(signal, true), JSON.stringify([page, facultyId, range]));

  const setDate = key => event => { setRange(current => ({ ...current, [key]: event.target.value })); setPage(1); };

  return <section aria-label="Dispensing history" aria-busy={refreshing} className="rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
    <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between lg:p-5">
      <div className="min-w-0">
        <h2 className="text-lg font-bold">Dispensing History</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">All medicines dispensed to faculty members</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)] lg:flex lg:items-center">
        <div role="group" aria-label="Date range" className={`${control} flex items-center gap-2 px-3`}>
          <Calendar className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
          <input type="date" aria-label="From date" className={dateInput} value={range.from} max={range.to || undefined} onChange={setDate('from')} />
          <span className="text-gray-400" aria-hidden="true">–</span>
          <input type="date" aria-label="To date" className={dateInput} value={range.to} min={range.from || undefined} onChange={setDate('to')} />
        </div>
        <div className="relative lg:w-56">
          <select aria-label="Filter by faculty" className={`${control} w-full cursor-pointer appearance-none px-3 pr-9`} value={facultyId} onChange={event => { onFacultyId(event.target.value); setPage(1); }}>
            <option value="">All Faculty</option>
            {faculty.map(item => <option key={item.id} value={item.id}>{item.full_name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        </div>
      </div>
    </div>
    {backwards && <p role="alert" className="mx-4 mb-4 rounded-[10px] bg-amber-50 p-3 text-sm text-amber-800 lg:mx-5 dark:bg-amber-900/20 dark:text-amber-300">The start date is after the end date. Change one of them to see the history.</p>}
    {error && <p role="alert" className="mx-4 mb-4 rounded-[10px] bg-red-50 p-3 text-center text-sm font-medium text-red-700 lg:mx-5 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

    {initial ? <div role="status" className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-700"><span className="sr-only">Loading the dispensing history</span>{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />)}</div>
      : rows.length === 0 ? (
        <div className="border-t border-gray-100 py-14 text-center dark:border-gray-700">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50"><History className="h-8 w-8 text-gray-300 dark:text-gray-500" aria-hidden="true" /></span>
          <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No Dispensing Records</h3>
          <p className="mt-1 text-sm text-gray-400">Nothing was dispensed to faculty in this period. Try another date range or faculty member.</p>
        </div>
      ) : (
        <>
          <div aria-hidden="true" className={`hidden items-center gap-4 border-y border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 md:grid dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 ${COLUMNS}`}>
            <span>Date &amp; Time</span><span>Faculty</span><span>Medicine</span><span>Quantity</span><span>Reason</span><span>Dispensed By</span>
          </div>
          <ul className="divide-y divide-gray-100 border-t border-gray-100 md:border-t-0 dark:divide-gray-700 dark:border-gray-700">
            {rows.map(row => <li key={row.id} className={`grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3.5 text-sm md:items-center md:px-5 ${COLUMNS} hover:bg-gray-50/70 dark:hover:bg-gray-700/30`}>
              <div className="col-span-2 tabular-nums text-gray-600 md:col-span-1 dark:text-gray-300">{dateTimeLabel(row.created_at)}</div>
              <div className="col-span-2 min-w-0 md:col-span-1"><span className="block truncate font-semibold">{row.faculty?.full_name || 'Removed faculty member'}</span>{row.faculty?.course && <span className="block truncate text-xs text-gray-500 dark:text-gray-400">{row.faculty.course}</span>}</div>
              <div className="min-w-0"><span className="block text-xs text-gray-500 md:hidden">Medicine</span><span className="break-words">{row.medicine_name}</span></div>
              <div><span className="block text-xs text-gray-500 md:hidden">Quantity</span><span className="whitespace-nowrap font-semibold tabular-nums">{quantityLabel(row)}</span></div>
              <div className="col-span-2 min-w-0 md:col-span-1"><span className="block text-xs text-gray-500 md:hidden">Reason</span><span className="break-words text-gray-700 dark:text-gray-200">{row.reason}</span></div>
              <div className="col-span-2 min-w-0 md:col-span-1"><span className="block text-xs text-gray-500 md:hidden">Dispensed By</span><span className="break-words">{personName(row.dispenser) || '—'}</span></div>
            </li>)}
          </ul>
          <Pagination meta={meta} page={page} onPage={setPage} loading={refreshing} entity="records" numbered />
        </>
      )}
  </section>;
}
