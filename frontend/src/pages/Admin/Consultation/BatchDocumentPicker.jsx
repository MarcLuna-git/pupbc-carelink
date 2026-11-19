import { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Search } from 'lucide-react';
import { inputStyle, focus } from '../Students/directoryOptions';

/*
 * Batch Release wizard → step 1: the documents as cards, grouped by category. A search box appears once
 * there are several documents. Choosing a card moves on to the next step.
 */
const SEARCH_FROM = 6;

export default function BatchDocumentPicker({ documents, value, onChoose }) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((doc) => !q || `${doc.label} ${doc.category} ${doc.description}`.toLowerCase().includes(q))
      .reduce((all, doc) => {
        (all[doc.category] ||= []).push(doc);
        return all;
      }, {});
  }, [documents, query]);

  return (
    <div className="space-y-4">
      {documents.length >= SEARCH_FROM && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search documents" aria-label="Search documents" className={`${inputStyle} pl-9`} />
        </div>
      )}

      {Object.keys(groups).length ? Object.entries(groups).map(([category, docs]) => (
        <section key={category} aria-label={category}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{category}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {docs.map((doc) => {
              const active = doc.key === value;
              return (
                <button
                  key={doc.key}
                  type="button"
                  onClick={() => onChoose(doc.key)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 rounded-[10px] border p-4 text-left transition ${focus} ${active
                    ? 'border-maroon-800 bg-maroon-50 dark:border-maroon-400 dark:bg-maroon-900/20'
                    : 'border-gray-200 hover:border-maroon-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/40'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${active ? 'bg-maroon-800 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                      {doc.label}
                      {active && <CheckCircle2 className="h-4 w-4 text-maroon-800 dark:text-maroon-300" aria-hidden="true" />}
                    </span>
                    <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{doc.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )) : (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No document matches “{query}”.</p>
      )}
    </div>
  );
}
