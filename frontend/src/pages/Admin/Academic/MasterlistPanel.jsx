import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet, Loader2, Search, ShieldCheck, Trash2, Upload, Users, X } from 'lucide-react';
import api from '../../../services/api';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import { NurseToast } from '../../../components/NurseFeedback';
import useNurseSync from '../../../hooks/useNurseSync';
import { Pagination } from '../Students/StudentDirectory';
import { inputStyle, primary, secondary, focus } from '../Students/directoryOptions';
import { ModalShell, cancelButton } from './AcademicFormModal';
import { periodLabel } from './academicOptions';

/*
 * Course Management → Masterlist: the school's list of enrolled students.
 * The nurse imports an Excel or CSV file for an academic period, checks the preview, and saves it.
 * When the registration check is on, only students on this list can register.
 */

const TEMPLATE = 'Student ID,Last Name,First Name,Middle Name,Course,Year Level,Section\r\n2023-00001-BN-0,Dela Cruz,Juan,Santos,BSIT,3,3-1\r\n';
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

function Select({ label, value, onChange, children, disabled }) {
  return <label className="relative block min-w-0"><span className="sr-only">{label}</span><select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className={selectStyle}>{children}</select><ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" /></label>;
}

function Stat({ label, value, tone = 'text-gray-900 dark:text-white' }) {
  return <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-900/40"><p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p><p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{Number(value || 0).toLocaleString()}</p></div>;
}

export default function MasterlistPanel() {
  const [periodId, setPeriodId] = useState('');
  const [list, setList] = useState(null);
  const [filters, setFilters] = useState({ q: '', course_id: '', registered: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');

  const [importPeriod, setImportPeriod] = useState('');
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importError, setImportError] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('all');
  const [previewPage, setPreviewPage] = useState(1);
  const fileRef = useRef(null);

  const [switching, setSwitching] = useState(false);
  const [settingError, setSettingError] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');
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
      setImportPeriod(current => current || data.period_id || '');
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
  const settings = list?.settings || { required: false, active_count: 0 };
  const summary = list?.summary || { total: 0, registered: 0, not_registered: 0 };
  const rows = list?.data || [];
  const activeFilters = Boolean(filters.q || filters.course_id || filters.registered);
  const changeFilter = (key, value) => { setFilters(previous => ({ ...previous, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters({ q: '', course_id: '', registered: '' }); setPage(1); };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'masterlist-template.csv';
    document.body.appendChild(link); link.click(); link.remove();
    URL.revokeObjectURL(url);
  };

  const pickFile = event => {
    const picked = event.target.files?.[0] || null;
    setFile(picked); setPreview(null); setImportError('');
  };
  const resetImport = () => {
    setFile(null); setPreview(null); setImportError(''); setPreviewFilter('all'); setPreviewPage(1);
    if (fileRef.current) fileRef.current.value = '';
  };
  const upload = async path => {
    const body = new FormData();
    body.append('file', file);
    body.append('academic_period_id', importPeriod);
    return api.post(path, body, { timeout: 120000 });
  };
  const checkFile = async () => {
    if (!file) { setImportError('Choose a file to import.'); return; }
    if (!importPeriod) { setImportError('Choose an academic period.'); return; }
    setChecking(true); setImportError(''); setPreview(null);
    try {
      const { data } = await upload('/nurse/masterlist/preview');
      setPreview(data.data); setPreviewFilter('all'); setPreviewPage(1);
    } catch (err) { setImportError(errorText(err, 'Unable to read this file. Please try again.')); }
    finally { setChecking(false); }
  };
  const saveImport = async () => {
    setSaving(true); setImportError('');
    try {
      const { data } = await upload('/nurse/masterlist/import');
      setMessage(data.message || 'Masterlist saved.');
      resetImport();
      if (importPeriod !== periodId) { setPeriodId(importPeriod); setPage(1); } else await load();
    } catch (err) { setImportError(errorText(err, 'Unable to save the masterlist. Please try again.')); }
    finally { setSaving(false); }
  };

  const toggleRequired = async () => {
    setSwitching(true); setSettingError('');
    try {
      const { data } = await api.put('/nurse/masterlist/settings', { required: !settings.required });
      setList(previous => previous && { ...previous, settings: data.data });
      setMessage(data.message);
    } catch (err) { setSettingError(errorText(err, 'Unable to change this setting. Please try again.')); }
    finally { setSwitching(false); }
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

  const previewRows = useMemo(() => {
    if (!preview) return [];
    return preview.entries.filter(row => previewFilter === 'all' || (previewFilter === 'warning' ? row.warning : row.status === previewFilter));
  }, [preview, previewFilter]);
  const previewLast = Math.max(1, Math.ceil(previewRows.length / 10));
  const previewCurrent = Math.min(previewPage, previewLast);
  const previewVisible = previewRows.slice((previewCurrent - 1) * 10, previewCurrent * 10);
  const previewMeta = { total: previewRows.length, last_page: previewLast, from: previewRows.length ? (previewCurrent - 1) * 10 + 1 : 0, to: Math.min(previewCurrent * 10, previewRows.length) };
  const nothingToSave = preview && preview.summary.new + preview.summary.update + preview.new_courses.length === 0;

  if (loading && !list) return <div className="rounded-lg border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"><NursePageSkeleton contentOnly label="Loading masterlist" /></div>;

  return <div className="space-y-5">
    <NurseToast message={message} type="success" onClose={() => setMessage('')} />
    {loadError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300"><AlertCircle size={18} /><p className="min-w-0 flex-1">{loadError}</p><button type="button" onClick={() => load()} className={`${secondary} bg-white dark:bg-gray-800`}>Try again</button></div>}

    {/* Registration check */}
    <section aria-labelledby="masterlist-check-title" className="rounded-lg border border-gray-100 bg-white p-4 lg:p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${settings.required ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/20 dark:text-maroon-400'}`}><ShieldCheck size={20} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="masterlist-check-title" className="font-bold text-gray-900 dark:text-white">Check the masterlist on sign up</h2>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{settings.required ? 'On. Only students on the masterlist of the active period can register.' : 'Off. Any student with a valid Student ID can register.'}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{settings.active_count.toLocaleString()} students on the list for the active period. The student must type the same Student ID and last name.</p>
          </div>
        </div>
        <button type="button" role="switch" aria-checked={settings.required} aria-labelledby="masterlist-check-title" onClick={toggleRequired} disabled={switching || (!settings.required && settings.active_count === 0)} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${settings.required ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'} ${focus}`}>
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.required ? 'translate-x-6' : 'translate-x-1'}`} />
          {switching && <Loader2 size={14} className="absolute -right-6 animate-spin text-gray-400" />}
        </button>
      </div>
      {!settings.required && settings.active_count === 0 && <p className="mt-3 text-xs text-amber-700 dark:text-amber-300">Import a masterlist for the active period before you turn this on.</p>}
      {settingError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{settingError}</p>}
    </section>

    {/* Import */}
    <NurseListCard
      aria-label="Import masterlist"
      icon={Upload}
      title="Import masterlist"
      description="Upload the list from the registrar as an Excel or CSV file."
      actions={<button type="button" onClick={downloadTemplate} className={`${secondary} min-h-11`}><Download size={16} />Download template</button>}
      bodyClassName="p-4"
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <Select label="Academic period for this file" value={importPeriod} onChange={value => { setImportPeriod(value); setPreview(null); }} disabled={checking || saving}>
            <option value="">Choose academic period</option>
            {periods.map(item => <option key={item.id} value={item.id}>{periodLabel(item)}{item.is_active ? ' (active)' : ''}</option>)}
          </Select>
          <label className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/40 ${checking || saving ? 'pointer-events-none opacity-60' : ''}`}>
            <FileSpreadsheet size={17} className="shrink-0 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-200">{file ? file.name : 'Choose an .xlsx or .csv file'}</span>
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={pickFile} className="sr-only" />
          </label>
          <button type="button" onClick={checkFile} disabled={!file || !importPeriod || checking || saving} className={`${primary} min-h-11`}>{checking ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}{checking ? 'Checking…' : 'Check file'}</button>
        </div>
        <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">Two layouts work. A list with a course title row like "BS in Information Technology (BSIT)" and then one row for each student with the Student ID and the name ("Last, First M."). Or a table with a header row like the template. Nothing is saved until you press Save.</p>
        {importError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{importError}</p>}

        {preview && <div className="space-y-4 border-t border-gray-100 pt-4 dark:border-gray-700">
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

          {preview.new_courses.length > 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-900/15 dark:text-amber-200"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p>These courses are not in Course Management yet and will be added: <strong>{preview.new_courses.map(course => `${course.code} (${course.name})`).join(', ')}</strong>. Add their sections in the Sections tab so students can pick them when they sign up.</p></div>}

          {preview.errors.length > 0 && <div className="rounded-lg border border-red-200 dark:border-red-800/40">
            <p className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-200">These rows will be skipped. Fix them in the file and import again.</p>
            <ul className="max-h-56 divide-y divide-red-100 overflow-y-auto text-sm dark:divide-red-900/40">{preview.errors.map((row, index) => <li key={`${row.line}-${index}`} className="flex flex-wrap gap-x-3 gap-y-0.5 px-4 py-2"><span className="w-16 shrink-0 font-medium text-gray-500 dark:text-gray-400">Row {row.line}</span><span className="min-w-0 flex-1 text-gray-800 dark:text-gray-200">{[row.student_id, row.name].filter(Boolean).join(' · ') || 'Empty'}</span><span className="text-red-700 dark:text-red-300">{row.message}</span></li>)}</ul>
          </div>}

          <div className="flex flex-wrap gap-1" role="group" aria-label="Show rows">{PREVIEW_FILTERS.map(([key, label]) => <button key={key} type="button" onClick={() => { setPreviewFilter(key); setPreviewPage(1); }} aria-pressed={previewFilter === key} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${previewFilter === key ? 'bg-maroon-800 text-white' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/60'} ${focus}`}>{label}</button>)}</div>
          <div className="overflow-hidden rounded-lg border border-gray-100 dark:border-gray-700">
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
    </NurseListCard>

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
          <label className="relative block min-w-0"><span className="sr-only">Search the masterlist</span><Search size={17} className="absolute left-3 top-3.5 text-gray-400" aria-hidden="true" /><input type="search" value={filters.q} onChange={event => changeFilter('q', event.target.value)} placeholder="Search name or Student ID…" className={`${inputStyle} min-h-11 pl-10 pr-10`} />{filters.q && <button type="button" onClick={() => changeFilter('q', '')} aria-label="Clear search" className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 dark:text-gray-300 ${focus}`}><X size={16} /></button>}</label>
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
        {activeFilters && <div className="flex justify-end"><button type="button" onClick={clearFilters} className={`rounded-lg px-2 py-1.5 text-xs font-semibold text-maroon-800 dark:text-maroon-300 ${focus}`}>Clear filters</button></div>}
      </div>}
    >
      {!rows.length ? <div className="flex flex-col items-center px-6 py-14 text-center"><span className="rounded-2xl bg-gray-50 p-4 text-gray-400 dark:bg-gray-900/50"><Users size={28} /></span><h2 className="mt-4 font-semibold">{activeFilters ? 'No matching students' : 'No masterlist yet'}</h2><p className="mt-2 max-w-sm text-sm leading-relaxed text-gray-500 dark:text-gray-400">{activeFilters ? 'Try a different search or clear your filters.' : 'Import a file above to add the students for this period.'}</p></div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Masterlist</caption><thead className="border-b border-gray-200 bg-gray-100 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400"><tr>{['Student ID', 'Name', 'Course', 'Year & section', 'Account', 'Action'].map(label => <th key={label} scope="col" className="px-5 py-3.5 font-medium">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{rows.map(row => <tr key={row.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-700/20">
            <td className="whitespace-nowrap px-5 py-3.5 font-medium tabular-nums">{row.student_id}</td>
            <td className="px-5 py-3.5">{row.full_name}</td>
            <td className="px-5 py-3.5 font-semibold text-maroon-800 dark:text-maroon-300">{row.course_code || <span className="font-normal text-gray-400">None</span>}</td>
            <td className="px-5 py-3.5 text-gray-600 dark:text-gray-300">{yearSection(row)}</td>
            <td className="px-5 py-3.5"><AccountBadge registered={row.registered} /></td>
            <td className="px-4 py-3.5"><RemoveButton row={row} onClick={() => { setConfirm({ type: 'remove', row }); setConfirmError(''); }} /></td>
          </tr>)}</tbody></table></div>
        <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{rows.map(row => <article key={row.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{row.full_name}</h3><p className="mt-1 text-sm tabular-nums text-gray-600 dark:text-gray-300">{row.student_id}</p></div><AccountBadge registered={row.registered} /></div><div className="mt-3 flex items-center justify-between gap-3"><p className="min-w-0 text-xs text-gray-500 dark:text-gray-400">{row.course_code || 'No course'} · {yearSection(row)}</p><RemoveButton row={row} onClick={() => { setConfirm({ type: 'remove', row }); setConfirmError(''); }} /></div></article>)}</div>
      </>}
      <Pagination meta={list?.meta || { total: 0, last_page: 1 }} page={page} onPage={setPage} loading={loading} entity="students" />
    </NurseListCard>

    {list?.imports?.length > 0 && <section aria-labelledby="masterlist-imports-title" className="rounded-lg border border-gray-100 bg-white p-4 lg:p-6 dark:border-gray-700 dark:bg-gray-800">
      <h2 id="masterlist-imports-title" className="font-bold text-gray-900 dark:text-white">Recent imports</h2>
      <ul className="mt-3 divide-y divide-gray-100 text-sm dark:divide-gray-700">{list.imports.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span className="min-w-0"><span className="font-medium text-gray-900 dark:text-white">{item.file_name}</span><span className="block text-xs text-gray-500 dark:text-gray-400">{new Date(item.created_at).toLocaleString()}{item.uploader_first_name ? ` by ${item.uploader_first_name} ${item.uploader_last_name}` : ''}</span></span><span className="text-xs text-gray-600 dark:text-gray-300">{item.added_count} added · {item.updated_count} updated · {item.skipped_count} skipped</span></li>)}</ul>
    </section>}

    {confirm && <ModalShell labelledBy="masterlist-confirm-title" onClose={() => { if (!confirmBusy) setConfirm(null); }} busy={confirmBusy} width="max-w-md">
      <div className="p-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300"><AlertTriangle size={24} aria-hidden="true" /></span>
        <h2 id="masterlist-confirm-title" className="mt-4 text-lg font-bold text-gray-900 dark:text-white">{confirm.type === 'remove' ? 'Remove this student?' : 'Clear the whole list?'}</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{confirm.type === 'remove'
          ? <><strong className="font-semibold text-gray-900 dark:text-white">{confirm.row.full_name}</strong> ({confirm.row.student_id}) will be taken off the masterlist. Their account, if they have one, stays.</>
          : <>All {summary.total.toLocaleString()} students for <strong className="font-semibold text-gray-900 dark:text-white">{periodLabel(periods.find(item => item.id === periodId))}</strong> will be taken off the masterlist. Student accounts stay.</>}</p>
        {confirmError && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/25 dark:text-red-300">{confirmError}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirm(null)} disabled={confirmBusy} className={cancelButton}>Cancel</button>
          <button type="button" onClick={runConfirm} disabled={confirmBusy} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focus}`}>{confirmBusy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}{confirm.type === 'remove' ? 'Remove' : 'Clear list'}</button>
        </div>
      </div>
    </ModalShell>}
  </div>;
}

function AccountBadge({ registered }) {
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${registered ? 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>{registered ? 'Has account' : 'No account yet'}</span>;
}

function RemoveButton({ row, onClick }) {
  return <button type="button" onClick={onClick} className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 ${focus}`} aria-label={`Remove ${row.full_name} from the masterlist`}><Trash2 size={15} />Remove</button>;
}
