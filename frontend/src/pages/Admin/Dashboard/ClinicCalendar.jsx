import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Save, Trash2, X, PartyPopper, StickyNote } from 'lucide-react';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import { holidaysByDate, toDateKey } from '../../../utils/phHolidays';

/*
 * Clinic calendar for the nurse dashboard: a month grid with Philippine
 * holidays shown automatically and clinic-wide notes per date ("We have a
 * meeting"). Clicking a date opens a dialog to add, edit or delete notes.
 * Notes are stored on the server and refresh live through the 'calendar' topic.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const COLORS = {
  maroon: { chip: 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300', dot: 'bg-maroon-600', label: 'Maroon' },
  blue: { chip: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', dot: 'bg-blue-500', label: 'Blue' },
  green: { chip: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500', label: 'Green' },
  amber: { chip: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500', label: 'Amber' },
  purple: { chip: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300', dot: 'bg-purple-500', label: 'Purple' },
};
const HOLIDAY_STYLE = {
  regular: { chip: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300', dot: 'bg-red-500', label: 'Regular holiday' },
  special: { chip: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300', dot: 'bg-orange-400', label: 'Special non-working day' },
};
const emptyForm = { title: '', details: '', color: 'maroon' };

const manilaToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const keyOf = (date) => toDateKey(date.getFullYear(), date.getMonth(), date.getDate());
const longDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const errorText = (err, fallback) => Object.values(err.response?.data?.errors || {}).flat()[0] || err.response?.data?.message || fallback;

export default function ClinicCalendar() {
  const today = manilaToday();
  const [month, setMonth] = useState(() => { const [y, m] = today.split('-').map(Number); return new Date(y, m - 1, 1); });
  const [notes, setNotes] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState(null);
  const requestId = useRef(0);

  // Six full weeks so every month has the same grid height.
  const cells = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [month]);
  const from = keyOf(cells[0]);
  const to = keyOf(cells[41]);
  const holidays = useMemo(() => holidaysByDate(from, to), [from, to]);
  const notesByDate = useMemo(() => notes.reduce((map, note) => { (map[note.note_date] ||= []).push(note); return map; }, {}), [notes]);

  const load = useCallback(async (signal) => {
    const request = ++requestId.current;
    try {
      const { data } = await api.get('/nurse/calendar-notes', { params: { from, to }, signal });
      if (request !== requestId.current || signal?.aborted) return;
      setNotes(Array.isArray(data.data) ? data.data : []);
      setLoadError('');
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      setLoadError('Calendar notes could not be loaded.');
    }
  }, [from, to]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useNurseSync(['calendar'], load, `${from}:${to}`);

  const changeMonth = (step) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  const goToday = () => { const [y, m] = today.split('-').map(Number); setMonth(new Date(y, m - 1, 1)); };
  const monthLabel = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const upcomingHoliday = useMemo(() => {
    const list = Object.entries(holidaysByDate(today, `${Number(today.slice(0, 4)) + 1}-12-31`)).sort(([a], [b]) => a.localeCompare(b));
    return list.length ? { date: list[0][0], ...list[0][1][0] } : null;
  }, [today]);

  const replaceNote = (saved) => setNotes((current) => {
    const exists = current.some((note) => note.id === saved.id);
    return exists ? current.map((note) => (note.id === saved.id ? saved : note)) : [...current, saved];
  });

  return (
    <section aria-label="Clinic calendar" className="overflow-hidden rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 dark:border-gray-700 lg:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white">Clinic Calendar</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Click a date to add notes like meetings or reminders. Philippine holidays show automatically.</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="rounded-[10px] p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"><ChevronLeft className="h-5 w-5" /></button>
          <p className="min-w-36 text-center text-sm font-bold text-gray-900 dark:text-white" aria-live="polite">{monthLabel}</p>
          <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="rounded-[10px] p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"><ChevronRight className="h-5 w-5" /></button>
          <button type="button" onClick={goToday} className="ml-1 rounded-[10px] border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700/50">Today</button>
        </div>
      </header>

      <div className="space-y-4 p-4 lg:p-6">
        {loadError && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{loadError}</p>}

        <div className="overflow-hidden rounded-[10px] border border-gray-100 dark:border-gray-700">
          <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50 text-center text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400">
            {WEEKDAYS.map((day) => <div key={day} className="py-2">{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((date) => {
              const key = keyOf(date);
              const inMonth = date.getMonth() === month.getMonth();
              const isToday = key === today;
              const dayHolidays = holidays[key] || [];
              const dayNotes = notesByDate[key] || [];
              const items = [
                ...dayHolidays.map((holiday) => ({ id: `h-${holiday.name}`, text: holiday.name, style: HOLIDAY_STYLE[holiday.type] })),
                ...dayNotes.map((note) => ({ id: note.id, text: note.title, style: COLORS[note.color] || COLORS.maroon })),
              ];
              const summary = [dayHolidays.map((h) => h.name).join(', '), dayNotes.length ? `${dayNotes.length} note${dayNotes.length > 1 ? 's' : ''}` : ''].filter(Boolean).join('; ');
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelected(key)}
                  aria-label={`${longDate(key)}${summary ? `: ${summary}` : ''}`}
                  className={`group relative flex min-h-[64px] flex-col items-stretch gap-1 border-b border-r border-gray-100 p-1.5 text-left transition-colors hover:bg-maroon-50/40 [&:nth-last-child(-n+7)]:border-b-0 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-maroon-500 dark:border-gray-700 dark:hover:bg-gray-700/40 sm:min-h-[84px] sm:p-2 [&:nth-child(7n)]:border-r-0 ${
                    inMonth ? 'bg-white dark:bg-gray-800' : 'bg-gray-50/70 dark:bg-gray-900/30'
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold ${
                    isToday ? 'bg-maroon-800 text-white' : dayHolidays.length ? 'text-red-600 dark:text-red-400' : inMonth ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'
                  }`}>{date.getDate()}</span>
                  {/* Phones: colored dots. Larger screens: labelled chips. */}
                  {items.length > 0 && (
                    <span className="flex flex-wrap gap-0.5 sm:hidden" aria-hidden="true">
                      {items.slice(0, 4).map((item) => <span key={item.id} className={`h-1.5 w-1.5 rounded-full ${item.style.dot}`} />)}
                    </span>
                  )}
                  <span className="hidden min-w-0 flex-col gap-0.5 sm:flex" aria-hidden="true">
                    {items.slice(0, 2).map((item) => (
                      <span key={item.id} className={`truncate rounded px-1.5 py-0.5 text-xs font-semibold leading-tight ${item.style.chip}`}>{item.text}</span>
                    ))}
                    {items.length > 2 && <span className="px-1 text-xs font-semibold text-gray-400">+{items.length - 2} more</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Regular holiday</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange-400" />Special non-working day</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-maroon-600" />Clinic note</span>
          </div>
          {upcomingHoliday && (
            <span className="inline-flex items-center gap-1.5 font-medium text-gray-600 dark:text-gray-300">
              <PartyPopper className="h-3.5 w-3.5 text-orange-500" />
              Next holiday: {upcomingHoliday.name}, {new Date(`${upcomingHoliday.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {selected && (
        <DayNotesDialog
          dateKey={selected}
          holidays={holidays[selected] || []}
          notes={notesByDate[selected] || []}
          onClose={() => setSelected(null)}
          onSaved={replaceNote}
          onDeleted={(id) => setNotes((current) => current.filter((note) => note.id !== id))}
        />
      )}
    </section>
  );
}

function DayNotesDialog({ dateKey, holidays, notes, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef(null);

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onClose]);
  useEffect(() => { titleRef.current?.focus(); }, [editing]);

  const startEdit = (note) => { setEditing(note); setForm({ title: note.title, details: note.details || '', color: note.color || 'maroon' }); setError(''); setConfirmDelete(null); };
  const resetForm = () => { setEditing(null); setForm(emptyForm); setError(''); };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !form.title.trim()) return;
    setBusy(true); setError('');
    try {
      const body = { note_date: dateKey, title: form.title.trim(), details: form.details.trim() || null, color: form.color };
      const { data } = editing
        ? await api.put(`/nurse/calendar-notes/${editing.id}`, body, { headers: { 'If-Match': editing.sync_version } })
        : await api.post('/nurse/calendar-notes', body);
      onSaved(data.data);
      resetForm();
    } catch (err) {
      setError(errorText(err, 'Unable to save the note.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (note) => {
    setBusy(true); setError('');
    try {
      await api.delete(`/nurse/calendar-notes/${note.id}`, { headers: { 'If-Match': note.sync_version } });
      onDeleted(note.id);
      if (editing?.id === note.id) resetForm();
      setConfirmDelete(null);
    } catch (err) {
      setError(errorText(err, 'Unable to delete the note.'));
    } finally {
      setBusy(false);
    }
  };

  const inputClass = 'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="calendar-day-title" className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-[10px] bg-white shadow-2xl dark:bg-gray-800">
        <header className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-maroon-700 dark:text-maroon-400">Clinic calendar</p>
            <h2 id="calendar-day-title" className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">{longDate(dateKey)}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="rounded-[10px] p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </header>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          {holidays.map((holiday) => (
            <div key={holiday.name} className={`flex items-center gap-3 rounded-[10px] p-3 ${HOLIDAY_STYLE[holiday.type].chip}`}>
              <PartyPopper className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{holiday.name}</p>
                <p className="text-xs opacity-80">{HOLIDAY_STYLE[holiday.type].label}</p>
              </div>
            </div>
          ))}

          <div>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"><StickyNote className="h-4 w-4 text-maroon-800 dark:text-maroon-400" />Notes</h3>
            {notes.length === 0 ? (
              <p className="rounded-[10px] border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400 dark:border-gray-600">No notes for this date yet.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((note) => {
                  const color = COLORS[note.color] || COLORS.maroon;
                  return (
                    <li key={note.id} className={`rounded-[10px] border p-3 ${editing?.id === note.id ? 'border-maroon-200 bg-maroon-50/40 dark:border-maroon-900/50 dark:bg-maroon-900/10' : 'border-gray-100 dark:border-gray-700'}`}>
                      <div className="flex items-start gap-2">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color.dot}`} />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-semibold text-gray-900 dark:text-white">{note.title}</p>
                          {note.details && <p className="mt-0.5 whitespace-pre-line break-words text-xs text-gray-500 dark:text-gray-400">{note.details}</p>}
                          {note.author && <p className="mt-1 text-xs text-gray-400">Added by {note.author.first_name} {note.author.last_name}</p>}
                        </div>
                        {confirmDelete === note.id ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => remove(note)} disabled={busy} className="rounded-[10px] bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">{busy ? 'Deleting…' : 'Delete'}</button>
                            <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy} className="rounded-[10px] px-2 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">Keep</button>
                          </div>
                        ) : (
                          <div className="flex shrink-0 items-center gap-1">
                            <button type="button" onClick={() => startEdit(note)} disabled={busy} aria-label={`Edit note: ${note.title}`} className="rounded-[10px] p-1.5 text-gray-400 hover:bg-gray-100 hover:text-maroon-700 disabled:opacity-50 dark:hover:bg-gray-700"><Pencil className="h-4 w-4" /></button>
                            <button type="button" onClick={() => { setConfirmDelete(note.id); setError(''); }} disabled={busy} aria-label={`Delete note: ${note.title}`} className="rounded-[10px] p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <form onSubmit={submit} className="space-y-3 rounded-[10px] border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{editing ? 'Edit note' : 'Add a note'}</h3>
            {error && <p role="alert" className="rounded-[10px] bg-red-50 p-2.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}
            <div>
              <label htmlFor="calendar-note-title" className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Title *</label>
              <input id="calendar-note-title" ref={titleRef} className={inputClass} maxLength={120} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. We have a meeting" />
            </div>
            <div>
              <label htmlFor="calendar-note-details" className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">Details</label>
              <textarea id="calendar-note-details" className={inputClass} rows={2} maxLength={2000} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Time, place, or anything to remember" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">Color</p>
              <div role="radiogroup" aria-label="Note color" className="flex flex-wrap gap-2">
                {Object.entries(COLORS).map(([value, color]) => (
                  <button key={value} type="button" role="radio" aria-checked={form.color === value} aria-label={color.label} title={color.label}
                    onClick={() => setForm({ ...form, color: value })}
                    className={`h-7 w-7 rounded-full ${color.dot} ring-offset-2 transition dark:ring-offset-gray-800 ${form.color === value ? 'ring-2 ring-gray-900 dark:ring-white' : 'opacity-70 hover:opacity-100'}`} />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {editing && <button type="button" onClick={resetForm} disabled={busy} className="rounded-[10px] px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700/50">Cancel edit</button>}
              <button type="submit" disabled={busy || !form.title.trim()} className="inline-flex items-center gap-2 rounded-[10px] bg-maroon-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-900 disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {editing ? 'Save changes' : 'Add note'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
