import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Mail, Phone, Pill, Stethoscope } from 'lucide-react';
import api from '../../../services/api';
import useNurseSync from '../../../hooks/useNurseSync';
import { focus } from '../Students/directoryOptions';
import { personName } from '../Medicine/medicineOptions';
import { DispenseModal } from './DispenseForm';
import { ConsultationModal } from './ConsultationForm';
import { STATUSES, avatarColor, dateTimeLabel, dayLabel, initials, quantityLabel } from './facultyOptions';

/*
 * One faculty member: who they are, how to reach them, whether they are active, their clinic
 * consultations and the last medicines the clinic gave them. Record Consultation and Dispense
 * Medicine open the same forms as their tabs.
 */
const card = 'rounded-[10px] border border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-gray-800';
const COLUMNS = 'md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1.6fr)_minmax(0,1.2fr)]';

function ContactRow({ icon: Icon, label, value, href }) {
  return <li className="flex items-center gap-3">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gray-50 text-gray-500 dark:bg-gray-700 dark:text-gray-300"><Icon size={16} aria-hidden="true" /></span>
    <div className="min-w-0"><p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      {value ? (href ? <a href={href} className="break-all text-sm font-medium text-gray-900 hover:underline dark:text-gray-100">{value}</a> : <p className="break-words text-sm font-medium">{value}</p>) : <p className="text-sm text-gray-400">Not provided</p>}
    </div>
  </li>;
}

export default function FacultyDetails({ id, onBack, onViewHistory, onNotify }) {
  const [state, setState] = useState({ member: null, recent: [], count: 0, consultations: [], consultationCount: 0 });
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState('');
  const [dispensing, setDispensing] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (signal, silent = false) => {
    const request = ++requestId.current;
    try {
      const { data } = await api.get(`/nurse/faculty/${id}`, { signal });
      if (signal?.aborted || request !== requestId.current) return;
      setState({ member: data.data, recent: data.recent_dispensings || [], count: data.dispensing_count || 0, consultations: data.consultations || [], consultationCount: data.consultation_count || 0 });
      setMissing(false); setError('');
    } catch (err) {
      if (signal?.aborted || err.code === 'ERR_CANCELED') return;
      if (err.response?.status === 404) { setMissing(true); return; }
      if (silent) throw err;
      setError('Failed to load the faculty member.');
    } finally {
      if (request === requestId.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useNurseSync(['faculty'], signal => load(signal, true), id);

  const back = <button type="button" onClick={onBack} aria-label="Back to the faculty directory" className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 ${focus}`}><ArrowLeft size={18} aria-hidden="true" /></button>;

  if (loading) return <div role="status" className="space-y-4"><span className="sr-only">Loading faculty member</span><div className="h-28 animate-pulse rounded-[10px] bg-gray-100 dark:bg-gray-800" /><div className="h-48 animate-pulse rounded-[10px] bg-gray-100 dark:bg-gray-800" /></div>;
  if (missing || !state.member) {
    return <div className="space-y-4">{back}
      <div className={`${card} py-12 text-center`}>
        <h2 className="text-base font-semibold text-gray-700 dark:text-gray-200">{missing ? 'Faculty member not found' : 'Unable to show this faculty member'}</h2>
        <p className="mt-1 text-sm text-gray-500">{missing ? 'They may have been removed from the directory.' : error}</p>
        <button type="button" onClick={onBack} className={`mt-5 inline-flex h-10 items-center rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white hover:bg-maroon-900 ${focus}`}>Back to directory</button>
      </div>
    </div>;
  }

  const { member, recent, count, consultations, consultationCount } = state;
  const status = STATUSES[member.status] || STATUSES.active;
  const inactive = member.status !== 'active';

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-[10px] bg-red-50 p-3 text-center text-sm font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
    <section aria-label="Faculty member" className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center`}>
      <div className="flex min-w-0 flex-1 items-center gap-4">
        {back}
        <span aria-hidden="true" className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-white ${avatarColor(member.full_name)}`}>{initials(member.full_name)}</span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold">{member.full_name}</h2>
          <p className="mt-1 break-words text-sm text-gray-500 dark:text-gray-400">{member.email || 'No email recorded'}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setConsulting(true)} disabled={inactive} title={inactive ? 'Make this faculty member active to record a consultation' : undefined}
          className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}><Stethoscope size={16} aria-hidden="true" />Record Consultation</button>
        <button type="button" onClick={() => setDispensing(true)} disabled={inactive} title={inactive ? 'Make this faculty member active to dispense medicine' : undefined}
          className={`inline-flex h-10 items-center gap-2 rounded-[10px] bg-maroon-800 px-5 text-sm font-semibold text-white hover:bg-maroon-900 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`}><Pill size={16} aria-hidden="true" />Dispense Medicine</button>
        <button type="button" onClick={() => onViewHistory(member.id)}
          className={`inline-flex h-10 items-center rounded-[10px] border border-maroon-300 bg-white px-5 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:border-maroon-700 dark:bg-transparent dark:text-maroon-300 dark:hover:bg-maroon-900/20 ${focus}`}>View History</button>
      </div>
    </section>

    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="Contact information" className={card}>
        <h3 className="mb-4 text-sm font-bold">Contact Information</h3>
        <ul className="space-y-4">
          <ContactRow icon={Mail} label="Email" value={member.email} href={member.email ? `mailto:${member.email}` : undefined} />
          <ContactRow icon={Phone} label="Contact Number" value={member.phone} href={member.phone ? `tel:${member.phone.replace(/[^\d+]/g, '')}` : undefined} />
        </ul>
      </section>
      <section aria-label="Status" className={card}>
        <h3 className="mb-4 text-sm font-bold">Status</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Status</dt><dd><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.pill}`}><span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden="true" />{status.label}</span></dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Added</dt><dd className="font-medium">{dayLabel(member.created_at) || '—'}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Consultations</dt><dd className="font-medium tabular-nums">{consultationCount}</dd></div>
          <div className="flex items-center justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">Times dispensed</dt><dd className="font-medium tabular-nums">{count}</dd></div>
          {inactive && <p className="rounded-[10px] bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">Inactive faculty cannot be consulted or given medicine. Edit them in the directory to make them active.</p>}
        </dl>
      </section>
    </div>

    <section aria-label="Consultations" className="rounded-[10px] border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="px-5 py-4"><h3 className="text-sm font-bold">Consultations</h3></div>
      {consultations.length === 0 ? <p className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">No consultation has been recorded for {member.full_name} yet.</p> : (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-700 dark:border-gray-700">
          {consultations.map(row => {
            const vitals = [row.blood_pressure && `BP ${row.blood_pressure}`, row.temperature != null && `Temp ${row.temperature}°C`, row.pulse_rate != null && `Pulse ${row.pulse_rate} bpm`].filter(Boolean);
            return <li key={row.id} className="space-y-1.5 px-5 py-3.5 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="break-words font-semibold">{row.chief_complaint}</p>
                <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">{dateTimeLabel(row.created_at)} · {personName(row.consultant) || '—'}</p>
              </div>
              {vitals.length > 0 && <p className="text-xs text-gray-600 dark:text-gray-300">{vitals.join(' · ')}</p>}
              {row.assessment && <p className="break-words text-gray-700 dark:text-gray-200"><span className="text-xs font-semibold text-gray-500">Assessment: </span>{row.assessment}</p>}
              {row.intervention && <p className="break-words text-gray-700 dark:text-gray-200"><span className="text-xs font-semibold text-gray-500">Intervention: </span>{row.intervention}</p>}
              {row.notes && <p className="whitespace-pre-line break-words text-gray-600 dark:text-gray-300"><span className="text-xs font-semibold text-gray-500">Notes: </span>{row.notes}</p>}
            </li>;
          })}
        </ul>
      )}
    </section>

    <section aria-label="Recent dispensing" className="rounded-[10px] border border-gray-100 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <h3 className="text-sm font-bold">Recent Dispensing</h3>
        <button type="button" onClick={() => onViewHistory(member.id)} className={`rounded px-2 py-1 text-sm font-semibold text-maroon-800 hover:underline dark:text-maroon-300 ${focus}`}>View All</button>
      </div>
      {recent.length === 0 ? <p className="border-t border-gray-100 px-5 py-10 text-center text-sm text-gray-500 dark:border-gray-700">No medicine has been dispensed to {member.full_name} yet.</p> : <>
        <div aria-hidden="true" className={`hidden items-center gap-4 border-y border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold text-gray-600 md:grid dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 ${COLUMNS}`}>
          <span>Date &amp; Time</span><span>Medicine</span><span>Quantity</span><span>Reason</span><span>Dispensed By</span>
        </div>
        <ul className="divide-y divide-gray-100 border-t border-gray-100 md:border-t-0 dark:divide-gray-700 dark:border-gray-700">
          {recent.map(row => <li key={row.id} className={`grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-3.5 text-sm md:items-center ${COLUMNS}`}>
            <div className="col-span-2 tabular-nums text-gray-600 md:col-span-1 dark:text-gray-300">{dateTimeLabel(row.created_at)}</div>
            <div className="min-w-0"><span className="block text-xs text-gray-500 md:hidden">Medicine</span><span className="break-words">{row.medicine_name}</span></div>
            <div><span className="block text-xs text-gray-500 md:hidden">Quantity</span><span className="whitespace-nowrap font-semibold tabular-nums">{quantityLabel(row)}</span></div>
            <div className="col-span-2 min-w-0 md:col-span-1"><span className="block text-xs text-gray-500 md:hidden">Reason</span><span className="break-words text-gray-700 dark:text-gray-200">{row.reason}</span></div>
            <div className="col-span-2 min-w-0 md:col-span-1"><span className="block text-xs text-gray-500 md:hidden">Dispensed By</span><span className="break-words">{personName(row.dispenser) || '—'}</span></div>
          </li>)}
        </ul>
      </>}
    </section>

    {consulting && <ConsultationModal faculty={member} onClose={() => setConsulting(false)} onDone={async text => {
      try { await load(undefined, true); } catch { /* the sync poll will catch up */ }
      setConsulting(false); onNotify(text);
    }} />}
    {dispensing && <DispenseModal faculty={member} onClose={() => setDispensing(false)} onDone={async text => {
      try { await load(undefined, true); } catch { /* the sync poll will catch up */ }
      setDispensing(false); onNotify(text);
    }} />}
  </div>;
}
