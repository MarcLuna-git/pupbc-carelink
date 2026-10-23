import { escapeHtml } from '../../../utils/escapeHtml';
import { formatPersonName } from '../../../utils/studentUser';
import { getUser } from '../../../services/session';

/*
 * Printable clinic documents, filled in the browser from a clinic-history
 * record. The page design lives in editable HTML files under
 * public/templates/print/ (see the README there). `mode: 'print'` opens the
 * browser print dialog right away (where "Save as PDF" downloads it);
 * `mode: 'preview'` only shows the page.
 *
 * Returns false when the pop-up was blocked so the caller can say so.
 */

const TEMPLATE_DIR = `${import.meta.env.BASE_URL}templates/print/`;

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

const NOT_RECORDED = 'Not recorded';

/*
 * Fills a template: {{#key}}…{{/key}} keeps its part when key has a value,
 * {{^key}}…{{/key}} when it does not, {{{key}}} inserts HTML as is, and
 * {{key}} inserts the value as text (or "Not recorded" when empty).
 */
const fillTemplate = (template, data) => {
  const filled = (key) => {
    const value = data[key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  };
  let html = template;
  let previous;
  do {
    previous = html;
    html = html.replace(/\{\{([#^])(\w+)\}\}([\s\S]*?)\{\{\/\2\}\}/g,
      (_, type, key, inner) => ((type === '#') === filled(key) ? inner : ''));
  } while (html !== previous);
  return html
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => data[key] ?? '')
    .replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = data[key];
      return escapeHtml(Array.isArray(value) ? value.join('\n') : (value || NOT_RECORDED));
    });
};

const loadTemplate = async (file) => {
  const response = await fetch(`${TEMPLATE_DIR}${file}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${file} could not be loaded`);
  return response.text();
};

const certificateData = (record) => ({
  visit_date: formatDay(record.date),
  complaint: record.complaint,
  findings: record.diagnosis,
  recommendation: record.followUpRequired
    ? `Follow-up visit${record.followUpDate ? ` on ${formatDay(record.followUpDate)}` : ''}`
    : '',
  certificate_ref: record.medicalCertificateRef,
});

const consultationData = (record) => {
  const isEmergency = record.recordType === 'emergency';
  const vitals = record.vitals || {};
  return {
    document_title: isEmergency ? 'Emergency Encounter Record' : 'Consultation Record',
    is_emergency: isEmergency,
    visit_datetime: formatDateTime(record.date),
    complaint: record.complaint,
    history: record.history,
    symptoms: record.symptoms,
    service: record.appointment?.service,
    has_vitals: ['bp', 'hr', 'temp', 'rr', 'o2'].some((key) => vitals[key]),
    vital_bp: vitals.bp || '—',
    vital_hr: vitals.hr || '—',
    vital_temp: vitals.temp || '—',
    vital_rr: vitals.rr || '—',
    vital_o2: vitals.o2 || '—',
    diagnosis: record.diagnosis,
    assessment: record.assessment,
    interventions: record.interventions,
    treatment: record.treatment,
    medicines: record.dispensed || [],
    intervention: record.notesValue,
    disposition: record.disposition,
    follow_up: record.followUpRequired
      ? `Required${record.followUpDate ? ` — ${formatDay(record.followUpDate)}` : ''}`
      : 'Not required',
    medical_certificate: record.medicalCertificate ? record.medicalCertificateRef || 'Issued' : '',
  };
};

export const DOCUMENTS = {
  certificate: { label: 'Medical Certificate', file: 'Medical-Certificate', template: 'medical-certificate.html', data: certificateData },
  consultation: { label: 'Consultation Form', file: 'Consultation-Form', template: 'consultation-form.html', data: consultationData },
};

// `student` lets the nurse portal print for the student being seen; the student portal uses its own session.
export const openRecordDocument = (kind, record, mode = 'preview', student = null) => {
  const doc = DOCUMENTS[kind];
  // Opened right away (inside the click) so the browser does not block it; the template fills it in after.
  const printWindow = doc && window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write('<p style="font-family: Arial, sans-serif; color: #6b7280;">Preparing document…</p>');

  const info = student || studentInfo();
  const reference = record.medicalCertificateRef || record.id;
  const data = {
    clinic_name: CLINIC_NAME,
    issued_date: formatDay(new Date()),
    reference,
    // The title becomes the default file name in "Save as PDF".
    file_title: `PUPBC-${doc.file}-${reference}`,
    student_name: info.name,
    student_id: info.studentId,
    student_program: info.program,
    staff_name: record.staff,
    staff_role: record.staffRole,
    ...doc.data(record),
  };

  Promise.all([loadTemplate('layout.html'), loadTemplate(doc.template)])
    .then(([layout, body]) => {
      const page = fillTemplate(layout, { ...data, content: fillTemplate(body, data) });
      printWindow.document.open();
      printWindow.document.write(page);
      printWindow.document.close();
      if (mode === 'print') printWindow.setTimeout(() => printWindow.print(), 400);
    })
    .catch((error) => {
      printWindow.document.open();
      printWindow.document.write(`<p style="font-family: Arial, sans-serif; color: #b91c1c;">Unable to load the print template: ${escapeHtml(error.message)}.</p>`);
      printWindow.document.close();
    });
  return true;
};
