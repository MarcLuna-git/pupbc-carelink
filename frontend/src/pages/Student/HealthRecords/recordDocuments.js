import { escapeHtml } from '../../../utils/escapeHtml';
import { formatPersonName } from '../../../utils/studentUser';
import { getUser } from '../../../services/session';

/*
 * Printable clinic documents, built in the browser from a clinic-history
 * record. `mode: 'print'` opens the browser print dialog right away (where
 * "Save as PDF" downloads it); `mode: 'preview'` only shows the page.
 *
 * Returns false when the pop-up was blocked so the caller can say so.
 */

const CLINIC_NAME = 'PUP Biñan Campus Student Clinic';

const formatDateTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const formatDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const studentInfo = () => {
  const user = getUser('student');
  return {
    name: formatPersonName(`${user.first_name || ''} ${user.last_name || ''}`.trim()) || 'Student',
    studentId: user.student_id || '—',
    program: [user.course, user.year, user.section].filter(Boolean).join(' • ') || '—',
  };
};

const STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f4f1f0; color: #1f2937; font-family: Arial, Helvetica, sans-serif; }
  .page { max-width: 720px; margin: 24px auto; padding: 40px 44px; background: #fff; border: 1px solid #e5e7eb; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 3px solid #800000; }
  .brand { color: #800000; font-size: 20px; font-weight: 700; margin: 0; }
  .clinic { color: #6b7280; font-size: 12px; margin: 2px 0 0; }
  .ref { color: #6b7280; font-size: 11px; text-align: right; }
  h1 { margin: 28px 0 20px; text-align: center; font-size: 22px; letter-spacing: 2px; text-transform: uppercase; }
  h2 { margin: 22px 0 8px; color: #800000; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; }
  p { font-size: 14px; line-height: 1.7; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { padding: 7px 10px; border: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
  th { width: 34%; background: #faf5f4; color: #4b5563; font-weight: 600; }
  .vitals td, .vitals th { width: auto; text-align: center; }
  .sign { margin-top: 56px; display: flex; justify-content: flex-end; }
  .sign div { width: 240px; text-align: center; border-top: 1px solid #1f2937; padding-top: 6px; font-size: 13px; }
  .sign small { display: block; color: #6b7280; }
  .note { margin-top: 32px; color: #9ca3af; font-size: 10px; text-align: center; }
  @media print { body { background: #fff; } .page { margin: 0; border: 0; } }
`;

const row = (label, value) =>
  `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || 'Not recorded')}</td></tr>`;

const certificateBody = (record, student) => `
  <h1>Medical Certificate</h1>
  <p>
    This is to certify that <strong>${escapeHtml(student.name)}</strong>,
    Student ID <strong>${escapeHtml(student.studentId)}</strong>
    (${escapeHtml(student.program)}), was seen and attended to at the
    ${escapeHtml(CLINIC_NAME)} on <strong>${escapeHtml(formatDay(record.date))}</strong>
    for <strong>${escapeHtml(record.complaint)}</strong>.
  </p>
  <table>
    ${row('Findings / Remarks', record.diagnosis)}
    ${record.followUpRequired ? row('Recommendation', `Follow-up visit${record.followUpDate ? ` on ${formatDay(record.followUpDate)}` : ''}`) : ''}
    ${row('Certificate Reference', record.medicalCertificateRef)}
  </table>
  <p>This certificate is issued upon the request of the student for whatever purpose it may serve.</p>
  <div class="sign"><div>${escapeHtml(record.staff)}<small>${escapeHtml(record.staffRole)}</small></div></div>
  <p class="note">
    System-generated copy of a certificate issued by the ${escapeHtml(CLINIC_NAME)}.
    Verify the reference number with the clinic.
  </p>
`;

const consultationBody = (record, student) => {
  const vitals = [
    ['BP', record.vitals.bp],
    ['HR', record.vitals.hr],
    ['Temp', record.vitals.temp],
    ['RR', record.vitals.rr],
    ['O₂ Sat', record.vitals.o2],
  ];
  const hasVitals = vitals.some(([, value]) => value);
  const isEmergency = record.recordType === 'emergency';

  return `
    <h1>${isEmergency ? 'Emergency Encounter Record' : 'Consultation Record'}</h1>
    <h2>Student</h2>
    <table>
      ${row('Name', student.name)}
      ${row('Student ID', student.studentId)}
      ${row('Program', student.program)}
    </table>
    <h2>Visit</h2>
    <table>
      ${row('Date & Time', formatDateTime(record.date))}
      ${row(isEmergency ? 'Reason' : 'Chief Complaint', record.complaint)}
      ${record.symptoms ? row('Symptoms', record.symptoms) : ''}
      ${record.appointment?.service ? row('Appointment Service', record.appointment.service) : ''}
    </table>
    ${hasVitals ? `
      <h2>Vital Signs</h2>
      <table class="vitals">
        <tr>${vitals.map(([label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>
        <tr>${vitals.map(([, value]) => `<td>${escapeHtml(value || '—')}</td>`).join('')}</tr>
      </table>` : ''}
    <h2>Findings</h2>
    <table>
      ${row(isEmergency ? 'Assessment' : 'Diagnosis / Findings', record.diagnosis)}
      ${isEmergency ? row('Intervention', record.notesValue) : ''}
      ${record.disposition ? row('Disposition', record.disposition) : ''}
      ${row('Follow-up', record.followUpRequired ? `Required${record.followUpDate ? ` — ${formatDay(record.followUpDate)}` : ''}` : 'Not required')}
      ${record.medicalCertificate ? row('Medical Certificate', record.medicalCertificateRef || 'Issued') : ''}
    </table>
    <div class="sign"><div>${escapeHtml(record.staff)}<small>${escapeHtml(record.staffRole)}</small></div></div>
    <p class="note">System-generated copy from the ${escapeHtml(CLINIC_NAME)} records.</p>
  `;
};

export const DOCUMENTS = {
  certificate: { label: 'Medical Certificate', file: 'Medical-Certificate', body: certificateBody },
  consultation: { label: 'Consultation Form', file: 'Consultation-Form', body: consultationBody },
};

export const openRecordDocument = (kind, record, mode = 'preview') => {
  const doc = DOCUMENTS[kind];
  const printWindow = window.open('', '_blank');
  if (!doc || !printWindow) return false;

  const student = studentInfo();
  const reference = record.medicalCertificateRef || record.id;
  // The title becomes the default file name in "Save as PDF".
  const title = `PUPBC-${doc.file}-${reference}`;

  printWindow.document.write(`<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)}</title>
        <style>${STYLES}</style>
      </head>
      <body>
        <div class="page">
          <div class="head">
            <div>
              <p class="brand">PUPBC CareLink</p>
              <p class="clinic">${escapeHtml(CLINIC_NAME)}</p>
            </div>
            <div class="ref">Issued ${escapeHtml(formatDay(new Date()))}<br />Ref: ${escapeHtml(reference)}</div>
          </div>
          ${doc.body(record, student)}
        </div>
        ${mode === 'print' ? '<script>setTimeout(function () { window.print(); }, 400);</script>' : ''}
      </body>
    </html>`);
  printWindow.document.close();
  return true;
};
