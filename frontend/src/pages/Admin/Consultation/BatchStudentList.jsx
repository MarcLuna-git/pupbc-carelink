import { useEffect, useRef, useState } from 'react';
import { Link2, Search, X } from 'lucide-react';
import api from '../../../services/api';
import { CountChip } from '../../../components/NurseListCard';
import { inputStyle } from '../Students/directoryOptions';
import { fieldLabel } from './BatchFieldsForm';

/*
 * Batch Release → the students on the document. Names can be typed or pasted (one per line), or a registered
 * student can be searched and picked, which keeps a link to their account. Both end up in one list,
 * A to Z, with no repeats (any letter case); a picked student wins over the same typed name.
 */
const clean = (name) => name.replace(/\s+/g, ' ').trim();
const keyOf = (name) => clean(name).toLowerCase();

export const typedNames = (text) => text.split(/\r?\n/).map(clean).filter(Boolean);

export const mergeStudents = (text, linked) => {
  const seen = new Map();
  linked.forEach((student) => { if (!seen.has(keyOf(student.name))) seen.set(keyOf(student.name), student); });
  typedNames(text).forEach((name) => { if (!seen.has(keyOf(name))) seen.set(keyOf(name), { name, student_id: null }); });
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
};

// "Last, First M." — the way the names are written on the printed list.
const printedName = (user) => {
  const middle = user.middle_name ? ` ${user.middle_name.trim().charAt(0)}.` : '';
  return clean(`${user.last_name || ''}, ${user.first_name || ''}${middle}`);
};

export default function BatchStudentList({ text, linked, students, error, onTextChange, onLinkedChange }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setResults([]); setSearching(false); return undefined; }
    setSearching(true);
    const id = ++request.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/nurse/students/search', { params: { q } });
        if (id === request.current) setResults(data.data || []);
      } catch {
        if (id === request.current) setResults([]);
      } finally {
        if (id === request.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const onList = new Set(students.map((student) => keyOf(student.name)));
  const linkedIds = new Set(linked.map((student) => student.student_id));

  const pick = (user) => {
    const name = printedName(user);
    if (!linkedIds.has(user.id)) onLinkedChange([...linked.filter((student) => keyOf(student.name) !== keyOf(name)), { name, student_id: user.id }]);
    setQuery('');
    setResults([]);
    setOpen(false);
  };

  const remove = (student) => {
    if (student.student_id) onLinkedChange(linked.filter((item) => item.student_id !== student.student_id));
    // The same name may also be typed; take it out of the box too so it does not come back.
    onTextChange(text.split(/\r?\n/).filter((line) => keyOf(line) !== keyOf(student.name)).join('\n'));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-3">
        <div className="relative">
          <label htmlFor="batch-student-search" className={fieldLabel}>Find a registered student</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              id="batch-student-search"
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && results[0]) { e.preventDefault(); pick(results[0]); } }}
              placeholder="Name or student number"
              autoComplete="off"
              role="combobox"
              aria-expanded={open && query.trim().length >= 2}
              aria-controls="batch-student-results"
              className={`${inputStyle} pl-9`}
            />
          </div>
          {open && query.trim().length >= 2 && (
            <ul id="batch-student-results" role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-800">
              {searching && !results.length ? (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Searching…</li>
              ) : results.length ? results.map((user) => {
                const added = linkedIds.has(user.id);
                return (
                  <li key={user.id} role="option" aria-selected={false}>
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(user)} disabled={added} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-gray-700/50">
                      <span className="min-w-0 truncate">{printedName(user)}</span>
                      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">{added ? 'Added' : user.student_id || ''}</span>
                    </button>
                  </li>
                );
              }) : (
                <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No registered student found. Type the name in the box below instead.</li>
              )}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor="batch-student-names" className={fieldLabel}>Or type / paste names</label>
          <textarea
            id="batch-student-names"
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            rows={7}
            className={`${inputStyle} ${error ? 'border-red-400 dark:border-red-500' : ''}`}
            placeholder={'One name per line, for example:\nAgutep, John Michael\nAlcantara, Lynmaine'}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">One per line. The list is sorted A to Z and repeats are removed.</p>
          {error && <p role="alert" className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
        </div>
      </div>

      <div>
        <p className={fieldLabel}>Student list <CountChip>{students.length}</CountChip></p>
        {students.length ? (
          <ol className="max-h-[22rem] space-y-1 overflow-y-auto rounded-[10px] border border-gray-100 p-2 dark:border-gray-700">
            {students.map((student, index) => (
              <li key={keyOf(student.name)} className="flex items-center gap-2 rounded-[10px] px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-400">{index + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{student.name}</span>
                {student.student_id && (
                  <span title="Linked to a registered student" className="inline-flex items-center gap-1 rounded-full bg-maroon-50 px-2 py-0.5 text-[11px] font-semibold text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-200">
                    <Link2 className="h-3 w-3" aria-hidden="true" /> Linked
                  </span>
                )}
                <button type="button" onClick={() => remove(student)} aria-label={`Remove ${student.name}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-[10px] border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">The students you add appear here, numbered, as they will print.</p>
        )}
      </div>
    </div>
  );
}
