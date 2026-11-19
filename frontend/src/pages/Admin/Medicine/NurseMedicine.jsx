import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpDown, CalendarClock, ChevronDown, ChevronRight, ClipboardList, Download, EllipsisVertical, FileSpreadsheet, FileText, Filter, History, Package, PackagePlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import { NurseToast } from '../../../components/NurseFeedback';
import useNurseSync from '../../../hooks/useNurseSync';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import { useNurseTimeGuardBypass } from '../../../services/devTools';
import { Pagination } from '../Students/StudentDirectory';
import { focus } from '../Students/directoryOptions';
import MedicineFormModal from './MedicineFormModal';
import { DeleteModal, MovementModal, RestockModal } from './MedicineActionModals';
import StockHistoryPanel from './StockHistoryPanel';
import { EXPIRY, EXPIRY_FILTERS, SORTS, STANDARD_CATEGORIES, STOCK, STOCK_FILTERS, expiryNote, expiryStatusOf, isoDay, stockStatusOf, unitIcon, unitLabel } from './medicineOptions';
import { exportStockHistory } from './stockHistoryExport';

/*
 * Medicine Inventory: search, filters (category, stock, expiry), sorting and Add Medicine above the table;
 * the medicines in a table with Restock / Edit / more actions on each row; and the stock history of one
 * medicine below the table. Stock and expiry each have their own badge, filter and sort.
 */
const PER_PAGE = 10;
// Medicine, Generic Name, Available Stock, Expiry Date, Expiry Status, Stock Status, Actions.
const COLUMNS = 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.1fr)_15rem]';
const badge = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold';
const cellLabel = 'block text-xs text-gray-500 lg:hidden';
const control = 'h-11 w-full rounded-[10px] border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30';
const rowButton = `inline-flex h-9 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${focus}`;
const menuItem = `flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700/50 ${focus}`;

// The ⋮ menu of a row. Export History opens its CSV / Excel choices beside it (below it on a phone).
function RowMenu({ medicine, onHistory, onExport, onMovement, onDelete }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(false);
  const root = useRef(null);
  const close = () => { setOpen(false); setSub(false); };

  useEffect(() => {
    if (!open) return undefined;
    const outside = event => { if (!root.current?.contains(event.target)) close(); };
    const escape = event => { if (event.key === 'Escape') { close(); root.current?.querySelector('button')?.focus(); } };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  const run = action => () => { close(); action(medicine); };
  return <div ref={root} className="relative">
    <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`More actions for ${medicine.name}`} onClick={() => { setOpen(value => !value); setSub(false); }}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700 ${focus}`}><EllipsisVertical className="h-5 w-5" aria-hidden="true" /></button>
    {open && <div role="menu" aria-label={`Actions for ${medicine.name}`} className="absolute right-0 top-full z-30 mt-1 w-56 rounded-[10px] border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <button type="button" role="menuitem" onClick={run(onHistory)} className={menuItem}><History className="h-4 w-4 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />View Stock History</button>
      <div className="relative">
        <button type="button" role="menuitem" aria-haspopup="menu" aria-expanded={sub} onClick={() => setSub(value => !value)} className={`${menuItem} justify-between`}>
          <span className="flex items-center gap-2.5"><Download className="h-4 w-4 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />Export History</span>
          <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${sub ? 'rotate-90 md:rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {sub && <div role="menu" aria-label="Export history as" className="border-t border-gray-100 py-1 pl-3 dark:border-gray-700 md:absolute md:right-full md:top-0 md:mr-1 md:w-56 md:rounded-[10px] md:border md:border-gray-200 md:bg-white md:pl-0 md:shadow-lg md:dark:border-gray-600 md:dark:bg-gray-800">
          <button type="button" role="menuitem" onClick={run(item => onExport(item, 'csv'))} className={menuItem}><FileText className="h-4 w-4 text-green-600" aria-hidden="true" />Download CSV</button>
          <button type="button" role="menuitem" onClick={run(item => onExport(item, 'xlsx'))} className={menuItem}><FileSpreadsheet className="h-4 w-4 text-green-600" aria-hidden="true" />Download Excel (.xlsx)</button>
        </div>}
      </div>
      <div className="my-1 border-t border-gray-100 dark:border-gray-700" role="separator" />
      <button type="button" role="menuitem" onClick={run(onMovement)} className={menuItem}><ClipboardList className="h-4 w-4 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />Record Movement</button>
      <button type="button" role="menuitem" onClick={run(onDelete)} className={`${menuItem} text-red-600 dark:text-red-400`}><Trash2 className="h-4 w-4" aria-hidden="true" />Delete Medicine</button>
    </div>}
  </div>;
}

const NurseMedicine = () => {
  const [medicines, setMedicines] = useState([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const searchTerm = useDebouncedValue(search, 300);
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('');
  const [expiry, setExpiry] = useState('');
  const [sort, setSort] = useState('');
  const [usedCategories, setUsedCategories] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // The popup that is open: { kind: 'form' | 'restock' | 'movement' | 'delete', medicine }.
  const [dialog, setDialog] = useState(null);
  const [historyMedicine, setHistoryMedicine] = useState(null);
  const requestId = useRef(0);
  // Developer Tools → Remove time Guard: past expiry dates become selectable.
  const timeGuardOff = useNurseTimeGuardBypass();

  const notify = useCallback((text, type = 'success') => { setMessageType(type); setMessage(text); }, []);

  const fetchMedicines = useCallback(async (signal, silent = false) => {
    const id = ++requestId.current;
    try {
      if (!silent) { setError(''); setRefreshing(true); }
      const params = { page, per_page: PER_PAGE };
      if (searchTerm) params.search = searchTerm;
      if (category) params.category = category;
      if (stock) params.stock = stock;
      if (expiry) params.expiry = expiry;
      if (sort) params.sort = sort;
      const { data } = await api.get('/nurse/medicines', { params, signal });
      if (signal?.aborted || id !== requestId.current) return;
      const list = data.data;
      // A filter, or a delete, can leave the page we were on empty: step back to the last page.
      if (list.last_page && page > list.last_page) { setPage(list.last_page); return; }
      const rows = Array.isArray(list) ? list : (list.data || []);
      setMedicines(rows);
      setMeta({ total: list.total ?? rows.length, last_page: list.last_page || 1, from: list.from || 0, to: list.to || 0 });
      setHistoryMedicine(current => (current ? rows.find(row => row.id === current.id) || current : current));
      setError('');
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      if (silent) throw err;
      setError('Failed to load medicines.');
    } finally {
      if (id === requestId.current) { setInitial(false); setRefreshing(false); }
    }
  }, [page, searchTerm, category, stock, expiry, sort]);

  useEffect(() => {
    const controller = new AbortController();
    fetchMedicines(controller.signal);
    return () => controller.abort();
  }, [fetchMedicines]);

  useNurseSync(['medicines'], signal => fetchMedicines(signal, true), JSON.stringify([page, searchTerm, category, stock, expiry, sort]));

  const loadCategories = useCallback(() => {
    api.get('/nurse/medicines/categories').then(({ data }) => setUsedCategories([...(data.data || [])].filter(Boolean).sort((a, b) => a.localeCompare(b)))).catch(() => {});
  }, []);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  // The form's Category list: the standard ones plus any a nurse already used.
  const formCategories = [...STANDARD_CATEGORIES, ...usedCategories.filter(name => !STANDARD_CATEGORIES.includes(name))];

  const changeFilter = setter => event => { setter(event.target.value); setPage(1); };
  const filtered = Boolean(searchTerm || category || stock || expiry);
  // After a save, reload the list before the popup closes: the next popup then opens with the new stock and version.
  const done = async text => {
    try { await fetchMedicines(undefined, true); } catch { /* the sync poll will catch up */ }
    setDialog(null); notify(text); loadCategories();
  };
  const exportFromMenu = async (medicine, format) => {
    try {
      const count = await exportStockHistory(medicine, format);
      notify(count ? `Exported ${count} stock movement${count === 1 ? '' : 's'} of ${medicine.name}.` : `${medicine.name} has no stock movements yet, so the file only has the headings.`);
    } catch {
      notify('Unable to export the stock history.', 'error');
    }
  };

  if (initial) return <NursePageSkeleton variant="cards" label="Loading medicine inventory" />;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/medicines" />

      {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      <section aria-label="Medicine inventory" aria-busy={refreshing} className="rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
        {/* Search, the filters, sorting and Add Medicine share one height; they wrap to a second row when the page is narrow. */}
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:p-5">
          <div className="relative min-w-0 sm:col-span-2 lg:min-w-[16rem] lg:flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input type="search" aria-label="Search medicines" className={`${control} pl-10 pr-10`} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search medicine name or generic name" />
            {search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search" className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ${focus}`}><X className="h-4 w-4" /></button>}
          </div>
          <div className="relative lg:w-52">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <select aria-label="Filter by category" className={`${control} cursor-pointer appearance-none pl-10 pr-9`} value={category} onChange={changeFilter(setCategory)}>
              <option value="">All Categories</option>
              {usedCategories.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          </div>
          <div className="relative lg:w-48">
            <Filter className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <select aria-label="Filter by stock status" className={`${control} cursor-pointer appearance-none pl-10 pr-9`} value={stock} onChange={changeFilter(setStock)}>
              {STOCK_FILTERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          </div>
          <div className="relative lg:w-48">
            <CalendarClock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <select aria-label="Filter by expiry status" className={`${control} cursor-pointer appearance-none pl-10 pr-9`} value={expiry} onChange={changeFilter(setExpiry)}>
              {EXPIRY_FILTERS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          </div>
          <div className="relative lg:w-60">
            <ArrowUpDown className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <select aria-label="Sort medicines" className={`${control} cursor-pointer appearance-none pl-10 pr-9`} value={sort} onChange={changeFilter(setSort)}>
              {SORTS.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          </div>
          <button type="button" onClick={() => setDialog({ kind: 'form', medicine: null })}
            className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-maroon-900 sm:col-span-2 lg:w-auto ${focus}`}>
            <Plus className="h-4 w-4" aria-hidden="true" />Add Medicine
          </button>
        </div>

        {medicines.length === 0 ? (
          <div className="border-t border-gray-100 py-14 text-center dark:border-gray-700">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50"><Package className="h-8 w-8 text-gray-300 dark:text-gray-500" aria-hidden="true" /></span>
            <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No Medicines Found</h3>
            <p className="mt-1 text-sm text-gray-400">{filtered ? 'Try a different search or filter.' : 'Use Add Medicine to register the first medicine.'}</p>
          </div>
        ) : (
          <>
            <div aria-hidden="true" className={`hidden items-center gap-4 border-y border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 lg:grid dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 ${COLUMNS}`}>
              <span>Medicine</span><span>Generic Name</span><span>Available Stock</span><span>Expiry Date</span><span>Expiry Status</span><span>Stock Status</span><span>Actions</span>
            </div>
            <ul className="divide-y divide-gray-100 border-t border-gray-100 lg:border-t-0 dark:divide-gray-700 dark:border-gray-700">
              {medicines.map(medicine => {
                const state = STOCK[stockStatusOf(medicine)] || STOCK.in_stock;
                const expiryState = EXPIRY[expiryStatusOf(medicine)];
                const Icon = unitIcon(medicine.unit);
                const expiryDay = isoDay(medicine.next_expiry);
                const selected = historyMedicine?.id === medicine.id;
                return (
                  <li key={medicine.id} className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 transition-colors lg:items-center lg:px-5 ${COLUMNS} ${selected ? 'bg-maroon-50/50 dark:bg-maroon-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-700/30'}`}>
                    <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Icon className="h-4 w-4" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">{medicine.name}</h3>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{[unitLabel(medicine.unit), medicine.dosage].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                    <div className="min-w-0 text-sm text-gray-700 dark:text-gray-200"><span className={cellLabel}>Generic Name</span><span className="break-words">{medicine.generic_name || '—'}</span></div>
                    <div className="text-sm"><span className={cellLabel}>Available Stock</span><span className={`font-semibold tabular-nums ${medicine.is_out_of_stock || medicine.is_low_stock ? 'text-red-600 dark:text-red-400' : ''}`}>{medicine.quantity}</span></div>
                    <div className="text-sm"><span className={cellLabel}>Expiry Date</span><span className={`tabular-nums ${medicine.is_expired ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}`}>{expiryDay || '—'}</span></div>
                    <div className="text-sm">
                      <span className={`${cellLabel} mb-1`}>Expiry Status</span>
                      {expiryState ? <>
                        <span className={`${badge} ${expiryState.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${expiryState.dot}`} aria-hidden="true" />{expiryState.label}</span>
                        {expiryNote(medicine.days_to_expiry) && expiryState !== EXPIRY.ok && <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">{expiryNote(medicine.days_to_expiry)}</span>}
                      </> : <span className="text-xs text-gray-500 dark:text-gray-400">No expiry date</span>}
                    </div>
                    <div className="col-span-2 lg:col-span-1"><span className={`${cellLabel} mb-1`}>Stock Status</span><span className={`${badge} ${state.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} aria-hidden="true" />{state.label}</span></div>
                    <div className="col-span-2 flex items-center gap-2 lg:col-span-1">
                      <button type="button" onClick={() => setDialog({ kind: 'restock', medicine })} aria-label={`Restock ${medicine.name}`}
                        className={`${rowButton} border-maroon-300 bg-white text-maroon-800 hover:bg-maroon-50 dark:border-maroon-700 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20`}><PackagePlus className="h-3.5 w-3.5" aria-hidden="true" />Restock</button>
                      <button type="button" onClick={() => setDialog({ kind: 'form', medicine })} aria-label={`Edit ${medicine.name}`}
                        className={`${rowButton} border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-700`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                      <RowMenu medicine={medicine} onHistory={item => setHistoryMedicine(item)} onExport={exportFromMenu}
                        onMovement={item => setDialog({ kind: 'movement', medicine: item })} onDelete={item => setDialog({ kind: 'delete', medicine: item })} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pagination meta={meta} page={page} onPage={setPage} loading={refreshing} entity="medicines" />
          </>
        )}
      </section>

      {historyMedicine && <StockHistoryPanel key={historyMedicine.id} medicine={historyMedicine} onClose={() => setHistoryMedicine(null)} onNotify={notify} />}

      {dialog?.kind === 'form' && <MedicineFormModal medicine={dialog.medicine} categories={formCategories} timeGuardOff={timeGuardOff} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === 'restock' && <RestockModal medicine={dialog.medicine} timeGuardOff={timeGuardOff} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'movement' && <MovementModal medicine={dialog.medicine} onClose={() => setDialog(null)} onDone={done} />}
      {dialog?.kind === 'delete' && <DeleteModal medicine={dialog.medicine} onClose={() => setDialog(null)} onDone={text => { if (historyMedicine?.id === dialog.medicine.id) setHistoryMedicine(null); done(text); }} />}
    </div>
  );
};

export default NurseMedicine;
