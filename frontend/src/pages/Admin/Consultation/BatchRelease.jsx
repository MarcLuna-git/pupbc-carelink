import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, FileCheck, Printer, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { getUser } from '../../../services/session';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import { inputStyle, primary, secondary } from '../Students/directoryOptions';
import { buildRecordDocument } from '../../Student/HealthRecords/recordDocuments';

/*
 * Nurse portal → Consultation → Batch Release. Medical Clearance: one certification for a batch of students (for example a
 * section joining an off-campus activity). There is no master list yet, so the nurse types or pastes the names.
 */
const label = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
const EMPTY = { activity: '', venue: '', group_label: '', activity_date: '', certified_date: today(), names: '' };

// One name per line: trimmed, no blanks, no repeats (any letter case), A to Z.
const parseNames = (text) => {
  const seen = new Map();
  text.split(/\r?\n/).forEach((line) => {
    const name = line.replace(/\s+/g, ' ').trim();
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
};

const formatDay = (value) => {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const nurseLabel = (user) => `Nurse ${[user?.first_name, user?.last_name].filter(Boolean).join(' ')}`.trim();

// What the print template needs, from the form (a draft) or from a saved clearance.
const toRecord = (source, staff) => ({
  id: source.id || 'draft',
  activity: source.activity,
  venue: source.venue,
  groupLabel: source.group_label || '',
  activityDate: source.activity_date,
  certifiedDate: source.certified_date,
  students: source.students,
  staff,
  staffRole: 'Campus Nurse',
});

export default function BatchRelease() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [clearances, setClearances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  // The document is shown on this page (not in a pop-up), as it will print.
  const [preview, setPreview] = useState(null); // { html, title } | 'loading' | null
  const [previewHeight, setPreviewHeight] = useState(1100);
  const previewFrame = useRef(null);
  const previewPanel = useRef(null);
  const printWhenLoaded = useRef(false);

  const names = useMemo(() => parseNames(form.names), [form.names]);
  const me = getUser();

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/nurse/medical-clearances');
      setClearances(data.data || []);
      setLoadError('');
    } catch {
      setLoadError('The issued clearances could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const removeName = (name) => setForm((current) => ({
    ...current,
    names: current.names.split(/\r?\n/).filter((line) => line.replace(/\s+/g, ' ').trim().toLowerCase() !== name.toLowerCase()).join('\n'),
  }));

  const validate = () => {
    const found = {};
    if (!form.activity.trim()) found.activity = 'Enter the activity.';
    if (!form.venue.trim()) found.venue = 'Enter the venue.';
    if (!form.activity_date) found.activity_date = 'Enter the date of the activity.';
    if (!form.certified_date) found.certified_date = 'Enter the date of the certification.';
    if (!names.length) found.names = 'Add at least one student name.';
    setErrors(found);
    return Object.keys(found).length === 0;
  };

  const draft = () => toRecord({ ...form, activity: form.activity.trim(), venue: form.venue.trim(), group_label: form.group_label.trim(), students: names }, nurseLabel(me));

  // Build the page and show it below the form; `print` also opens the print dialog once it has loaded.
  const show = async (record, print = false) => {
    printWhenLoaded.current = print;
    setPreview('loading');
    setTimeout(() => previewPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    try {
      const html = await buildRecordDocument('clearance', record, {});
      setPreview({ html, title: record.activity });
    } catch {
      setPreview(null);
      setMessage({ type: 'error', text: 'The document could not be prepared.' });
    }
  };

  const fitPreview = () => {
    const frame = previewFrame.current;
    const doc = frame?.contentDocument;
    if (doc?.documentElement) setPreviewHeight(Math.max(640, doc.documentElement.scrollHeight + 8));
    if (printWhenLoaded.current) {
      printWhenLoaded.current = false;
      frame?.contentWindow?.focus();
      frame?.contentWindow?.print();
    }
  };

  const printPreview = () => {
    previewFrame.current?.contentWindow?.focus();
    previewFrame.current?.contentWindow?.print();
  };

  const previewDraft = () => { if (validate()) show(draft()); };

  const saveAndPrint = async () => {
    if (!validate()) return;
    setSaving(true);
    setMessage(null);
    try {
      const { data } = await api.post('/nurse/medical-clearances', {
        activity: form.activity.trim(), venue: form.venue.trim(), group_label: form.group_label.trim() || null,
        activity_date: form.activity_date, certified_date: form.certified_date, students: names,
      });
      setMessage({ type: 'success', text: 'Medical clearance saved.' });
      show(toRecord(data.data, nurseLabel(me)), true);
      setForm({ ...EMPTY, certified_date: today() });
      load();
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      setErrors(Object.fromEntries(Object.entries(apiErrors).map(([key, value]) => [key.startsWith('students') ? 'names' : key, value[0]])));
      setMessage({ type: 'error', text: err.response?.data?.message || 'The medical clearance could not be saved.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/nurse/medical-clearances/${id}`);
      setConfirmId(null);
      setMessage({ type: 'success', text: 'Medical clearance deleted.' });
      load();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'The medical clearance could not be deleted.' });
    }
  };

  const fieldError = (name) => errors[name] && <p role="alert" className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">{errors[name]}</p>;
  const invalid = (name) => (errors[name] ? 'border-red-400 dark:border-red-500' : '');

  return (
    <div className="space-y-5">
      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-lg px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'}`}>{message.text}</p>
      )}

      <NurseListCard
        aria-label="New medical clearance"
        icon={FileCheck}
        title="New Medical Clearance"
        description="One certification for a batch of students who were assessed and are fit to join an activity."
        bodyClassName="p-4 lg:p-5"
      >
        <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="clearance-activity" className={label}>Activity<span className="text-red-600" aria-hidden="true"> *</span></label>
                <input id="clearance-activity" name="activity" value={form.activity} onChange={change} className={`${inputStyle} ${invalid('activity')}`} maxLength={191} placeholder="e.g. Trimex" />
                {fieldError('activity')}
              </div>
              <div>
                <label htmlFor="clearance-group" className={label}>Group / Section (optional)</label>
                <input id="clearance-group" name="group_label" value={form.group_label} onChange={change} className={inputStyle} maxLength={100} placeholder="e.g. BSCPE" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="clearance-venue" className={label}>Venue<span className="text-red-600" aria-hidden="true"> *</span></label>
                <input id="clearance-venue" name="venue" value={form.venue} onChange={change} className={`${inputStyle} ${invalid('venue')}`} maxLength={191} placeholder="e.g. Lyceum of the Philippines University-Cavite" />
                {fieldError('venue')}
              </div>
              <div>
                <label htmlFor="clearance-activity-date" className={label}>Date of the activity<span className="text-red-600" aria-hidden="true"> *</span></label>
                <input id="clearance-activity-date" type="date" name="activity_date" value={form.activity_date} onChange={change} className={`${inputStyle} ${invalid('activity_date')}`} />
                {fieldError('activity_date')}
              </div>
              <div>
                <label htmlFor="clearance-certified-date" className={label}>Date of the certification<span className="text-red-600" aria-hidden="true"> *</span></label>
                <input id="clearance-certified-date" type="date" name="certified_date" value={form.certified_date} onChange={change} className={`${inputStyle} ${invalid('certified_date')}`} />
                {fieldError('certified_date')}
              </div>
            </div>

            <div>
              <label htmlFor="clearance-names" className={label}>Students<span className="text-red-600" aria-hidden="true"> *</span></label>
              <textarea id="clearance-names" name="names" value={form.names} onChange={change} rows={9} className={`${inputStyle} ${invalid('names')}`} placeholder={'One name per line, for example:\nAgutep, John Michael\nAlcantara, Lynmaine'} />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Type or paste the names, one per line. They are sorted A to Z and repeats are removed.</p>
              {fieldError('names')}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={previewDraft} className={secondary}><Eye className="h-4 w-4" aria-hidden="true" /> Preview</button>
              <button type="button" onClick={saveAndPrint} disabled={saving} className={primary}><Printer className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save and Print'}</button>
            </div>
          </div>

          <div>
            <p className={label}>Student list <CountChip>{names.length}</CountChip></p>
            {names.length ? (
              <ol className="max-h-[26rem] space-y-1 overflow-y-auto rounded-lg border border-gray-100 p-2 dark:border-gray-700">
                {names.map((name, index) => (
                  <li key={name.toLowerCase()} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/40">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-400">{index + 1}.</span>
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    <button type="button" onClick={() => removeName(name)} aria-label={`Remove ${name}`} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">The names you add appear here, numbered, as they will print.</p>
            )}
          </div>
        </div>
      </NurseListCard>

      {/* Always on the page: an empty state until the nurse clicks Preview, then the document as it will print. */}
      <div ref={previewPanel} className="scroll-mt-4">
      <NurseListCard
        aria-label="Document preview"
        icon={Eye}
        title="Document Preview"
        description="The Medical Clearance as it will print. Fill in the form above, then click Preview."
        actions={preview && preview !== 'loading' ? (
          <>
            <button type="button" onClick={printPreview} className={primary}><Printer className="h-4 w-4" aria-hidden="true" /> Print</button>
            <button type="button" onClick={() => setPreview(null)} className={secondary}><X className="h-4 w-4" aria-hidden="true" /> Clear</button>
          </>
        ) : null}
        bodyClassName="p-4 lg:p-5"
      >
        {preview === 'loading' ? (
          <p role="status" className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Preparing the document…</p>
        ) : preview ? (
          <iframe
            ref={previewFrame}
            title={`Medical clearance preview: ${preview.title}`}
            srcDoc={preview.html}
            sandbox="allow-same-origin allow-modals"
            onLoad={fitPreview}
            style={{ height: previewHeight }}
            className="w-full rounded-lg border border-gray-200 bg-[#f4f1f0] dark:border-gray-600"
          />
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 dark:bg-gray-700/50"><FileCheck className="h-7 w-7 text-gray-300 dark:text-gray-500" aria-hidden="true" /></span>
            <h3 className="mt-4 font-semibold">No preview yet</h3>
            <p className="mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">Complete the activity details and the student list, then click Preview to see the document here.</p>
          </div>
        )}
      </NurseListCard>
      </div>

      <NurseListCard
        aria-label="Issued medical clearances"
        icon={FileCheck}
        title={<>Issued Medical Clearances<CountChip>{loading ? '…' : loadError ? '—' : clearances.length}</CountChip></>}
        description="Re-open or print a clearance that was already issued."
      >
        {loadError ? (
          <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600 dark:text-red-300">{loadError}</p><button type="button" className={secondary} onClick={load}>Try again</button></div>
        ) : loading ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : clearances.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Certified</th>
                  <th scope="col" className="px-4 py-3">Activity</th>
                  <th scope="col" className="px-4 py-3">Venue</th>
                  <th scope="col" className="px-4 py-3">Group</th>
                  <th scope="col" className="px-4 py-3 text-right">Students</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {clearances.map((item) => {
                  const staff = item.issuer ? nurseLabel(item.issuer) : nurseLabel(me);
                  return (
                    <tr key={item.id}>
                      <td className="whitespace-nowrap px-4 py-3">{formatDay(item.certified_date)}</td>
                      <td className="px-4 py-3 font-medium">{item.activity}<span className="block text-xs font-normal text-gray-500 dark:text-gray-400">on {formatDay(item.activity_date)}</span></td>
                      <td className="px-4 py-3">{item.venue}</td>
                      <td className="px-4 py-3">{item.group_label || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.students?.length || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {confirmId === item.id ? (
                            <>
                              <span className="text-xs font-semibold text-red-700 dark:text-red-400">Delete?</span>
                              <button type="button" onClick={() => remove(item.id)} className="rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800">Yes</button>
                              <button type="button" onClick={() => setConfirmId(null)} className={`${secondary} !px-2.5 !py-1.5 text-xs`}>No</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => show(toRecord(item, staff))} className={`${secondary} !px-2.5 !py-1.5`} aria-label={`View clearance for ${item.activity}`}><Eye className="h-4 w-4" /></button>
                              <button type="button" onClick={() => show(toRecord(item, staff), true)} className={`${secondary} !px-2.5 !py-1.5`} aria-label={`Print clearance for ${item.activity}`}><Printer className="h-4 w-4" /></button>
                              <button type="button" onClick={() => setConfirmId(item.id)} className={`${secondary} !px-2.5 !py-1.5 text-red-700 dark:text-red-400`} aria-label={`Delete clearance for ${item.activity}`}><Trash2 className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-14 text-center">
            <h2 className="font-semibold">No medical clearances issued yet.</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Clearances you save will appear here.</p>
          </div>
        )}
      </NurseListCard>
    </div>
  );
}
