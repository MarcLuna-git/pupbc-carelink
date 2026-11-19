import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, HeartPulse, Stethoscope } from 'lucide-react';

/*
 * Clinic records as a plain list, and one record as a readable sheet.
 *
 * ClinicRecordList: one row per record (type, date, complaint). Opening a row replaces the list
 * with its sheet and a "Back to list" button, so it works inside a popup of fixed height.
 * ClinicRecordSheet: only the facts that were recorded; empty fields are left out, not shown as
 * "Not recorded". The Records page uses the same sheet in its detail popup.
 */
const TZ = 'Asia/Manila';
const has = value => value !== null && value !== undefined && String(value).trim() !== '';
const isEmergency = record => record.record_type === 'emergency';
const recordTypeLabel = record => isEmergency(record) ? 'Emergency encounter' : 'Consultation';
const recordDate = value => value ? new Date(value).toLocaleString('en-US', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Date not recorded';
const day = value => value ? new Date(value).toLocaleDateString('en-US', { timeZone: TZ, year: 'numeric', month: 'short', day: 'numeric' }) : '';
const person = nurse => nurse ? [nurse.first_name, nurse.last_name].filter(Boolean).join(' ') : '';
const keyOf = record => `${record.record_type}-${record.id}`;

const VITALS = [
  ['bp', 'Blood pressure', value => /^\d+\/\d+$/.test(value) ? `${value} mmHg` : value],
  ['hr', 'Heart rate', value => /^[\d.]+$/.test(value) ? `${value} bpm` : value],
  ['rr', 'Respiratory rate', value => /^[\d.]+$/.test(value) ? `${value} /min` : value],
  ['temp', 'Temperature', value => /^[\d.]+$/.test(value) ? `${value} °C` : value],
  ['o2_sat', 'Oxygen saturation', value => /^[\d.]+$/.test(value) ? `${value}%` : value],
];
function Vitals({ vitals }) {
  if (!vitals || typeof vitals !== 'object') return null;
  const known = new Set(VITALS.map(([key]) => key));
  const entries = [
    ...VITALS.filter(([key]) => has(vitals[key])).map(([key, label, show]) => [label, show(String(vitals[key]).trim())]),
    ...Object.entries(vitals).filter(([key, value]) => !known.has(key) && has(value) && typeof value !== 'object').map(([key, value]) => [key.replaceAll('_', ' ').replace(/^./, c => c.toUpperCase()), String(value)]),
  ];
  if (!entries.length) return null;
  return <ul className="flex flex-wrap gap-2">{entries.map(([label, value]) => <li key={label} className="rounded-[10px] bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">{label} <b className="font-semibold text-gray-900 dark:text-white">{value}</b></li>)}</ul>;
}

function Row({ label, children }) {
  if (!children) return null;
  return <div className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4"><dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm text-gray-900 dark:text-gray-100">{children}</dd></div>;
}

export function ClinicRecordSheet({ record }) {
  const text = value => has(value) ? String(value).trim() : null;
  const nurse = person(record.nurse);
  if (isEmergency(record)) {
    return <dl className="divide-y divide-gray-100 dark:divide-gray-700">
      <Row label="Reason">{text(record.reason)}</Row>
      <Row label="Symptoms">{text(record.symptoms)}</Row>
      <Row label="Assessment">{text(record.assessment)}</Row>
      <Row label="Intervention">{text(record.intervention)}</Row>
      <Row label="Disposition">{text(record.disposition)}</Row>
      <Row label="Notes">{text(record.notes)}</Row>
      <Row label="Recorded by">{nurse && `Nurse ${nurse}`}</Row>
    </dl>;
  }
  const appointment = record.appointment;
  const triage = record.triage;
  const redFlags = (Array.isArray(triage?.red_flags) ? triage.red_flags : []).filter(flag => flag && flag !== 'none');
  const triageText = triage ? [has(triage.severity) && `Severity: ${triage.severity}`, has(triage.priority) && `Priority: ${triage.priority}`, redFlags.length > 0 && `Red flags: ${redFlags.join(', ')}`, has(triage.notes) && `Notes: ${triage.notes}`].filter(Boolean).join('\n') : '';
  return <dl className="divide-y divide-gray-100 dark:divide-gray-700">
    <Row label="Chief complaint">{text(record.chief_complaint)}</Row>
    <Row label="Vital signs"><Vitals vitals={record.vital_signs} /></Row>
    <Row label="History / present illness">{text(record.history_present_illness)}</Row>
    <Row label="Nursing assessment">{text(record.nursing_assessment)}</Row>
    <Row label="Nursing interventions">{text(record.nursing_interventions)}</Row>
    <Row label="Treatment / plan">{text(record.treatment_plan)}</Row>
    <Row label="General remarks">{text(record.general_remarks)}</Row>
    <Row label="Medical certificate">{record.medical_certificate ? `Issued${has(record.medical_certificate_ref) ? ` · ${record.medical_certificate_ref}` : ''}` : null}</Row>
    <Row label="Medical certificate (sick)">{record.sick_certificate ? `Issued${has(record.sick_certificate_ref) ? ` · ${record.sick_certificate_ref}` : ''}${record.sick_rest_days ? ` · ${record.sick_rest_days} day/s` : ''}` : null}</Row>
    <Row label="Medical certificate (OJT)">{record.ojt_certificate ? `Issued${has(record.ojt_certificate_ref) ? ` · ${record.ojt_certificate_ref}` : ''}${has(record.ojt_company) ? ` · ${record.ojt_company}` : ''}` : null}</Row>
    <Row label="Medical liability form">{record.liability_form ? `Issued${has(record.liability_activity) ? ` · ${record.liability_activity}` : ''}` : null}</Row>
    <Row label="Follow-up">{record.follow_up_required ? `Needed${record.follow_up_date ? ` on ${day(record.follow_up_date)}` : ''}` : null}</Row>
    <Row label="Appointment">{appointment ? [appointment.service, day(appointment.appointment_date), appointment.time_slot].filter(Boolean).join(' · ') : null}</Row>
    <Row label="Kiosk triage">{triageText || null}</Row>
    <Row label="Recorded by">{nurse && `Nurse ${nurse}`}</Row>
  </dl>;
}

export default function ClinicRecordList({ records = [], emptyText = 'No clinic records yet.' }) {
  const [openKey, setOpenKey] = useState(null);
  const top = useRef(null);
  const open = records.find(record => keyOf(record) === openKey);
  // The list lives inside a scrolling popup body: bring the opened record back to the top.
  const show = key => { setOpenKey(key); requestAnimationFrame(() => top.current?.closest('[role=tabpanel]')?.scrollTo({ top: 0 })); };

  if (open) {
    return <div ref={top}>
      <button type="button" autoFocus onClick={() => show(null)} className="mb-3 inline-flex items-center gap-1 rounded-[10px] px-2 py-1.5 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 dark:text-maroon-300 dark:hover:bg-maroon-950"><ChevronLeft size={16} aria-hidden="true" />Back to list</button>
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-gray-100 pb-3 dark:border-gray-700">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isEmergency(open) ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{recordTypeLabel(open)}</span>
        <time dateTime={open.occurred_at} className="text-sm text-gray-500 dark:text-gray-400">{recordDate(open.occurred_at)}</time>
      </div>
      <ClinicRecordSheet record={open} />
    </div>;
  }
  if (!records.length) return <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">{emptyText}</p>;
  return <ul ref={top} className="divide-y divide-gray-100 overflow-hidden rounded-[10px] border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
    {records.map(record => {
      const emergency = isEmergency(record);
      const Icon = emergency ? HeartPulse : Stethoscope;
      const summary = record.reason || record.chief_complaint || 'No complaint recorded';
      return <li key={keyOf(record)}>
        <button type="button" onClick={() => show(keyOf(record))} aria-label={`View ${recordTypeLabel(record).toLowerCase()} from ${recordDate(record.occurred_at)}`} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-maroon-500 dark:hover:bg-gray-700/40">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${emergency ? 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300' : 'bg-maroon-50 text-maroon-800 dark:bg-maroon-950/40 dark:text-maroon-300'}`}><Icon size={18} aria-hidden="true" /></span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-3"><span className="text-sm font-semibold">{recordTypeLabel(record)}</span><span className="text-xs text-gray-500 dark:text-gray-400">{recordDate(record.occurred_at)}</span></span>
            <span className="mt-0.5 block truncate text-sm text-gray-600 dark:text-gray-300">{summary}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-gray-400" aria-hidden="true" />
        </button>
      </li>;
    })}
  </ul>;
}
