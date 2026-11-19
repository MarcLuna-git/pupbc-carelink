import { useEffect, useMemo, useRef, useState } from 'react';
import useSignatoryVersion from '../../../hooks/useSignatoryVersion';
import { Eye, FileCheck, Printer, Search, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { getUser } from '../../../services/session';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import { inputStyle, primary, secondary } from '../Students/directoryOptions';
import { buildRecordDocument } from '../../Student/HealthRecords/recordDocuments';
import { BATCH_DOCUMENTS, findBatchDocument, formatDay, nurseLabel, savedRecord } from './batchDocuments';
import BatchPreview from './BatchPreview';

/*
 * Batch Release → Issued: the history of batch documents. View or Print shows the document below the list,
 * as it will print. The list itself is loaded by the parent (BatchRelease), which also shows its count.
 */
export default function BatchHistory({ issued, loading, loadError, onReload, onNew }) {
  const me = getUser();
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(null); // { html, label, title, autoPrint, id } | 'loading' | null
  const previewRef = useRef(null);
  const previewPanel = useRef(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issued.filter((item) => (!typeFilter || item.type === typeFilter)
      && (!q || `${item.title} ${findBatchDocument(item.type).summary?.(item.fields || {}) || ''}`.toLowerCase().includes(q)));
  }, [issued, typeFilter, search]);

  const show = async (item, autoPrint = false) => {
    const type = findBatchDocument(item.type);
    // Already on screen: the frame would not reload for the same page, so print (or just scroll to) it directly.
    if (preview?.id === item.id && preview.html) {
      previewPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (autoPrint) previewRef.current?.print();
      return;
    }
    setPreview('loading');
    setTimeout(() => previewPanel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    try {
      const html = await buildRecordDocument(type.template, savedRecord(item, nurseLabel(me)), {});
      setPreview({ html, label: type.label, title: item.title, autoPrint, id: item.id });
    } catch {
      setPreview(null);
      setMessage({ type: 'error', text: 'The document could not be prepared.' });
    }
  };

  // The signatory was switched (account menu) while a document is on screen: redraw it, without printing again.
  const signatoryVersion = useSignatoryVersion();
  const drawnVersion = useRef(signatoryVersion);
  useEffect(() => {
    if (drawnVersion.current === signatoryVersion) return;
    drawnVersion.current = signatoryVersion;
    const item = preview?.html && issued.find((entry) => entry.id === preview.id);
    if (!item) return;
    buildRecordDocument(findBatchDocument(item.type).template, savedRecord(item, nurseLabel(me)), {})
      .then((html) => setPreview((current) => (current?.id === item.id ? { ...current, html, autoPrint: false } : current)))
      .catch(() => {});
  }, [signatoryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (item) => {
    try {
      await api.delete(`/nurse/batch-documents/${item.id}`);
      setConfirmId(null);
      if (preview?.id === item.id) setPreview(null);
      setMessage({ type: 'success', text: `${findBatchDocument(item.type).label} deleted.` });
      onReload();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'The document could not be deleted.' });
    }
  };

  return (
    <div className="space-y-5">
      {message && (
        <p role={message.type === 'error' ? 'alert' : 'status'} className={`rounded-[10px] px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'}`}>{message.text}</p>
      )}

      <NurseListCard
        aria-label="Issued batch documents"
        icon={FileCheck}
        title={<>Issued Documents<CountChip>{loading ? '…' : loadError ? '—' : issued.length}</CountChip></>}
        description="Re-open or print a document that was already issued."
        toolbar={issued.length ? (
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search activity, venue, group" aria-label="Search issued documents" className={`${inputStyle} pl-9`} />
            </div>
            {BATCH_DOCUMENTS.length > 1 && (
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by document" className={`${inputStyle} sm:!w-56`}>
                <option value="">All documents</option>
                {BATCH_DOCUMENTS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
            )}
          </div>
        ) : null}
      >
        {loadError ? (
          <div role="alert" className="space-y-3 p-8 text-center"><p className="text-sm text-red-600 dark:text-red-300">{loadError}</p><button type="button" className={secondary} onClick={onReload}>Try again</button></div>
        ) : loading ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : !issued.length ? (
          <div className="px-6 py-14 text-center">
            <h2 className="font-semibold">No documents issued yet.</h2>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Documents you save will appear here.</p>
            <button type="button" onClick={onNew} className={`${primary} mt-4`}>Create a document</button>
          </div>
        ) : shown.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-900/30 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3">Issued</th>
                  <th scope="col" className="px-4 py-3">Document</th>
                  <th scope="col" className="px-4 py-3">Details</th>
                  <th scope="col" className="px-4 py-3 text-right">Students</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {shown.map((item) => {
                  const type = findBatchDocument(item.type);
                  const summary = type.summary?.(item.fields || {});
                  const viewing = preview?.id === item.id;
                  return (
                    <tr key={item.id} className={viewing ? 'bg-maroon-50/40 dark:bg-maroon-900/10' : ''}>
                      <td className="whitespace-nowrap px-4 py-3">{formatDay(item.issued_date)}</td>
                      <td className="whitespace-nowrap px-4 py-3"><span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{type.label}</span></td>
                      <td className="px-4 py-3 font-medium">{item.title}{summary && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{summary}</span>}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{item.students?.length || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {confirmId === item.id ? (
                            <>
                              <span className="text-xs font-semibold text-red-700 dark:text-red-400">Delete?</span>
                              <button type="button" onClick={() => remove(item)} className="rounded-[10px] bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-800">Yes</button>
                              <button type="button" onClick={() => setConfirmId(null)} className={`${secondary} !px-2.5 !py-1.5 text-xs`}>No</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => show(item)} className={`${secondary} !px-2.5 !py-1.5`} aria-label={`View ${type.label} for ${item.title}`}><Eye className="h-4 w-4" /></button>
                              <button type="button" onClick={() => show(item, true)} className={`${secondary} !px-2.5 !py-1.5`} aria-label={`Print ${type.label} for ${item.title}`}><Printer className="h-4 w-4" /></button>
                              <button type="button" onClick={() => setConfirmId(item.id)} className={`${secondary} !px-2.5 !py-1.5 text-red-700 dark:text-red-400`} aria-label={`Delete ${type.label} for ${item.title}`}><Trash2 className="h-4 w-4" /></button>
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
          <p className="px-6 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No issued document matches the filter.</p>
        )}
      </NurseListCard>

      {preview && (
        <div ref={previewPanel} className="scroll-mt-4">
          <NurseListCard
            aria-label="Document preview"
            icon={Eye}
            title={preview === 'loading' ? 'Document Preview' : `${preview.label}: ${preview.title}`}
            description="As it will print."
            actions={preview !== 'loading' ? (
              <>
                <button type="button" onClick={() => previewRef.current?.print()} className={primary}><Printer className="h-4 w-4" aria-hidden="true" /> Print</button>
                <button type="button" onClick={() => setPreview(null)} className={secondary}><X className="h-4 w-4" aria-hidden="true" /> Close</button>
              </>
            ) : null}
            bodyClassName="p-4 lg:p-5"
          >
            {preview === 'loading' ? (
              <p role="status" className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Preparing the document…</p>
            ) : (
              <BatchPreview ref={previewRef} html={preview.html} autoPrint={preview.autoPrint} title={`${preview.label} preview: ${preview.title}`} />
            )}
          </NurseListCard>
        </div>
      )}
    </div>
  );
}
