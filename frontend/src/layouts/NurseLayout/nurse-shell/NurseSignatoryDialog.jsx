import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Trash2, X } from 'lucide-react';

import { addSignatory, removeSignatory, selectSignatory, selectedSignatoryId, signatoryChoices } from '../../../services/documentSignatory';

/*
 * Account menu → Document signatory: pick whose name is printed in the signature part of the clinic
 * documents, or add another doctor or nurse to the list. The choice applies from the next print on.
 */
const input = 'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
const emptyForm = { name: '', role: '', license: '' };

export const signatoryDetail = (choice) => [choice.role, choice.license && `Lic. No. ${choice.license}`].filter(Boolean).join(' · ');

export default function NurseSignatoryDialog({ user, onClose }) {
  const [choices, setChoices] = useState(() => signatoryChoices(user));
  const [selected, setSelected] = useState(() => selectedSignatoryId(user));
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const refresh = () => {
    setChoices(signatoryChoices(user));
    setSelected(selectedSignatoryId(user));
  };

  const choose = (id) => { selectSignatory(id); setSelected(id); };

  const add = (event) => {
    event.preventDefault();
    const item = addSignatory(form);
    if (!item) { setError('Enter the name as it should print.'); return; }
    selectSignatory(item.id);
    setForm(emptyForm);
    setError('');
    refresh();
  };

  const remove = (id) => { removeSignatory(id); refresh(); };

  const change = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    if (error) setError('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="nurse-signatory-title" className="flex max-h-[calc(100dvh-32px)] w-full max-w-md flex-col rounded-[10px] bg-white text-gray-900 shadow-2xl dark:bg-gray-800 dark:text-gray-100">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-700">
          <div>
            <h2 id="nurse-signatory-title" className="text-lg font-bold">Document signatory</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">The name printed in the signature part of the documents you print.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-[10px] p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Sign documents as</legend>
            <div className="space-y-1.5">
              {choices.map((choice) => {
                const checked = choice.id === selected;
                return (
                  <div key={choice.id} className={`flex items-center gap-2 rounded-[10px] border px-3 py-2.5 ${checked ? 'border-maroon-500 bg-maroon-50 dark:border-maroon-300 dark:bg-maroon-900/20' : 'border-gray-200 dark:border-gray-600'}`}>
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input type="radio" name="document-signatory" checked={checked} onChange={() => choose(choice.id)} className="h-4 w-4 shrink-0 accent-maroon-800" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{choice.name}{choice.note && <span className="font-normal text-gray-500 dark:text-gray-400"> ({choice.note})</span>}</span>
                        {signatoryDetail(choice) && <span className="block text-xs text-gray-500 dark:text-gray-400">{signatoryDetail(choice)}</span>}
                      </span>
                    </label>
                    {choice.custom && (
                      <button type="button" onClick={() => remove(choice.id)} aria-label={`Remove ${choice.name}`} className="shrink-0 rounded-[10px] p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          <form onSubmit={add} noValidate className="space-y-2 rounded-[10px] border border-dashed border-gray-200 p-3 dark:border-gray-600">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Add a doctor or nurse</p>
            <div>
              <label htmlFor="signatory-name" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Name as printed</label>
              <input id="signatory-name" name="name" value={form.name} onChange={change} maxLength={120} placeholder="e.g. Maria Santos, M.D." autoComplete="off" aria-invalid={error ? true : undefined} aria-describedby={error ? 'signatory-name-error' : undefined} className={`${input} ${error ? 'border-red-400 dark:border-red-500' : ''}`} />
              {error && <p id="signatory-name-error" role="alert" className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">{error}</p>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="signatory-role" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">Position <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="signatory-role" name="role" value={form.role} onChange={change} maxLength={80} placeholder="e.g. Campus Physician" autoComplete="off" className={input} />
              </div>
              <div>
                <label htmlFor="signatory-license" className="mb-1 block text-xs font-semibold text-gray-600 dark:text-gray-300">License no. <span className="font-normal text-gray-400">(optional)</span></label>
                <input id="signatory-license" name="license" value={form.license} onChange={change} maxLength={30} autoComplete="off" className={input} />
              </div>
            </div>
            <button type="submit" className="inline-flex items-center gap-2 rounded-[10px] border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"><Plus className="h-4 w-4" aria-hidden="true" /> Add and use</button>
          </form>
        </div>

        <div className="border-t border-gray-100 p-4 dark:border-gray-700">
          <button type="button" onClick={onClose} className="w-full rounded-[10px] bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900">Done</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
