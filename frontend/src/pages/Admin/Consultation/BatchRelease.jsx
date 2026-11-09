import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FilePlus2, History } from 'lucide-react';
import api from '../../../services/api';
import { focus } from '../Students/directoryOptions';
import { BATCH_DOCUMENTS } from './batchDocuments';
import BatchWizard from './BatchWizard';
import BatchHistory from './BatchHistory';

/*
 * Nurse portal → Consultation → Batch Release: documents for a group of students (for example a Medical Clearance
 * for a section joining an off-campus activity). Two inner tabs: New Document (a step-by-step wizard) and
 * Issued (the history). URL: ?tab=batch&view=issued for the history, &doc=<key> for the chosen document.
 * Both panels stay mounted, so a half-filled wizard survives a look at the history.
 */
const VIEWS = [['new', 'New Document', FilePlus2], ['issued', 'Issued', History]];

export default function BatchRelease() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'issued' ? 'issued' : 'new';
  const docParam = params.get('doc');
  const docKey = BATCH_DOCUMENTS.some((doc) => doc.key === docParam) ? docParam : '';

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const [issued, setIssued] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/nurse/batch-documents');
      setIssued(data.data || []);
      setLoadError('');
    } catch {
      setLoadError('The issued documents could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Batch Release" className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {VIEWS.map(([id, title, Icon]) => {
          const active = view === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`batch-tab-${id}`}
              aria-selected={active}
              aria-controls={`batch-panel-${id}`}
              onClick={() => update({ view: id === 'issued' ? 'issued' : '' })}
              className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${focus} ${active
                ? 'border-maroon-800 text-maroon-800 dark:border-maroon-300 dark:text-maroon-200'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {title}
              {id === 'issued' && !loading && !loadError && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-500 dark:bg-gray-700 dark:text-gray-300">{issued.length}</span>
              )}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id="batch-panel-new" aria-labelledby="batch-tab-new" hidden={view !== 'new'}>
        <BatchWizard
          docKey={docKey}
          onDocChange={(key) => update({ doc: key })}
          onSaved={load}
          onShowIssued={() => update({ view: 'issued' })}
        />
      </div>
      <div role="tabpanel" id="batch-panel-issued" aria-labelledby="batch-tab-issued" hidden={view !== 'issued'}>
        <BatchHistory issued={issued} loading={loading} loadError={loadError} onReload={load} onNew={() => update({ view: '' })} />
      </div>
    </div>
  );
}
