import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import api from '../../../services/api';
import { Avatar } from '../Students/StudentDirectory';
import { focus, fullName } from '../Students/directoryOptions';
import { ClinicRecordSheet } from '../../../components/ClinicRecordList';
import DocumentViewerModal from '../../../components/DocumentViewerModal';
import { buildRecordDocument, studentDetails } from '../../Student/HealthRecords/recordDocuments';
import { recordAcademic, yearLabel, yearValue } from '../../../utils/clinicRecordFilters';

// Record type: the service the student booked (Consultation, Medical Certificate, Vaccination, ...).
// A visit without an appointment is a Consultation; an emergency encounter is an Emergency.
const recordType = record => record.record_type === 'emergency' ? 'Emergency' : record.appointment?.service || 'Consultation';
const date = record => record.occurred_at ? new Date(record.occurred_at).toLocaleString('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not recorded';
const badge = record => <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${record.record_type === 'emergency' ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}>{recordType(record)}</span>;

// Table columns that can be sorted, and what each one sorts by.
const text = value => String(value || '').toLowerCase();
export const RECORD_COLUMNS = [['student', 'Student'], ['student_id', 'Student ID'], ['course', 'Course'], ['year', 'Year'], ['section', 'Section'], ['type', 'Record type'], ['date', 'Date']];
export const RECORD_SORTS = {
  student: record => text(fullName(record.student || {})),
  student_id: record => text(record.student?.student_id),
  course: record => text(recordAcademic(record, 'course')),
  year: record => text(yearValue(recordAcademic(record, 'year'))),
  section: record => text(recordAcademic(record, 'section')),
  type: record => text(recordType(record)),
  date: record => new Date(record.occurred_at).getTime() || 0,
};

// Stacked ▲/▼: both hollow until the column is sorted, then the active direction fills maroon.
const SortCaret = ({ direction }) => (
  <svg viewBox="0 0 10 14" aria-hidden="true" className="h-[13px] w-[9px] text-gray-400">
    {[['asc', 'M1.5 5.5h7L5 1.5z'], ['desc', 'M1.5 8.5h7L5 12.5z']].map(([dir, d]) => (
      <path key={dir} d={d} strokeWidth="1.1" strokeLinejoin="round"
        className={direction === dir ? 'fill-maroon-700 stroke-maroon-700 dark:fill-maroon-300 dark:stroke-maroon-300' : 'fill-none stroke-current'} />
    ))}
  </svg>
);

export default function RecordDirectory({ records, onView, sort = null, onSort = () => {} }) {
  const view = record => <button type="button" onClick={() => onView(record)} aria-label={`View ${recordType(record).toLowerCase()} record for ${fullName(record.student || {}) || 'student'}`} className={`inline-flex min-h-11 items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold text-maroon-800 hover:bg-maroon-50 dark:text-maroon-300 dark:hover:bg-maroon-950 ${focus}`}><Eye size={16} aria-hidden="true" />View</button>;
  return <>
    <div className="hidden overflow-x-auto lg:block"><table className="w-full text-left text-sm"><caption className="sr-only">Clinic history, newest encounters first</caption><thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/50"><tr>{RECORD_COLUMNS.map(([key, label]) => { const active = sort?.key === key ? sort.dir : null; return <th scope="col" key={key} aria-sort={active === 'desc' ? 'descending' : active === 'asc' ? 'ascending' : 'none'} className="px-4 py-3.5"><button type="button" onClick={() => onSort(key)} className={`inline-flex items-center gap-1 transition hover:text-gray-900 dark:hover:text-white${active ? ' text-gray-900 dark:text-white' : ''}`}>{label}<SortCaret direction={active} /></button></th>; })}<th scope="col" className="px-4 py-3.5">Action</th></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-700">{records.map(record => <tr key={`${record.record_type}-${record.id}`} className="hover:bg-maroon-50/40 dark:hover:bg-gray-700/30">
      <td className="px-4 py-4"><div className="flex items-center gap-3"><Avatar student={record.student || {}} /><div className="min-w-0"><p className="font-semibold">{fullName(record.student || {}) || 'Student not available'}</p><p className="mt-0.5 max-w-56 truncate text-xs text-gray-500 dark:text-gray-400" title={record.reason || record.chief_complaint}>{record.reason || record.chief_complaint || 'Not recorded'}</p></div></div></td>
      <td className="whitespace-nowrap px-4 py-4 text-gray-500 dark:text-gray-400">{record.student?.student_id || '—'}</td>
      {['course', 'year', 'section'].map(key => <td key={key} className="whitespace-nowrap px-4 py-4">{(key === 'year' ? yearLabel(yearValue(recordAcademic(record, key))) : recordAcademic(record, key)) || '—'}</td>)}
      <td className="px-4 py-4">{badge(record)}</td><td className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400">{date(record)}</td><td className="px-3 py-4">{view(record)}</td>
    </tr>)}</tbody></table></div>
    <div className="divide-y divide-gray-100 lg:hidden dark:divide-gray-700">{records.map(record => <article key={`${record.record_type}-${record.id}`} className="p-4"><div className="flex items-start gap-3"><Avatar student={record.student || {}} /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{fullName(record.student || {}) || 'Student not available'}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{record.student?.student_id || 'ID not recorded'}</p></div>{badge(record)}</div><p className="mt-3 break-words text-sm">{[recordAcademic(record, 'course'), recordAcademic(record, 'section')].filter(Boolean).join(' ') || 'Academic details not recorded'}</p><p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-300">{record.reason || record.chief_complaint || 'No complaint recorded'}</p><div className="mt-2 flex items-center justify-between gap-2"><time dateTime={record.occurred_at} className="text-xs text-gray-500 dark:text-gray-400">{date(record)}</time>{view(record)}</div></article>)}</div>
  </>;
}

// A clinic-history row in the shape the Consultation Form template is filled from (recordDocuments.js).
const toDocumentRecord = record => {
  const emergency = record.record_type === 'emergency';
  const vitals = record.vital_signs || {};
  const nurse = [record.nurse?.first_name, record.nurse?.last_name].filter(Boolean).join(' ');
  return {
    id: record.id,
    date: record.occurred_at,
    recordType: record.record_type,
    complaint: emergency ? record.reason : record.chief_complaint,
    // Same as the form printed when the visit was saved: the diagnosis line carries the nursing assessment.
    diagnosis: emergency ? record.assessment : record.nursing_assessment || record.general_remarks,
    assessment: emergency ? '' : record.nursing_assessment,
    interventions: emergency ? record.intervention : record.nursing_interventions,
    vitals: { bp: vitals.bp, hr: vitals.hr, temp: vitals.temp, rr: vitals.rr, o2: vitals.o2_sat },
    medicalCertificate: Boolean(record.medical_certificate),
    medicalCertificateRef: record.medical_certificate_ref,
    sickCertificate: Boolean(record.sick_certificate),
    sickCertificateRef: record.sick_certificate_ref,
    sickRestDays: record.sick_rest_days,
    ojtCertificate: Boolean(record.ojt_certificate),
    ojtCertificateRef: record.ojt_certificate_ref,
    ojtCompany: record.ojt_company,
    liabilityForm: Boolean(record.liability_form),
    liabilityActivity: record.liability_activity,
    followUpRequired: Boolean(record.follow_up_required),
    followUpDate: record.follow_up_date,
    staff: nurse ? `Nurse ${nurse}` : 'Clinic Staff',
    staffRole: 'Clinic Nurse',
  };
};

// The patient block of the form (age, address, contacts) comes from the student's profile;
// if that cannot be loaded, the form still shows the name and course from the record.
const patientDetails = async record => {
  const fallback = studentDetails(record.student);
  if (!record.student?.id) return fallback;
  try {
    const { data } = await api.get(`/nurse/students/${record.student.id}`);
    const student = data.data;
    const profile = student.student_profile || {};
    const health = student.health_profile;
    return studentDetails(
      student,
      { ...profile, mobile_number: profile.mobile_number || student.mobile_number },
      health && { name: health.emergency_name, relationship: health.emergency_relationship, phone: health.emergency_phone },
    );
  } catch {
    return fallback;
  }
};

// View: the record as its Consultation Form (and any issued certificates/forms) in the document viewer.
// Everything else on the record (history, plan, triage, issued documents) is in the side panel.
export function RecordDetailsModal({ record, onClose }) {
  const emergency = record.record_type === 'emergency';
  const [docKind, setDocKind] = useState('consultation');
  useEffect(() => { setDocKind('consultation'); }, [record.record_type, record.id]);

  const docs = [
    ['consultation', emergency ? 'Emergency Encounter Form' : 'Consultation Form'],
    ...(!emergency ? [
      record.medical_certificate && ['certificate', 'Medical Certificate'],
      record.sick_certificate && ['sick', 'Medical Certificate (Sick)'],
      record.ojt_certificate && ['ojt', 'Medical Certificate (OJT)'],
      record.liability_form && ['liability', 'Medical Liability Form'],
    ].filter(Boolean) : []),
  ];
  const activeKind = docs.some(([kind]) => kind === docKind) ? docKind : 'consultation';

  const docTabs = docs.length > 1 ? (
    <div role="tablist" aria-label="Issued documents" className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-gray-200 bg-white px-4 py-2 sm:px-5 dark:border-gray-700 dark:bg-gray-800">
      {docs.map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          role="tab"
          aria-selected={activeKind === kind}
          onClick={() => setDocKind(kind)}
          className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition ${activeKind === kind
            ? 'bg-maroon-800 text-white dark:bg-gray-700'
            : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'}`}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null;

  return <DocumentViewerModal
    title={emergency ? 'Emergency Encounter Record' : 'Consultation Record'}
    subtitle={`View and print ${emergency ? 'emergency encounter' : 'consultation'} details`}
    docKey={`${record.record_type}-${record.id}-${activeKind}`}
    load={async () => buildRecordDocument(activeKind, toDocumentRecord(record), await patientDetails(record))}
    headerExtra={docTabs}
    onClose={onClose}
    detailsLabel="Full record"
    details={<>
      <p className="font-semibold">{fullName(record.student || {}) || 'Clinic record'}</p>
      <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{[record.student?.student_id, recordType(record), date(record)].filter(Boolean).join(' · ')}</p>
      <ClinicRecordSheet record={record} />
    </>}
  />;
}
