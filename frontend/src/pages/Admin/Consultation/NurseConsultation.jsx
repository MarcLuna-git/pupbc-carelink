import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, ListOrdered, Stethoscope, Users } from 'lucide-react';
import api from '../../../services/api';
import NursePageSkeleton from '../../../components/NursePageSkeleton';
import NursePageTitle from '../../../components/NursePageTitle';
import NurseListCard, { CountChip } from '../../../components/NurseListCard';
import useNurseSync from '../../../hooks/useNurseSync';
import { NurseNoticeModal, NurseToast } from '../../../components/NurseFeedback';
import ConsultationVisit from './ConsultationVisit';
import BatchRelease from './BatchRelease';
import NurseRecords from '../Records/NurseRecords';
import { PRIORITY } from './QueuePatientModal';
import { consultationPath, queueRowsFrom } from './queueRows';

/*
 * Nurse → Consultation: the consultation form, on its own page. The Queue page sends the nurse
 * here (?visit=<check-in id>) once the patient arrived. Without a visit it lists the patients
 * who are in consultation now, so an unfinished form can be reopened.
 */
const NurseConsultation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const visitId = params.get('visit');
  // Inner tabs of the consultation page: Individual Release (the patients being seen) and Batch Release (a Medical Clearance for a group).
  const tab = params.get('tab') === 'batch' ? 'batch' : 'individual';
  const chooseTab = id => setParams(id === 'batch' ? { tab: 'batch' } : {}, { replace: true });

  const [rows, setRows] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  // A visit another nurse already took (HTTP 409) needs acknowledging, so it opens a popup.
  const [conflict, setConflict] = useState('');
  // The open visit: the queue row it came from, once this nurse holds the claim on it.
  const [visit, setVisit] = useState(null);
  const [claiming, setClaiming] = useState(false);
  // Set once the visit is saved, so the sync loop stops re-claiming a finished visit.
  const [saved, setSaved] = useState(false);
  const savedRef = useRef(false);
  const request = useRef(0);

  const fetchRows = useCallback(async (silent = false) => {
    const id = ++request.current;
    try {
      const response = await api.get('/nurse/queue/checkins');
      if (!response.data.success) return null;
      const next = queueRowsFrom(response);
      // A newer load (the sync loop) owns the list on screen, but the caller still gets its rows:
      // opening a visit right after Patient arrived must not lose them to that newer load.
      if (id === request.current) setRows(next);
      return next;
    } catch (err) {
      if (!silent) { setMessageType('error'); setMessage('Unable to load the clinic queue. Retrying automatically.'); }
      if (silent) throw err;
      return null;
    } finally {
      if (id === request.current) setPageLoading(false);
    }
  }, []);

  // Opening a visit: take the claim (only one nurse fills in a form), then show the form.
  useEffect(() => {
    setVisit(null); setSaved(false); savedRef.current = false;
    if (!visitId) { fetchRows(); return undefined; }
    let cancelled = false;
    (async () => {
      setClaiming(true);
      const passed = location.state?.visit;
      const row = passed?.checkin_id === visitId ? passed : (await fetchRows())?.find(r => r.checkin_id === visitId);
      if (cancelled) return;
      if (!row || !['called', 'serving'].includes(row.status)) {
        setClaiming(false);
        setMessageType('error');
        setMessage('This visit is no longer open. It may already be finished or closed.');
        navigate('/nurse/consultation', { replace: true });
        return;
      }
      try {
        await api.post(`/nurse/queue/${visitId}/claim`);
        if (!cancelled) setVisit(row);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 409) setConflict(err.response.data?.message || 'Another nurse is already handling this visit.');
        else { setMessageType('error'); setMessage(err.response?.data?.message || 'Unable to open this visit.'); }
        navigate('/nurse/consultation', { replace: true });
      } finally {
        if (!cancelled) setClaiming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Leaving an unsaved visit gives the claim back, so another nurse can open it.
  useEffect(() => {
    if (!visit || saved) return undefined;
    const id = visit.checkin_id;
    return () => { api.delete(`/nurse/queue/${id}/claim`).catch(() => {}); };
  }, [visit, saved]);

  useNurseSync(['queue', 'appointments', 'consultations', 'students'], async () => {
    if (!visit) { await fetchRows(true); return; }
    if (saved) return;
    try { await api.post(`/nurse/queue/${visit.checkin_id}/claim`); }
    catch (err) {
      // Refused because the visit was just saved: nothing to warn about.
      if (err.response?.status === 409 && !savedRef.current) setConflict(err.response.data.message);
      throw err;
    }
  });

  const toast = (
    <>
      <NurseToast message={message} type={messageType} onClose={() => setMessage('')} />
      <NurseNoticeModal open={Boolean(conflict)} title="Visit unavailable" message={conflict} actionLabel="Got it" onClose={() => setConflict('')} />
    </>
  );

  if (visitId) {
    if (claiming || !visit) return <>{toast}<NursePageSkeleton label="Opening the consultation" /></>;
    return (
      <div className="mx-auto max-w-[1440px] space-y-5">
        <NursePageTitle path="/nurse/consultation" />
        {toast}
        <ConsultationVisit
          key={visit.checkin_id}
          visit={visit}
          onBack={() => navigate('/nurse/consultation')}
          // Saved: the record now lives in Patient History (every completed consultation).
          onDone={() => navigate('/nurse/consultation')}
          doneLabel="View in Patient History"
          onQueue={() => navigate('/nurse/queue')}
          onSaved={() => { savedRef.current = true; setSaved(true); }}
          onConflict={setConflict}
          notify={(text, type) => { setMessageType(type); setMessage(text); }}
        />
      </div>
    );
  }

  if (pageLoading) return <NursePageSkeleton label="Loading consultations" />;

  const inConsultation = rows.filter(r => r.status === 'serving');
  const waiting = rows.filter(r => ['waiting', 'called'].includes(r.status)).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5">
      <NursePageTitle path="/nurse/consultation" />
      {toast}
      {/* The way back to the queue, in its own card above the list. */}
      <section aria-labelledby="queue-shortcut-title"
        className="flex flex-col gap-3 rounded-[10px] border border-gray-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between lg:px-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-maroon-50 text-maroon-700 dark:bg-maroon-900/30 dark:text-maroon-300">
            <ListOrdered className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="queue-shortcut-title" className="font-bold text-gray-900 dark:text-white">Clinic Queue</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Call the next student here. {waiting === 0 ? 'No one is waiting right now.' : `${waiting} student${waiting === 1 ? ' is' : 's are'} waiting.`}
            </p>
          </div>
        </div>
        <Link to="/nurse/queue"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[10px] bg-maroon-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-maroon-900">
          Go to Queue
        </Link>
      </section>


      {/* Inner tabs: Individual Release is the consultation of a patient being seen; Batch Release is a Medical Clearance for a group. */}
      <section aria-label="Release type" className="rounded-[10px] border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-800 lg:px-4">
      <div role="tablist" aria-label="Release type" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {[['individual', 'Individual Release', Stethoscope], ['batch', 'Batch Release', Users]].map(([id, title, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`consultation-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`consultation-panel-${id}`}
            onClick={() => chooseTab(id)}
            className={`flex w-full items-center gap-2 rounded-[10px] border px-4 py-2.5 text-sm font-semibold transition sm:inline-flex sm:w-auto ${
              tab === id
                ? 'border-maroon-800 bg-maroon-800 text-white'
                : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-900/30'}`}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {title}
          </button>
        ))}
      </div>
      </section>

      {tab === 'batch' ? (
        <div role="tabpanel" id="consultation-panel-batch" aria-labelledby="consultation-tab-batch"><BatchRelease /></div>
      ) : (
      <div role="tabpanel" id="consultation-panel-individual" aria-labelledby="consultation-tab-individual" className="space-y-5">
      <NurseListCard
        aria-label="Patients in consultation"
        icon={Stethoscope}
        title={<>In consultation<CountChip>{inConsultation.length}</CountChip></>}
        description="Patients who arrived and are being seen. Their form opens from the Queue: Patient arrived, or Continue on a form that was left unsaved."
      >
        {inConsultation.length === 0 ? (
          <div className="py-14 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[10px] bg-gray-50 dark:bg-gray-700/50">
              <ClipboardList className="h-8 w-8 text-gray-300 dark:text-gray-500" />
            </span>
            <h3 className="text-base font-semibold text-gray-600 dark:text-gray-300">No patient in consultation</h3>
            <p className="mt-1 text-sm text-gray-400">Call the next student from the Queue. Once they arrive, their consultation form opens right away.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Patients in consultation</caption>
              <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>{['Queue No.', 'Student', 'Priority', 'Reason for Visit', 'Actions'].map(label => <th scope="col" key={label} className="whitespace-nowrap px-3 py-3 sm:px-4">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {inConsultation.map(s => {
                  const priority = PRIORITY[s.priority] || PRIORITY.LOW;
                  return (
                    <tr key={s.checkin_id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40">
                      <td className="whitespace-nowrap px-3 py-3 font-semibold tabular-nums text-gray-700 sm:px-4 dark:text-gray-200">{s.queue_number}</td>
                      <td className="px-3 py-3 sm:px-4">
                        <p className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">{s.name}</p>
                        <p className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-xs text-gray-400">{s.id}</span>
                          {s.demo && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Demo</span>}
                        </p>
                      </td>
                      <td className="px-3 py-3 sm:px-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${priority.className}`}>{priority.label}</span>
                      </td>
                      <td className="max-w-xs px-3 py-3 text-gray-600 sm:px-4 dark:text-gray-300"><span className="line-clamp-2">{s.complaint || '—'}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 sm:px-4">
                        <button
                          type="button"
                          onClick={() => navigate(consultationPath(s.checkin_id))}
                          className="inline-flex items-center rounded-[10px] bg-maroon-800 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-maroon-900"
                        >
                          Consulting
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </NurseListCard>

      {/* Patient History: the completed consultations and emergency encounters, at the bottom of Individual Release. */}
      <NurseRecords embedded />
      </div>
      )}
    </div>
  );
};

export default NurseConsultation;
