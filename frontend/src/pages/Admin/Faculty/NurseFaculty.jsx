import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import { NurseToast } from '../../../components/NurseFeedback';
import useNurseSync from '../../../hooks/useNurseSync';
import { focus } from '../Students/directoryOptions';
import ConsultationForm from './ConsultationForm';
import DispenseForm from './DispenseForm';
import DispensingHistory from './DispensingHistory';
import FacultyDetails from './FacultyDetails';
import FacultyDirectory from './FacultyDirectory';

/*
 * Faculty: the total faculty card, then the tabs — the Faculty Directory, Consultation, Dispense Medicine,
 * and the Dispensing History. A faculty member's details open in place of the tabs (?member=ID).
 */
const TABS = [['directory', 'Faculty Directory'], ['consultation', 'Consultation'], ['dispense', 'Dispense Medicine'], ['history', 'Dispensing History']];
const EMPTY_ROSTER = { list: [], stats: { total: 0 } };

function StatCard({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-4 rounded-[10px] border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-maroon-50 text-maroon-800 dark:bg-maroon-900/30 dark:text-maroon-300"><Icon size={22} aria-hidden="true" /></span>
    <div><p className="text-sm text-gray-500 dark:text-gray-400">{label}</p><p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{value}</p></div>
  </div>;
}

const NurseFaculty = () => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'directory';
  const memberId = params.get('member') || '';
  const historyFaculty = params.get('faculty') || '';
  const [roster, setRoster] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // A new form each time one is submitted, so the Dispense Medicine tab starts empty again.
  const [formKey, setFormKey] = useState(0);

  const notify = useCallback((text, type = 'success') => { setMessageType(type); setMessage(text); }, []);
  const go = useCallback(next => setParams(next), [setParams]);

  // Every faculty member (for the total and the pickers), a page of 100 at a time.
  const loadRoster = useCallback(async (signal, silent = false) => {
    try {
      const list = [];
      let first = null;
      for (let page = 1; page <= 10; page += 1) {
        const { data } = await api.get('/nurse/faculty', { params: { per_page: 100, page }, signal });
        if (signal?.aborted) return;
        if (!first) first = data;
        list.push(...(data.data?.data || []));
        if (page >= (data.data?.last_page || 1)) break;
      }
      setRoster({ list, stats: first.stats || EMPTY_ROSTER.stats });
      setError('');
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      if (silent) throw err;
      setError('Failed to load faculty.');
      setRoster(current => current || EMPTY_ROSTER);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadRoster(controller.signal);
    return () => controller.abort();
  }, [loadRoster]);

  useNurseSync(['faculty'], signal => loadRoster(signal, true));

  if (!roster) return <NursePageSkeleton variant="cards" label="Loading faculty" />;

  const { stats } = roster;
  const active = roster.list.filter(member => member.status === 'active');

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/faculty" />

      {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

      {/* Action results show as a floating toast */}
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />

      {memberId ? (
        <FacultyDetails key={memberId} id={memberId} onBack={() => go({})} onNotify={notify}
          onViewHistory={id => go({ tab: 'history', faculty: id })} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard icon={Users} label="Total Faculty" value={stats.total} />
          </div>

          <div role="tablist" aria-label="Faculty sections" className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            {TABS.map(([key, label]) => <button key={key} type="button" role="tab" id={`faculty-tab-${key}`} aria-selected={tab === key} aria-controls="faculty-panel" onClick={() => go(key === 'directory' ? {} : { tab: key })}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === key ? 'border-maroon-800 text-maroon-800 dark:border-maroon-300 dark:text-maroon-300' : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'} ${focus}`}>{label}</button>)}
          </div>

          <div id="faculty-panel" role="tabpanel" aria-labelledby={`faculty-tab-${tab}`}>
            {tab === 'directory' && <FacultyDirectory onView={id => go({ member: id })} onChanged={() => loadRoster(undefined, true).catch(() => {})} onNotify={notify} />}
            {tab === 'consultation' && (
              <section aria-label="Faculty consultation" className="max-w-2xl rounded-[10px] border border-gray-100 bg-white p-5 text-gray-900 sm:p-6 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <h2 className="text-lg font-bold">Consultation</h2>
                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">Record a clinic consultation for a faculty member. It shows on their details.</p>
                {active.length === 0
                  ? <p className="rounded-[10px] bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">There is no active faculty member yet. Add one in the Faculty Directory first.</p>
                  : <ConsultationForm key={formKey} facultyOptions={active} onDone={text => { notify(text); setFormKey(value => value + 1); }} />}
              </section>
            )}
            {tab === 'dispense' && (
              <section aria-label="Dispense medicine" className="max-w-2xl rounded-[10px] border border-gray-100 bg-white p-5 text-gray-900 sm:p-6 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                <h2 className="text-lg font-bold">Dispense Medicine</h2>
                <p className="mb-5 text-sm text-gray-500 dark:text-gray-400">Give a medicine to a faculty member. The stock comes out of the inventory, first expiry first.</p>
                {active.length === 0
                  ? <p className="rounded-[10px] bg-gray-50 p-4 text-sm text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">There is no active faculty member yet. Add one in the Faculty Directory first.</p>
                  : <DispenseForm key={formKey} facultyOptions={active} onDone={text => { notify(text); setFormKey(value => value + 1); }} />}
              </section>
            )}
            {tab === 'history' && <DispensingHistory faculty={roster.list} facultyId={historyFaculty} onFacultyId={id => go(id ? { tab: 'history', faculty: id } : { tab: 'history' })} />}
          </div>
        </>
      )}
    </div>
  );
};

export default NurseFaculty;
