import { useEffect, useRef, useState } from 'react';
import { Upload, FileText, FileImage, Eye, Download, Trash2, Loader2, Paperclip } from 'lucide-react';
import api from '../../../services/api';
import { focus, inputStyle, primary, secondary } from './directoryOptions';
import { IMAGE_MAX_BYTES, isImageFile, shrinkImage } from '../../../utils/shrinkImage';

/*
 * The "Documents" tab of a student's record: x-ray photos, laboratory results, prescriptions and
 * other files. Nurse-only: files are fetched with the nurse's token and opened from a blob URL, so
 * they are never reachable by a public link. Photos are shrunk to 200 KB or less before they are
 * uploaded (they are stored in the database); other documents keep the 10 MB limit.
 */

const FILE_CATEGORIES = [
  ['xray', 'X-ray'],
  ['laboratory', 'Laboratory result'],
  ['prescription', 'Prescription'],
  ['medical_document', 'Medical document'],
  ['photo', 'Photo'],
  ['other', 'Other'],
];
const categoryLabel = value => FILE_CATEGORIES.find(([key]) => key === value)?.[1] || 'Other';
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.txt';
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const emptyForm = { file: null, category: 'xray', description: '' };

const size = bytes => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const when = value => new Date(value).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const errorText = (err, fallback) => Object.values(err.response?.data?.errors || {}).flat()[0] || err.response?.data?.message || fallback;

export default function StudentDocuments({ student }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const inputRef = useRef(null);
  const base = `/nurse/students/${student.id}/attachments`;

  useEffect(() => {
    const controller = new AbortController();
    api.get(base, { signal: controller.signal })
      .then(({ data }) => setFiles(Array.isArray(data.data) ? data.data : []))
      .catch(err => { if (err.code !== 'ERR_CANCELED') setError('Unable to load this student\'s documents.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [base]);

  const choose = file => setForm(current => ({ ...current, file }));

  // A big photo is shrunk to 200 KB or less here, so the nurse never has to resize it by hand.
  const pick = async file => {
    setError(''); setNotice('');
    if (!file) { choose(null); return; }
    if (!isImageFile(file)) {
      if (file.size > MAX_DOCUMENT_BYTES) { setError('The file is larger than 10 MB.'); return; }
      choose(file); return;
    }
    if (file.size <= IMAGE_MAX_BYTES) { choose(file); return; }
    setPreparing(true);
    try {
      const small = await shrinkImage(file);
      if (!small) { setError('This photo has too much detail to reduce to 200 KB. Try a smaller or cropped picture.'); return; }
      setNotice(`Photo reduced from ${size(file.size)} to ${size(small.size)}.`);
      choose(small);
    } catch {
      setError('This image could not be read. Try a different file.');
    } finally { setPreparing(false); }
  };

  const upload = async event => {
    event.preventDefault();
    if (!form.file || uploading || preparing) return;
    setUploading(true); setError('');
    try {
      const body = new FormData();
      body.append('file', form.file);
      body.append('category', form.category);
      if (form.description.trim()) body.append('description', form.description.trim());
      const { data } = await api.post(base, body, { timeout: 120000 });
      setFiles(current => [data.data, ...current]);
      setForm(emptyForm); setNotice('');
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

  return <div className="space-y-5">
    <form onSubmit={upload} className="space-y-3 rounded-[10px] border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/30">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><Upload size={16} aria-hidden="true" className="text-maroon-800 dark:text-maroon-300" />Add a document</h3>
      <label className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-2 border-dashed border-gray-300 bg-white px-4 py-5 text-center text-sm hover:border-maroon-400 dark:border-gray-600 dark:bg-gray-800 ${focus}`}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); pick(event.dataTransfer.files?.[0]); }}>
        <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={event => pick(event.target.files?.[0])} />
        {preparing ? <Loader2 size={20} aria-hidden="true" className="animate-spin text-gray-400" /> : <Paperclip size={20} aria-hidden="true" className="text-gray-400" />}
        {preparing
          ? <span role="status" className="font-medium">Reducing the photo…</span>
          : form.file
            ? <span className="max-w-full break-all font-medium">{form.file.name} <span className="font-normal text-gray-500">({size(form.file.size)})</span></span>
            : <span><span className="font-semibold text-maroon-800 dark:text-maroon-300">Choose a file</span> or drop it here</span>}
        <span className="text-xs text-gray-500 dark:text-gray-400">Photos (JPG, PNG, WEBP) are reduced to 200 KB automatically · PDF, Word, Excel or text up to 10 MB</span>
      </label>
      {notice && <p role="status" className="text-xs font-medium text-green-700 dark:text-green-400">{notice}</p>}
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
        <button type="submit" className={primary} disabled={!form.file || uploading || preparing}>
          {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </form>

    {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">{error}</p>}

    <section aria-label="Documents on file">
      <h3 className="mb-2 text-sm font-semibold">On file {!loading && <span className="font-normal text-gray-500">({files.length})</span>}</h3>
      {loading ? <div role="status" className="space-y-2">{[0, 1].map(key => <div key={key} className="h-14 animate-pulse rounded-[10px] bg-gray-100 dark:bg-gray-700" />)}<span className="sr-only">Loading documents</span></div>
        : files.length === 0 ? <p className="rounded-[10px] border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-600 dark:text-gray-400">No documents on file yet.</p>
          : <ul className="divide-y divide-gray-100 rounded-[10px] border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
            {files.map(file => {
              const Icon = file.mime_type?.startsWith('image/') ? FileImage : FileText;
              const busy = busyId === file.id;
              return <li key={file.id} className="flex flex-wrap items-center gap-3 p-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Icon size={18} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="break-all text-sm font-semibold">{file.original_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <span className="font-medium text-gray-700 dark:text-gray-300">{categoryLabel(file.category)}</span> · {size(file.size)} · {when(file.created_at)}
                    {file.uploader && ` · ${file.uploader.first_name} ${file.uploader.last_name}`}
                  </p>
                  {file.description && <p className="mt-0.5 break-words text-xs text-gray-600 dark:text-gray-300">{file.description}</p>}
                </div>
                {confirmDelete === file.id ? <div className="flex items-center gap-1">
                  <button type="button" onClick={() => remove(file)} disabled={busy} className={`rounded-[10px] bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 ${focus}`}>{busy ? 'Deleting…' : 'Delete'}</button>
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
  </div>;
}
