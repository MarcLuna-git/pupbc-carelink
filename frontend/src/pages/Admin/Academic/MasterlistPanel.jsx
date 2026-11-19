import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, FilePenLine, FileSpreadsheet, Loader2, Pencil, Save, Search, Trash2, Upload, Users, X } from 'lucide-react';
import api from '../../../services/api';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import { NurseToast } from '../../../components/NurseFeedback';
import useNurseSync from '../../../hooks/useNurseSync';
import { formatStudentId } from '../../../utils/inputFilters';
import { Pagination } from '../Students/StudentDirectory';
import { inputStyle, primary, secondary, focus } from '../Students/directoryOptions';
import { ModalShell, cancelButton } from './AcademicFormModal';
import { periodLabel } from './academicOptions';

/*
 * Students → Masterlist tab (was under Course Management): the school's list of enrolled students.
 * The nurse imports an Excel or CSV file for an academic period, checks the preview, and saves it.
 * When the registration check is on, only students on this list can register.
 */

const STATUS = {
  new: ['New', 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'],
  update: ['Updated', 'bg-sky-50 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300'],
  same: ['No change', 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'],
};
const PREVIEW_FILTERS = [['all', 'All'], ['new', 'New'], ['update', 'Updated'], ['same', 'No change'], ['warning', 'Check name']];
const errorText = (err, fallback) => {
  const errors = err.response?.data?.errors;
  if (errors) return Object.values(errors).flat()[0];
  return err.response?.data?.message || fallback;
};
const yearSection = row => [row.year_level, row.section].filter(Boolean).join(' · ') || 'Not in file';
const selectStyle = `${inputStyle} min-h-11 cursor-pointer appearance-none pr-10`;
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
const derivedFirstName = row => {
  if (row.first_name) return row.first_name;
  if (row.full_name?.includes(',')) return row.full_name.split(',').slice(1).join(',').trim();
  const parts = (row.full_name || '').trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
};

function Select({ label, value, onChange, children, disabled }) {
  return <label className="relative block min-w-0"><span className="sr-only">{label}</span><select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className={selectStyle}>{children}</select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" /></label>;
}

function Stat({ label, value, tone = 'text-gray-900 dark:text-white' }) {
  return <div className="rounded-[10px] border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{Number(value || 0).toLocaleString()}</p></div>;
}

export default function MasterlistPanel() {
  const [periodId, setPeriodId] = useState('');
  const [list, setList] = useState(null);
  const [filters, setFilters] = useState({ q: '', course_id: '', registered: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');

  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('all');
  const [previewPage, setPreviewPage] = useState(1);
  const fileRef = useRef(null);

  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [editError, setEditError] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async signal => {
    const request = ++requestId.current;
    setLoadError('');
    try {
      const params = { page, ...(periodId ? { academic_period_id: periodId } : {}) };
      Object.entries(filters).forEach(([key, value]) => { if (value) params[key] = value; });
      const { data } = await api.get('/nurse/masterlist', { params, signal });
      if (signal?.aborted || request !== requestId.current) return;
      setList(data);
      if (!periodId && data.period_id) setPeriodId(data.period_id);
    } catch (err) { if (!signal?.aborted) setLoadError(errorText(err, 'Unable to load the masterlist. Please try again.')); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [page, periodId, filters]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => load(controller.signal), filters.q ? 300 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [load, filters.q]);
  useNurseSync(['academic'], load);

  const periods = useMemo(() => list?.periods || [], [list]);
  const summary = list?.summary || { total: 0, registered: 0, not_registered: 0 };
  const rows = list?.data || [];
  const activeFilters = Boolean(filters.q || filters.course_id || filters.registered);
  const changeFilter = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({ q: '', course_id: '', registered: '' }); setPage(1); };

  const resetImport = () => {
    setFile(null); setPreview(null); setImportError(''); setPreviewFilter('all'); setPreviewPage(1);
    if (fileRef.current) fileRef.current.value = '';
  };
  const upload = async (path, targetFile) => {
    const body = new FormData();
    body.append('file', targetFile);
    body.append('academic_period_id', periodId);
    return api.post(path, body, { timeout: 120000 });
  };
  const checkFile = async targetFile => {
    if (!targetFile) return;
    if (!periodId) { setImportError('Choose an academic period below first.'); return; }
    setChecking(true); setImportError(''); setPreview(null);
    try {
      const { data } = await upload('/nurse/masterlist/preview', targetFile);
      setPreview(data.data); setPreviewFilter('all'); setPreviewPage(1);
    } catch (err) { setImportError(errorText(err, 'Unable to read this file. Please try again.')); }
    finally { setChecking(false); }
  };
  const pickFile = event => {
    const picked = event.target.files?.[0] || null;
    setFile(picked); setPreview(null); setImportError('');
    if (picked) checkFile(picked);
  };
  const saveImport = async () => {
    if (!file) return;
    setSaving(true); setImportError('');
    try {
      const { data } = await upload('/nurse/masterlist/import', file);
      setMessage(data.message || 'Masterlist saved.');
      resetImport();
      await load();
    } catch (err) { setImportError(errorText(err, 'Unable to save the masterlist. Please try again.')); }
    finally { setSaving(false); }
  };

  const runConfirm = async () => {
    setConfirmBusy(true); setConfirmError('');
    try {
      const { data } = confirm.type === 'remove'
        ? await api.delete(`/nurse/masterlist/${confirm.row.id}`)
        : await api.post('/nurse/masterlist/clear', { academic_period_id: periodId });
      setMessage(data.message); setConfirm(null);
      await load();
    } catch (err) { setConfirmError(errorText(err, 'Unable to finish this. Please try again.')); }
    finally { setConfirmBusy(false); }
  };

  const openEdit = row => {
    setEditing({
      id: row.id,
      student_id: row.student_id || '',
      last_name: row.last_name || '',
      first_name: derivedFirstName(row),
      course_id: row.course_id || '',
      year_level: row.year_level || '',
      section: row.section || '',
    });
    setEditErrors({});
    setEditError('');
  };

  const changeEdit = (key, value) => {
    setEditing(previous => previous && { ...previous, [key]: key === 'student_id' ? formatStudentId(value) : value });
    setEditErrors(previous => (previous[key] ? { ...previous, [key]: null } : previous));
    setEditError('');
  };

  const saveEdit = async event => {
    event.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    setEditErrors({});
    setEditError('');
    try {
      const { data } = await api.put(`/nurse/masterlist/${editing.id}`, {
        student_id: editing.student_id.trim(),
        last_name: editing.last_name.trim(),
        first_name: editing.first_name.trim() || null,
        course_id: editing.course_id || null,
        year_level: editing.year_level || null,
        section: editing.section.trim() || null,
      });
      setMessage(data.message || 'Student updated on the masterlist.');
      setEditing(null);
      await load();
    } catch (err) {
      const errors = err.response?.data?.errors || {};
      setEditErrors(errors);
      setEditError(Object.keys(errors).length ? '' : errorText(err, 'Unable to save changes. Please try again.'));
    } finally {
      setEditSaving(false);
    }
  };

  const previewRows = useMemo(() => {
    if (!preview) return [];
    return preview.entries.filter(row => previewFilter === 'all' || (previewFilter === 'warning' ? row.warning : row.status === previewFilter));
  }, [preview, previewFilter]);
  const previewLast = Math.max(1, Math.ceil(previewRows.length / 10));
  const previewCurrent = Math.min(previewPage, previewLast);
  const previewVisible = previewRows.slice((previewCurrent - 1) * 10, previewCurrent * 10);
  const previewMeta = { total: previewRows.length, last_page: previewLast, from: previewRows.length ? (previewCurrent - 1) * 10 + 1 : 0, to: Math.min(previewCurrent * 10, previewRows.length) };
  const nothingToSave = preview && preview.summary.new + preview.summary.update + preview.new_courses.length === 0;

  if (loading && !list) return <div className="rounded-[10px] border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><NursePageSkeleton contentOnly label="Loading masterlist" /></div>;

  return <div className="space-y-5">
    <NurseToast message={message} type="success" onClose={() => setMessage('')} />
    {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[10px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"><AlertCircle size={18} /><p className="min-w-0 flex-1">{loadError}</p><button type="button" onClick={() => load()} className={`${secondary} bg-white dark:bg-gray-800`}>Try again</button></div>}

    {/* Import */}
    <section aria-label="Import masterlist" className="overflow-hidden rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 dark:text-white">Import masterlist</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Upload the list from the registrar as an Excel or CSV file.</p>
          </div>
        </div>
        <label className={`${primary} min-h-11 max-w-[240px] cursor-pointer ${checking || saving ? 'pointer-events-none opacity-60' : ''}`}>
          {checking ? <Loader2 size={16} className="shrink-0 animate-spin" aria-hidden="true" /> : <FileSpreadsheet size={16} className="shrink-0" aria-hidden="true" />}
          <span className="truncate">{checking ? 'Checking…' : file ? file.name : 'Import Excel / CSV'}</span>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={pickFile} disabled={checking || saving} className="sr-only" />
        </label>
      </header>

      {(importError || preview) && (
        <div className="space-y-4 border-t border-gray-100 p-4 dark:border-gray-700 lg:px-6">
          {importError && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{importError}</p>}

          {preview && <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-600 dark:text-gray-300"><strong className="font-semibold text-gray-900 dark:text-white">{preview.file_name}</strong> for {periodLabel(preview.period)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Students read" value={preview.summary.students} />
              <Stat label="New" value={preview.summary.new} tone="text-green-700 dark:text-green-300" />
              <Stat label="Updated" value={preview.summary.update} tone="text-sky-700 dark:text-sky-300" />
              <Stat label="No change" value={preview.summary.same} />
              <Stat label="Check name" value={preview.summary.warnings} tone="text-amber-700 dark:text-amber-300" />
              <Stat label="Skipped rows" value={preview.summary.errors} tone="text-red-700 dark:text-red-300" />
            </div>

            {preview.new_courses.length > 0 && <div className="flex items-start gap-2 rounded-[10px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/15 dark:text-amber-200"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p>These courses are not in Course Management yet and will be added: <strong>{preview.new_courses.map(course => `${course.code} (${course.name})`).join(', ')}</strong>. Add their sections in the Sections tab so students can pick them when they sign up.</p></div>}

            {preview.errors.length > 0 && <div className="rounded-[10px] border border-red-200 dark:border-red-800/40">
              <p className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">These rows will be skipped. Fix them in the file and import again.</p>
              <ul className="max-h-56 divide-y divide-red-100 overflow-y-auto text-sm dark:divide-red-900/40">{preview.errors.map((row, index) => <li key={`${row.line}-${index}`} className="flex flex-wrap gap-x-3 gap-y-0.5 px-4 py-2"><span className="w-16 shrink-0 font-medium text-gray-500 dark:text-gray-400">Row {row.line}</span><span className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">{[row.student_id, row.name].filter(Boolean).join(' · ') || 'Empty'}</span><span className="text-red-700 dark:text-red-300">{row.message}</span></li>)}</ul>
            </div>}

            <div className="flex flex-wrap gap-1" role="group" aria-label="Show rows">{PREVIEW_FILTERS.map(([key, label]) => <button key={key} type="button" onClick={() => { setPreviewFilter(key); setPreviewPage(1); }} aria-pressed={previewFilter === key} className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold ${previewFilter === key ? 'bg-maroon-800 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60'} ${focus}`}>{label}</button>)}</div>
            <div className="overflow-hidden rounded-[10px] border border-gray-100 dark:border-gray-700">
              {previewVisible.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Students in the file</caption><thead className="border-b border-gray-200 bg-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400"><tr>{['Row', 'Student ID', 'Name', 'Course', 'Year & section', 'Status'].map(label => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{previewVisible.map(row => <tr key={row.student_id}>
                  <td className="px-4 py-3 tabular-nums text-gray-500 dark:text-gray-400">{row.line}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{row.student_id}</td>
                  <td className="px-4 py-3"><p>{row.full_name}</p>{row.warning && <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">{row.warning} Last name: <strong>{row.last_name}</strong></p>}</td>
                  <td className="px-4 py-3">{row.course_code || <span className="text-gray-400">None</span>}{row.new_course && <span className="ml-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">New</span>}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{yearSection(row)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS[row.status][1]}`}>{STATUS[row.status][0]}</span></td>
                </tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No rows to show.</p>}
              <Pagination meta={previewMeta} page={previewCurrent} onPage={setPreviewPage} entity="rows" />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={resetImport} disabled={saving} className={cancelButton}>Cancel</button>
              <button type="button" onClick={saveImport} disabled={saving || !preview.summary.students || nothingToSave} className={`${primary} min-h-11`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{saving ? 'Saving…' : nothingToSave ? 'Nothing new to save' : `Save ${(preview.summary.new + preview.summary.update).toLocaleString()} students`}</button>
            </div>
          </div>}
        </div>
      )}
    </section>

    {/* Saved list */}
    <NurseListCard
      aria-label="Masterlist"
      aria-busy={loading}
      icon={Users}
      title={<>Masterlist<CountChip>{summary.total.toLocaleString()}</CountChip></>}
      description="Students on the school list for the chosen period, and who already have an account."
      actions={<button type="button" onClick={() => { setConfirm({ type: 'clear' }); setConfirmError(''); }} disabled={!summary.total} className={`${secondary} min-h-11 text-red-600 dark:text-red-300`}><Trash2 size={16} />Clear list</button>}
      toolbar={<div className="space-y-3">
        <div className="grid grid-cols-3 gap-2 sm:max-w-lg">
          <Stat label="On the list" value={summary.total} />
          <Stat label="Has an account" value={summary.registered} tone="text-green-700 dark:text-green-300" />
          <Stat label="No account yet" value={summary.not_registered} />
        </div>
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(200px,1.2fr)_minmax(220px,2fr)_repeat(2,minmax(150px,1fr))]">
          <Select label="Academic period" value={periodId} onChange={value => { setPeriodId(value); setPage(1); }}>
            {periods.map(item => <option key={item.id} value={item.id}>{periodLabel(item)}{item.is_active ? ' (active)' : ''}</option>)}
          </Select>
          <label className="relative block min-w-0"><span className="sr-only">Search the masterlist</span><Search size={17} className="absolute left-3 top-3.5 text-gray-400" aria-hidden="true" /><input type="search" value={filters.q} onChange={event => changeFilter('q', event.target.value)} placeholder="Search name or Student ID…" className={`${inputStyle} min-h-11 pl-10 pr-10`} />{filters.q && <button type="button" onClick={() => changeFilter('q', '')} aria-label="Clear search" className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-[10px] text-gray-500 dark:text-gray-300 ${focus}`}><X size={16} /></button>}</label>
          <Select label="Filter by course" value={filters.course_id} onChange={value => changeFilter('course_id', value)}>
            <option value="">All courses</option>
            {(list?.courses || []).map(item => <option key={item.course_id} value={item.course_id}>{item.course_code} ({item.total})</option>)}
          </Select>
          <Select label="Filter by account" value={filters.registered} onChange={value => changeFilter('registered', value)}>
            <option value="">Everyone</option>
            <option value="yes">Has an account</option>
            <option value="no">No account yet</option>
          </Select>
        </div>
        {activeFilters && <div className="flex justify-end"><button type="button" onClick={clearFilters} className={`rounded-[10px] px-2 py-1.5 text-xs font-semibold text-maroon-800 dark:text-maroon-300 ${focus}`}>Clear filters</button></div>}
      </div>}
    >
      {!rows.length ? <div className="flex flex-col items-center px-6 py-14 text-center"><span className="rounded-[10px] bg-gray-50 p-4 text-gray-400 dark:bg-gray-900/50"><Users size={28} /></span><h2 className="mt-4 font-semibold">{activeFilters ? 'No matching students' : 'No masterlist yet'}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{activeFilters ? 'Try a different search or clear your filters.' : 'Import a file above to add the students for this period.'}</p></div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Masterlist</caption><thead className="border-b border-gray-200 bg-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400"><tr>{['Student ID', 'Name', 'Course', 'Year & section', 'Account', 'Actions'].map(label => <th key={label} scope="col" className="px-5 py-3.5 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{rows.map(row => <tr key={row.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
            <td className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums">{row.student_id}</td>
            <td className="px-5 py-3.5">{row.full_name}</td>
            <td className="px-5 py-3.5 font-semibold text-maroon-800 dark:text-maroon-300">{row.course_code || <span className="font-normal text-gray-400">None</span>}</td>
            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{yearSection(row)}</td>
            <td className="px-5 py-3.5"><AccountBadge registered={row.registered} /></td>
            <td className="px-4 py-3.5"><RowActions row={row} onEdit={() => openEdit(row)} onDelete={() => { setConfirm({ type: 'remove', row }); setConfirmError(''); }} /></td>
          </tr>)}</tbody></table></div>
        <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{rows.map(row => <article key={row.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{row.full_name}</h3><p className="mt-1 text-sm tabular-nums text-gray-600 dark:text-gray-300">{row.student_id}</p></div><AccountBadge registered={row.registered} /></div><div className="mt-3 flex items-center justify-between gap-3"><p className="min-w-0 text-xs text-gray-500 dark:text-gray-400">{row.course_code || 'No course'} · {yearSection(row)}</p><RowActions row={row} onEdit={() => openEdit(row)} onDelete={() => { setConfirm({ type: 'remove', row }); setConfirmError(''); }} /></div></article>)}</div>
      </>}
      <Pagination meta={list?.meta || { total: 0, last_page: 1 }} page={page} onPage={setPage} loading={loading} entity="students" />
    </NurseListCard>

    {list?.imports?.length > 0 && <section aria-labelledby="masterlist-imports-title" className="rounded-[10px] border border-gray-100 bg-white p-4 lg:p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 id="masterlist-imports-title" className="font-bold text-gray-900 dark:text-white">Recent imports</h2>
      <ul className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-700">{list.imports.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span className="min-w-0"><span className="font-medium text-gray-900 dark:text-white">{item.file_name}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{new Date(item.created_at).toLocaleString()}{item.uploader_first_name ? ` by ${item.uploader_first_name} ${item.uploader_last_name}` : ''}</span></span><span className="text-xs text-gray-600 dark:text-gray-300">{item.added_count} added · {item.updated_count} updated · {item.skipped_count} skipped</span></li>)}</ul>
    </section>}

    {confirm && <ModalShell labelledBy="masterlist-confirm-title" onClose={() => { if (!confirmBusy) setConfirm(null); }} busy={confirmBusy} width="max-w-md">
      <div className="p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={24} aria-hidden="true" /></span>
        <h2 id="masterlist-confirm-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{confirm.type === 'remove' ? 'Delete this student?' : 'Clear the whole list?'}</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{confirm.type === 'remove'
          ? <><strong className="font-semibold text-gray-900 dark:text-white">{confirm.row.full_name}</strong> ({confirm.row.student_id}) will be taken off the masterlist. Their account, if they have one, stays.</>
          : <>All {summary.total.toLocaleString()} students for <strong className="font-semibold text-gray-900 dark:text-white">{periodLabel(periods.find(item => item.id === periodId))}</strong> will be taken off the masterlist. Student accounts stay.</>}</p>
        {confirmError && <p role="alert" className="mt-4 rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{confirmError}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirm(null)} disabled={confirmBusy} className={cancelButton}>Cancel</button>
          <button type="button" onClick={runConfirm} disabled={confirmBusy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focus}`}>{confirmBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{confirm.type === 'remove' ? 'Delete' : 'Clear list'}</button>
        </div>
      </div>
    </ModalShell>}

    {editing && <MasterlistEditModal
      form={editing}
      courses={list?.all_courses || []}
      saving={editSaving}
      errors={editErrors}
      error={editError}
      onChange={changeEdit}
      onClose={() => { if (!editSaving) setEditing(null); }}
      onSubmit={saveEdit}
    />}
  </div>;
}

function AccountBadge({ registered }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${registered ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{registered ? 'Has account' : 'No account yet'}</span>;
}

function RowActions({ row, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={onEdit} className={`inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-950 ${focus}`} aria-label={`Edit ${row.full_name} on the masterlist`}><Pencil size={15} />Edit</button>
      <button type="button" onClick={onDelete} className={`inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 ${focus}`} aria-label={`Delete ${row.full_name} from the masterlist`}><Trash2 size={15} />Delete</button>
    </div>
  );
}

function MasterlistEditModal({ form, courses, saving, errors, error, onChange, onClose, onSubmit }) {
  const fieldClass = key => `${inputStyle} min-h-11 disabled:opacity-60 ${errors[key] ? 'border-red-400 dark:border-red-400' : ''}`;
  const fieldError = key => errors[key] ? <p role="alert" className="mt-1.5 text-xs text-red-700 dark:text-red-300">{Array.isArray(errors[key]) ? errors[key][0] : errors[key]}</p> : null;

  return (
    <ModalShell labelledBy="masterlist-edit-title" onClose={onClose} busy={saving} width="max-w-2xl">
      <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700 sm:px-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400"><FilePenLine size={20} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="masterlist-edit-title" className="font-bold text-gray-900 dark:text-white">Edit masterlist student</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Update the Student ID, name, or academic details on this list.</p>
        </div>
        <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className={`rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button>
      </header>
      <form onSubmit={onSubmit} aria-busy={saving} className="flex min-h-0 flex-col">
        <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="masterlist-edit-student-id" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Student ID</label>
              <input id="masterlist-edit-student-id" type="text" required maxLength={17} value={form.student_id} onChange={event => onChange('student_id', event.target.value)} disabled={saving} placeholder="2023-00001-BN-0" autoComplete="off" className={`${fieldClass('student_id')} tabular-nums`} />
              {fieldError('student_id')}
            </div>
            <div>
              <label htmlFor="masterlist-edit-course" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Course</label>
              <div className="relative">
                <select id="masterlist-edit-course" value={form.course_id} onChange={event => onChange('course_id', event.target.value)} disabled={saving} className={`${fieldClass('course_id')} cursor-pointer appearance-none pr-10`}>
                  <option value="">None</option>
                  {courses.map(course => <option key={course.id} value={course.id}>{course.code} — {course.name}{!course.is_active ? ' (inactive)' : ''}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {fieldError('course_id')}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="masterlist-edit-last-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Last name</label>
              <input id="masterlist-edit-last-name" type="text" required maxLength={100} value={form.last_name} onChange={event => onChange('last_name', event.target.value)} disabled={saving} autoComplete="off" className={fieldClass('last_name')} />
              {fieldError('last_name')}
            </div>
            <div>
              <label htmlFor="masterlist-edit-first-name" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">First &amp; middle name</label>
              <input id="masterlist-edit-first-name" type="text" maxLength={150} value={form.first_name} onChange={event => onChange('first_name', event.target.value)} disabled={saving} autoComplete="off" className={fieldClass('first_name')} />
              {fieldError('first_name')}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="masterlist-edit-year" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Year level</label>
              <div className="relative">
                <select id="masterlist-edit-year" value={form.year_level} onChange={event => onChange('year_level', event.target.value)} disabled={saving} className={`${fieldClass('year_level')} cursor-pointer appearance-none pr-10`}>
                  <option value="">Not set</option>
                  {YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {fieldError('year_level')}
            </div>
            <div>
              <label htmlFor="masterlist-edit-section" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">Section</label>
              <input id="masterlist-edit-section" type="text" maxLength={20} value={form.section} onChange={event => onChange('section', event.target.value)} disabled={saving} placeholder="3-1" autoComplete="off" className={fieldClass('section')} />
              {fieldError('section')}
            </div>
          </div>
        </div>
        <footer className="flex justify-end gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-700 sm:px-6">
          <button type="button" onClick={onClose} disabled={saving} className={cancelButton}>Cancel</button>
          <button type="submit" disabled={saving} className={`${primary} min-h-11`}>{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{saving ? 'Saving…' : 'Save changes'}</button>
        </footer>
      </form>
    </ModalShell>
  );
}
