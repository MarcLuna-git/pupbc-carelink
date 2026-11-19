import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, FilePlus2, History, Printer } from 'lucide-react';
import api from '../../../services/api';
import { getUser } from '../../../services/session';
import { primary, secondary, focus } from '../Students/directoryOptions';
import { buildRecordDocument } from '../../Student/HealthRecords/recordDocuments';
import { BATCH_DOCUMENTS, emptyFields, findBatchDocument, nurseLabel, savedRecord, trimFields, validateFields } from './batchDocuments';
import BatchDocumentPicker from './BatchDocumentPicker';
import BatchFieldsForm from './BatchFieldsForm';
import BatchStudentList, { mergeStudents } from './BatchStudentList';
import BatchPreview from './BatchPreview';
import useSignatoryVersion from '../../../hooks/useSignatoryVersion';

/*
 * Batch Release → New Document: a wizard in four steps — choose the document, fill in its details, list the
 * students, then preview, save and print. The chosen document is kept in the URL (?doc=…) by the parent.
 */
const STEPS = ['Document', 'Details', 'Students', 'Preview'];

export default function BatchWizard({ docKey, onDocChange, onSaved, onShowIssued }) {
  const doc = findBatchDocument(docKey);
  const me = getUser();

  const [step, setStep] = useState(docKey ? 1 : 0);
  const [reached, setReached] = useState(docKey ? 1 : 0); // the furthest step the nurse may jump back to
  const [values, setValues] = useState(() => emptyFields(doc));
  const [namesText, setNamesText] = useState('');
  const [linked, setLinked] = useState([]);
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null); // { html } | 'loading' | 'error' | null
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(null); // the saved row, once Save and Print succeeded
  const previewRef = useRef(null);
  const top = useRef(null);

  const students = useMemo(() => mergeStudents(namesText, linked), [namesText, linked]);

  // Another document: its own details start empty; the students stay (often the same group).
  const firstDoc = useRef(true);
  useEffect(() => {
    if (firstDoc.current) { firstDoc.current = false; return; }
    setValues(emptyFields(doc));
    setErrors({});
  }, [doc.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (next) => {
    setStep(next);
    setReached((current) => Math.max(current, next));
    setTimeout(() => top.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const fieldsValid = () => {
    const found = validateFields(doc, values);
    setErrors(found);
    return Object.keys(found).length === 0;
  };
  const studentsValid = () => {
    if (students.length) return true;
    setErrors({ students: 'Add at least one student.' });
    return false;
  };

  const buildDraft = async () => {
    setPreview('loading');
    try {
      const record = doc.toRecord({ fields: trimFields(values), students, staff: nurseLabel(me) });
      setPreview({ html: await buildRecordDocument(doc.template, record, {}) });
    } catch {
      setPreview('error');
    }
  };

  // The signatory was switched (account menu) while the preview is open: redraw it, without printing again.
  const signatoryVersion = useSignatoryVersion();
  const drawnVersion = useRef(signatoryVersion);
  useEffect(() => {
    if (drawnVersion.current === signatoryVersion) return;
    drawnVersion.current = signatoryVersion;
    if (step !== 3 || !preview?.html) return;
    if (!saved) { buildDraft(); return; }
    buildRecordDocument(doc.template, savedRecord(saved, nurseLabel(me)), {})
      .then((html) => setPreview({ html }))
      .catch(() => {});
  }, [signatoryVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Moving forward checks the step being left; the preview is built on arriving at the last step.
  const next = () => {
    if (step === 1 && !fieldsValid()) return;
    if (step === 2) {
      if (!fieldsValid()) { goTo(1); return; }
      if (!studentsValid()) return;
      buildDraft();
    }
    goTo(step + 1);
  };

  const jump = (target) => {
    if (saved || target > reached || target === step) return;
    if (target === 3) {
      if (!fieldsValid()) { goTo(1); return; }
      if (!studentsValid()) { goTo(2); return; }
      buildDraft();
    }
    goTo(target);
  };

  const choose = (key) => {
    onDocChange(key);
    goTo(1);
  };

  const changeField = (name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };
  const clearStudentError = () => { if (errors.students) setErrors((current) => ({ ...current, students: undefined })); };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const { data } = await api.post('/nurse/batch-documents', { type: doc.key, fields: trimFields(values), students });
      setSaved(data.data);
      // The saved copy carries its reference; print that one.
      setPreview({ html: await buildRecordDocument(doc.template, savedRecord(data.data, nurseLabel(me)), {}), autoPrint: true });
      onSaved?.();
    } catch (err) {
      const apiErrors = err.response?.data?.errors || {};
      const mapped = Object.fromEntries(Object.entries(apiErrors).map(([key, value]) => [key.startsWith('students') ? 'students' : key.replace(/^fields\./, ''), value[0]]));
      setErrors(mapped);
      if (Object.keys(mapped).some((key) => key !== 'students')) goTo(1);
      else if (mapped.students) goTo(2);
      setSaveError(err.response?.data?.message || `The ${doc.label.toLowerCase()} could not be saved.`);
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    setValues(emptyFields(doc));
    setNamesText('');
    setLinked([]);
    setErrors({});
    setPreview(null);
    setSaved(null);
    setSaveError('');
    setReached(0);
    goTo(0);
  };

  const fieldSummary = doc.summary?.(trimFields(values));
  const title = trimFields(values)[doc.titleField || doc.fields[0]?.name] || doc.label;

  return (
    <section ref={top} aria-label="New batch document" className="scroll-mt-4 overflow-hidden rounded-[10px] border border-gray-100 bg-white text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
      {/* Stepper */}
      <ol className="flex border-b border-gray-100 px-2 py-3 dark:border-gray-700 sm:px-4">
        {STEPS.map((name, index) => {
          const done = saved ? true : index < step;
          const current = index === step && !saved;
          const open = !saved && index <= reached && index !== step;
          return (
            <li key={name} className="flex min-w-0 flex-1 items-center">
              <button
                type="button"
                onClick={() => jump(index)}
                disabled={!open}
                aria-current={current ? 'step' : undefined}
                className={`flex min-w-0 items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm ${focus} ${open ? 'hover:bg-gray-50 dark:hover:bg-gray-700/40' : 'cursor-default'}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${current
                  ? 'bg-maroon-800 text-white'
                  : done ? 'bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}
                >
                  {done && !current ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className={`truncate ${current ? 'font-semibold text-gray-900 dark:text-white' : 'hidden text-gray-500 dark:text-gray-400 sm:inline'}`}>{name}</span>
              </button>
              {index < STEPS.length - 1 && <span className="mx-1 hidden h-px flex-1 bg-gray-200 dark:bg-gray-700 sm:block" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="space-y-5 p-4 lg:p-6">
        {/* Step heading */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Step {step + 1} of {STEPS.length}</p>
            <h2 className="mt-0.5 text-lg font-bold text-gray-900 dark:text-white">
              {step === 0 && 'Choose a document'}
              {step === 1 && `${doc.label} details`}
              {step === 2 && 'Who is on the list?'}
              {step === 3 && (saved ? `${doc.label} saved` : 'Check, then save and print')}
            </h2>
          </div>
          {step > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">{doc.label}</span>
          )}
        </div>

        {saveError && <p role="alert" className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-800 dark:bg-red-900/20 dark:text-red-300">{saveError}</p>}

        {step === 0 && <BatchDocumentPicker documents={BATCH_DOCUMENTS} value={docKey ? doc.key : ''} onChoose={choose} />}

        {step === 1 && <BatchFieldsForm doc={doc} values={values} errors={errors} onChange={changeField} />}

        {step === 2 && (
          <BatchStudentList
            text={namesText}
            linked={linked}
            students={students}
            error={errors.students}
            onTextChange={(text) => { setNamesText(text); clearStudentError(); }}
            onLinkedChange={(list) => { setLinked(list); clearStudentError(); }}
          />
        )}

        {step === 3 && (
          <div className="space-y-4">
            {saved ? (
              <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] bg-green-50 px-4 py-3 dark:bg-green-900/20">
                <p className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /> Saved. It is now in Issued documents.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => previewRef.current?.print()} className={secondary}><Printer className="h-4 w-4" aria-hidden="true" /> Print again</button>
                  <button type="button" onClick={onShowIssued} className={secondary}><History className="h-4 w-4" aria-hidden="true" /> View issued</button>
                  <button type="button" onClick={startOver} className={primary}><FilePlus2 className="h-4 w-4" aria-hidden="true" /> New document</button>
                </div>
              </div>
            ) : (
              <dl className="grid gap-3 rounded-[10px] border border-gray-100 p-4 text-sm dark:border-gray-700 sm:grid-cols-3">
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">Document</dt><dd className="font-semibold">{doc.label}</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">For</dt><dd className="font-semibold">{title}{fieldSummary && <span className="block text-xs font-normal text-gray-500 dark:text-gray-400">{fieldSummary}</span>}</dd></div>
                <div><dt className="text-xs text-gray-500 dark:text-gray-400">Students</dt><dd className="font-semibold tabular-nums">{students.length}</dd></div>
              </dl>
            )}

            {preview === 'loading' || !preview ? (
              <p role="status" className="py-16 text-center text-sm text-gray-500 dark:text-gray-400">Preparing the document…</p>
            ) : preview === 'error' ? (
              <div role="alert" className="space-y-3 py-12 text-center">
                <p className="text-sm text-red-600 dark:text-red-300">The document could not be prepared.</p>
                <button type="button" onClick={buildDraft} className={secondary}>Try again</button>
              </div>
            ) : (
              <BatchPreview ref={previewRef} html={preview.html} autoPrint={!!preview.autoPrint} title={`${doc.label} preview: ${title}`} />
            )}
          </div>
        )}
      </div>

      {/* Footer navigation */}
      {!saved && step > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-700 lg:px-6">
          <button type="button" onClick={() => goTo(step - 1)} className={secondary}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back</button>
          {step < 3 ? (
            <button type="button" onClick={next} className={primary}>
              {step === 2 ? 'Preview' : 'Next'} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={save} disabled={saving || !preview || preview === 'loading' || preview === 'error'} className={primary}>
              <Printer className="h-4 w-4" aria-hidden="true" /> {saving ? 'Saving…' : 'Save and Print'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
