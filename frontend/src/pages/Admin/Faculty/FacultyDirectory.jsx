import { useCallback, useEffect, useRef, useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2, Users, X } from 'lucide-react';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import useDebouncedValue from '../../../hooks/useDebouncedValue';
import { Pagination } from '../Students/StudentDirectory';
import { focus } from '../Students/directoryOptions';
import DeleteFacultyModal from './DeleteFacultyModal';
import FacultyFormModal from './FacultyFormModal';
import { STATUSES, avatarColor, initials } from './facultyOptions';

/*
 * Faculty Directory: search with Add Faculty Member on one row, and the faculty members in a
 * table with view / edit / delete on each row.
 */
const PER_PAGE = 5;
const COLUMNS = 'md:grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,0.9fr)_7rem]';
const control = 'h-11 w-full rounded-[10px] border border-gray-200 bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:focus:ring-maroon-300/30';
const iconButton = `inline-flex h-9 w-9 items-center justify-center rounded-[10px] transition-colors ${focus}`;

export default function FacultyDirectory({ onView, onChanged, onNotify }) {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ total: 0, last_page: 1, from: 0, to: 0 });
  const [page, setPage] = useState(1);
  const [initial, setInitial] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const searchTerm = useDebouncedValue(search, 300);
  // The popup that is open: { kind: 'form' | 'delete', member }.
  const [dialog, setDialog] = useState(null);
  const requestId = useRef(0);

  const fetchRows = useCallback(async (signal, silent = false) => {
    const id = ++requestId.current;
    try {
      if (!silent) { setError(''); setRefreshing(true); }
      const params = { page, per_page: PER_PAGE };
      if (searchTerm) params.search = searchTerm;
      const { data } = await api.get('/nurse/faculty', { params, signal });
      if (signal?.aborted || id !== requestId.current) return;
      const list = data.data;
      // A filter, or a delete, can leave the page we were on empty: step back to the last page.
      if (list.last_page && page > list.last_page) { setPage(list.last_page); return; }
      setRows(list.data || []);
      setMeta({ total: list.total ?? 0, last_page: list.last_page || 1, from: list.from || 0, to: list.to || 0 });
      setError('');
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      if (silent) throw err;
      setError('Failed to load the faculty directory.');
    } finally {
      if (id === requestId.current) { setInitial(false); setRefreshing(false); }
    }
  }, [page, searchTerm]);

  useEffect(() => {
    const controller = new AbortController();
    fetchRows(controller.signal);
    return () => controller.abort();
  }, [fetchRows]);

  useNurseSync(['faculty'], signal => fetchRows(signal, true), JSON.stringify([page, searchTerm]));

  const filtered = Boolean(searchTerm);
  // After a save, reload the list before the popup closes: the next popup then opens with the new version.
  const done = async text => {
    try { await fetchRows(undefined, true); } catch { /* the sync poll will catch up */ }
    setDialog(null); onNotify(text); onChanged();
  };

  return <section aria-label="Faculty directory" aria-busy={refreshing || initial} className="rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center lg:p-5">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input type="search" aria-label="Search faculty" className={`${control} pl-10 pr-10`} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Search faculty by name or email" />
        {search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search" className={`absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 ${focus}`}><X className="h-4 w-4" /></button>}
      </div>
      <button type="button" onClick={() => setDialog({ kind: 'form', member: null })}
        className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white transition-colors hover:bg-maroon-900 ${focus}`}>
        <Plus className="h-4 w-4" aria-hidden="true" />Add Faculty Member
      </button>
    </div>
    {error && <p role="alert" className="mx-4 mb-4 rounded-[10px] bg-red-50 p-3 text-center text-sm font-medium text-red-700 lg:mx-5 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

    {initial ? <div role="status" className="space-y-3 border-t border-gray-100 p-5 dark:border-gray-700"><span className="sr-only">Loading the faculty directory</span>{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-12 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />)}</div>
      : rows.length === 0 ? (
        <div className="border-t border-gray-100 py-14 text-center dark:border-gray-700">
          <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50"><Users className="h-8 w-8 text-gray-300 dark:text-gray-500" aria-hidden="true" /></span>
          <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No Faculty Members Found</h3>
          <p className="mt-1 text-sm text-gray-400">{filtered ? 'Try a different search.' : 'Use Add Faculty Member to add the first one.'}</p>
        </div>
      ) : (
        <>
          <div aria-hidden="true" className={`hidden items-center gap-4 border-y border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 md:grid dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 ${COLUMNS}`}>
            <span>Faculty Member</span><span>Contact Number</span><span>Status</span><span>Actions</span>
          </div>
          <ul className="divide-y divide-gray-100 border-t border-gray-100 md:border-t-0 dark:divide-gray-700 dark:border-gray-700">
            {rows.map(member => {
              const state = STATUSES[member.status] || STATUSES.active;
              return <li key={member.id} className={`grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-3.5 transition-colors md:items-center md:px-5 ${COLUMNS} hover:bg-gray-50/70 dark:hover:bg-gray-700/30`}>
                <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-1">
                  <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(member.full_name)}`}>{initials(member.full_name)}</span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{member.full_name}</h3>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{member.email || 'No email'}</p>
                  </div>
                </div>
                <div className="min-w-0 text-sm"><span className="block text-xs text-gray-500 md:hidden">Contact Number</span><span className="break-words">{member.phone || '—'}</span></div>
                <div><span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${state.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${state.dot}`} aria-hidden="true" />{state.label}</span></div>
                <div className="col-span-2 flex items-center gap-1 md:col-span-1">
                  <button type="button" onClick={() => onView(member.id)} aria-label={`View ${member.full_name}`} title="View" className={`${iconButton} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700`}><Eye className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => setDialog({ kind: 'form', member })} aria-label={`Edit ${member.full_name}`} title="Edit" className={`${iconButton} text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-900/20`}><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                  <button type="button" onClick={() => setDialog({ kind: 'delete', member })} aria-label={`Delete ${member.full_name}`} title="Delete" className={`${iconButton} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20`}><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                </div>
              </li>;
            })}
          </ul>
          <Pagination meta={meta} page={page} onPage={setPage} loading={refreshing} entity="faculty members" numbered />
        </>
      )}

    {dialog?.kind === 'form' && <FacultyFormModal member={dialog.member} onClose={() => setDialog(null)} onSaved={done} />}
    {dialog?.kind === 'delete' && <DeleteFacultyModal member={dialog.member} onClose={() => setDialog(null)} onDone={done} />}
  </section>;
}
