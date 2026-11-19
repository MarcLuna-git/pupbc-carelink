import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, FileSpreadsheet, FileText, Loader2, X } from 'lucide-react';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import { Pagination } from '../Students/StudentDirectory';
import { focus } from '../Students/directoryOptions';
import { MOVEMENT_FILTERS, MOVEMENTS, balance, changeOf, dateTime, personName, reasonText, signed } from './medicineOptions';
import { exportStockHistory } from './stockHistoryExport';

/*
 * The stock history of one medicine: every restock, dispensing, waste, expiry and adjustment, with the
 * change and the stock before and after it. Filter by date and movement; export the filtered history.
 */
const PER_PAGE = 10;
const input = 'h-10 w-full rounded-[10px] border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:[color-scheme:dark]';
const COLUMNS = 'md:grid-cols-[minmax(0,1.5fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,2fr)]';

export default function StockHistoryPanel({ medicine, onClose, onNotify }) {
  const [filters, setFilters] = useState({ from: '', to: '', type: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, from: 0, to: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState('');
  const panel = useRef(null);
  const request = useRef(0);

  const load = useCallback(async signal => {
    const id = ++request.current;
    try {
      const params = { page, per_page: PER_PAGE };
      for (const key of ['from', 'to', 'type']) if (filters[key]) params[key] = filters[key];
      const { data } = await api.get(`/nurse/medicines/${medicine.id}/movements`, { params, signal });
      if (signal?.aborted || id !== request.current) return;
      const list = data.data;
      // Filtering can leave the page we were on empty: step back to the last page.
      if (list.last_page && page > list.last_page) { setPage(list.last_page); return; }
      setRows(Array.isArray(list) ? list : (list.data || []));
      setMeta({ total: list.total ?? 0, last_page: list.last_page || 1, from: list.from || 0, to: list.to || 0 });
      setError('');
    } catch (err) {
      if (err.code !== 'ERR_CANCELED' && !signal?.aborted) setError(err.response?.data?.message || 'Unable to load the stock history.');
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [medicine.id, filters, page]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Stay current when stock changes (a restock or a dispensing on this or another device).
  useNurseSync(['medicines'], load, JSON.stringify([medicine.id, filters, page]));

  useEffect(() => { panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [medicine.id]);

  const change = key => event => { setFilters(current => ({ ...current, [key]: event.target.value })); setPage(1); };

  const download = async format => {
    if (exporting) return;
    setExporting(format);
    try {
      const count = await exportStockHistory(medicine, format, filters);
      onNotify(count ? `Exported ${count} stock movement${count === 1 ? '' : 's'}.` : 'There were no stock movements to export, so the file only has the headings.', 'success');
    } catch {
      onNotify('Unable to export the stock history.', 'error');
    } finally { setExporting(''); }
  };

  const filtered = Boolean(filters.from || filters.to || filters.type);

  return <section ref={panel} aria-label={`Stock history of ${medicine.name}`} className="scroll-mt-4 overflow-hidden rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
    <header className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-300"><Clock className="h-5 w-5" aria-hidden="true" /></span>
      <div className="min-w-0 flex-1">
        <h2 className="break-words font-bold">Stock History - {medicine.name}</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">View the stock movement history for this medicine.</p>
      </div>
      <button type="button" onClick={onClose} aria-label="Close stock history" className={`rounded-[10px] p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X className="h-5 w-5" /></button>
    </header>

    <div className="flex flex-col gap-3 px-4 pt-4 lg:flex-row lg:items-end lg:px-6">
      <div className="grid flex-1 gap-3 sm:grid-cols-3 lg:max-w-3xl">
        <label><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">From Date</span><input type="date" className={input} value={filters.from} max={filters.to || undefined} onChange={change('from')} /></label>
        <label><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">To Date</span><input type="date" className={input} value={filters.to} min={filters.from || undefined} onChange={change('to')} /></label>
        <label><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Movement</span>
          <select className={`${input} cursor-pointer`} value={filters.type} onChange={change('type')}>{MOVEMENT_FILTERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
        </label>
      </div>
      <div className="flex gap-2 lg:ml-auto">
        <button type="button" onClick={() => download('csv')} disabled={Boolean(exporting)} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-maroon-300 bg-white px-4 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 disabled:opacity-50 lg:flex-none dark:border-maroon-700 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20 ${focus}`}>
          {exporting === 'csv' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}Export CSV
        </button>
        <button type="button" onClick={() => download('xlsx')} disabled={Boolean(exporting)} className={`inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-[10px] border border-green-600 bg-white px-4 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 lg:flex-none dark:border-green-700 dark:bg-transparent dark:text-green-400 dark:hover:bg-green-900/20 ${focus}`}>
          {exporting === 'xlsx' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}Export Excel
        </button>
      </div>
    </div>

    <div className="p-4 lg:p-6" aria-busy={loading}>
      <div className="overflow-hidden rounded-[10px] border border-gray-100 dark:border-gray-700">
        {error ? <p role="alert" className="p-8 text-center text-sm text-red-700 dark:text-red-300">{error}</p>
          : loading ? <div role="status" className="space-y-2 p-4">{[0, 1, 2].map(key => <div key={key} className="h-10 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />)}<span className="sr-only">Loading stock history</span></div>
            : rows.length === 0 ? <p className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">{filtered ? 'No stock movements match these filters.' : 'No stock movements recorded yet.'}</p>
              : <>
                <div aria-hidden="true" className={`hidden items-center gap-4 border-b border-gray-100 bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-600 md:grid dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 ${COLUMNS}`}>
                  <span>Date &amp; Time</span><span>Movement</span><span>Quantity Change</span><span>Stock Before</span><span>Stock After</span><span>Performed By</span><span>Reference / Reason</span>
                </div>
                <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map(movement => {
                    const kind = MOVEMENTS[movement.movement_type] || { label: movement.movement_type, pill: 'bg-gray-100 text-gray-700', amount: '' };
                    const Icon = kind.icon;
                    return <li key={movement.id} className={`grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm md:items-center ${COLUMNS}`}>
                      <span className="col-span-2 text-gray-700 md:col-span-1 dark:text-gray-200">{dateTime(movement.created_at)}</span>
                      <span><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${kind.pill}`}>{Icon && <Icon className="h-3 w-3" aria-hidden="true" />}{kind.label}</span></span>
                      <span className={`font-semibold tabular-nums ${kind.amount}`}><span className="mr-1 text-xs font-normal text-gray-500 md:hidden">Change</span>{signed(changeOf(movement))}</span>
                      <span className="tabular-nums"><span className="mr-1 text-xs text-gray-500 md:hidden">Before</span>{balance(movement.stock_before)}</span>
                      <span className="tabular-nums"><span className="mr-1 text-xs text-gray-500 md:hidden">After</span>{balance(movement.stock_after)}</span>
                      <span className="min-w-0 break-words text-gray-700 dark:text-gray-200">{personName(movement.performer) || '—'}</span>
                      <span className="col-span-2 min-w-0 break-words text-gray-600 md:col-span-1 dark:text-gray-300">{reasonText(movement) || '—'}</span>
                    </li>;
                  })}
                </ul>
              </>}
        {!error && !loading && meta.total > 0 && <Pagination meta={meta} page={page} onPage={setPage} loading={loading} entity="records" />}
      </div>
    </div>
  </section>;
}
