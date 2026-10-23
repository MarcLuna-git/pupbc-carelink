import { useEffect, useRef, useState } from 'react';
import { X, Upload, FileText, FileImage, Eye, Download, Trash2, Loader2, Paperclip } from 'lucide-react';
import api from '../../../services/api';
import { Modal } from './StudentDetailsModal';
import { fullName, focus, inputStyle, primary, secondary } from './directoryOptions';

/*
 * Extra record files for one student (x-ray photos, lab results, documents).
 * Nurse-only: files are fetched with the nurse's token and opened from a
 * blob URL, so they are never reachable by a public link.
 */

export const FILE_CATEGORIES = [
  ['xray', 'X-ray'],
  ['laboratory', 'Laboratory result'],
  ['prescription', 'Prescription'],
  ['medical_document', 'Medical document'],
  ['photo', 'Photo'],
  ['other', 'Other'],
];
const categoryLabel = value => FILE_CATEGORIES.find(([key]) => key === value)?.[1] || 'Other';
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt';
const MAX_BYTES = 10 * 1024 * 1024;
const emptyForm = { file: null, category: 'xray', description: '' };

const size = bytes => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const when = value => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const errorText = (err, fallback) => Object.values(err.response?.data?.errors || {}).flat()[0] || err.response?.data?.message || fallback;

export function StudentFilesModal({ student, onClose }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const inputRef = useRef(null);
  const base = `/nurse/students/${student.id}/attachments`;

  useEffect(() => {
    const controller = new AbortController();
    api.get(base, { signal: controller.signal })
      .then(({ data }) => setFiles(Array.isArray(data.data) ? data.data : []))
      .catch(err => { if (err.code !== 'ERR_CANCELED') setError('Unable to load this student\'s files.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base]);

  const pick = file => {
    setError('');
    if (file && file.size > MAX_BYTES) { setError('The file is larger than 10 MB.'); return; }
    setForm(current => ({ ...current, file: file || null }));
  };

  const upload = async event => {
    event.preventDefault();
    if (!form.file || uploading) return;
    setUploading(true); setError('');
    try {
      const body = new FormData();
      body.append('file', form.file);
      body.append('category', form.category);
      if (form.description.trim()) body.append('description', form.description.trim());
      const { data } = await api.post(base, body, { timeout: 120000 });
      setFiles(current => [data.data, ...current]);
      setForm(emptyForm);
      if (inputRef.current) inputRef.current.value = '';
    } catch (err) {
      setError(errorText(err, 'Unable to upload the file.'));
    } finally { setUploading(false); }
  };

  // Opened inside the click so the browser does not block it; filled once the file arrives.
  const open = async (file, download = false) => {
    const tab = download ? null : window.open('', '_blank');
    setBusyId(file.id); setError('');
    try {
      const { data } = await api.get(`${base}/${file.id}/file`, { responseType: 'blob', timeout: 120000 });
      const url = URL.createObjectURL(data);
      if (tab) tab.location.href = url;
      else {
        const link = document.createElement('a');
        link.href = url; link.download = file.original_name;
        document.body.appendChild(link); link.click(); link.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      tab?.close();
      setError('Unable to open the file.');
    } finally { setBusyId(null); }
  };

  const remove = async file => {
    setBusyId(file.id); setError('');
    try {
      await api.delete(`${base}/${file.id}`);
      setFiles(current => current.filter(item => item.id !== file.id));
      setConfirmDelete(null);
    } catch (err) {
      setError(errorText(err, 'Unable to delete the file.'));
    } finally { setBusyId(null); }
  };

  const close = () => { if (!uploading) onClose(); };

  return <Modal title="Student files" onClose={close}>
    <header className="flex items-start justify-between gap-3 border-b border-gray-200 p-5 dark:border-gray-700">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-maroon-700 dark:text-maroon-300">Record files</p>
        <h2 className="mt-0.5 break-words text-lg font-semibold">{fullName(student)}</h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{student.student_id || '—'} · X-rays, laboratory results and other documents</p>
      </div>
      <button type="button" onClick={close} aria-label="Close student files" className={`rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 ${focus}`}><X size={20} /></button>
    </header>

    <div className="space-y-5 p-5">
      <form onSubmit={upload} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Upload size={16} aria-hidden="true" className="text-maroon-800 dark:text-maroon-300" />Attach a file</h3>
        <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-5 text-center text-sm hover:border-maroon-400 dark:border-gray-600 dark:bg-gray-800 ${focus}`}
          onDragOver={event => event.preventDefault()}
          onDrop={event => { event.preventDefault(); pick(event.dataTransfer.files?.[0]); }}>
          <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={event => pick(event.target.files?.[0])} />
          <Paperclip size={20} aria-hidden="true" className="text-gray-400" />
          {form.file
            ? <span className="max-w-full break-all font-medium">{form.file.name} <span className="font-normal text-gray-500">({size(form.file.size)})</span></span>
            : <span><span className="font-semibold text-maroon-800 dark:text-maroon-300">Choose a file</span> or drop it here</span>}
          <span className="text-xs text-gray-500 dark:text-gray-400">Photos (JPG, PNG, WEBP), PDF, Word, Excel or text · up to 10 MB</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Type</span>
            <select className={inputStyle} value={form.category} onChange={event => setForm(current => ({ ...current, category: event.target.value }))}>
              {FILE_CATEGORIES.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Description (optional)</span>
            <input className={inputStyle} maxLength={255} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="e.g. Chest x-ray, PA view" />
          </label>
        </div>
        <div className="flex justify-end">
          <button type="submit" className={primary} disabled={!form.file || uploading}>
            {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
            {uploading ? 'Uploading…' : 'Upload file'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

      <section aria-label="Attached files">
        <h3 className="mb-2 text-sm font-semibold">Attached files {!loading && <span className="font-normal text-gray-500">({files.length})</span>}</h3>
        {loading ? <div role="status" className="space-y-2">{[0, 1].map(key => <div key={key} className="h-14 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-700" />)}<span className="sr-only">Loading files</span></div>
          : files.length === 0 ? <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No files attached yet.</p>
            : <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
              {files.map(file => {
                const Icon = file.mime_type?.startsWith('image/') ? FileImage : FileText;
                const busy = busyId === file.id;
                return <li key={file.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Icon size={18} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-sm font-semibold">{file.original_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{categoryLabel(file.category)}</span> · {size(file.size)} · {when(file.created_at)}
                      {file.uploader && ` · ${file.uploader.first_name} ${file.uploader.last_name}`}
                    </p>
                    {file.description && <p className="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-300">{file.description}</p>}
                  </div>
                  {confirmDelete === file.id ? <div className="flex items-center gap-1">
                    <button type="button" onClick={() => remove(file)} disabled={busy} className={`rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focus}`}>{busy ? 'Deleting…' : 'Delete'}</button>
                    <button type="button" onClick={() => setConfirmDelete(null)} disabled={busy} className={secondary}>Keep</button>
                  </div> : <div className="flex items-center gap-1">
                    <button type="button" onClick={() => open(file)} disabled={busy} aria-label={`View ${file.original_name}`} title="View" className={secondary}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}</button>
                    <button type="button" onClick={() => open(file, true)} disabled={busy} aria-label={`Download ${file.original_name}`} title="Download" className={secondary}><Download size={16} /></button>
                    <button type="button" onClick={() => { setConfirmDelete(file.id); setError(''); }} disabled={busy} aria-label={`Delete ${file.original_name}`} title="Delete" className={`${secondary} text-red-600 dark:text-red-400`}><Trash2 size={16} /></button>
                  </div>}
                </li>;
              })}
            </ul>}
      </section>
    </div>

    <footer className="flex justify-end border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30"><button type="button" onClick={close} className={secondary}>Close</button></footer>
  </Modal>;
}
