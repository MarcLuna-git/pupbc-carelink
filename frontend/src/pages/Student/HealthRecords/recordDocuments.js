import { escapeHtml } from '../../../utils/escapeHtml';
import { formatPersonName } from '../../../utils/studentUser';
import { getUser } from '../../../services/session';
import api from '../../../services/api';
import { whenPrintReady } from '../../../utils/printReady';
import { currentSignatory, signatureBlock } from '../../../services/documentSignatory';

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
const CLINIC_ADDRESS = 'Barangay Zapote, Biñan City, Laguna';
const CLINIC_EMAIL = 'pupclinicbc@gmail.com / pupclinicbc@yahoo.com';

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

const ageFrom = (birthday) => {
  const born = birthday ? new Date(birthday) : null;
  if (!born || Number.isNaN(born.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  if (today < new Date(today.getFullYear(), born.getMonth(), born.getDate())) age -= 1;
  return String(age);
};

/*
 * The student block of the consultation form, from a student account, its
 * student profile and its emergency contact (health profile, or the older
 * guardian fields). Missing parts stay empty and print blank.
 */
export const studentDetails = (user = {}, profile = {}, emergency = {}) => {
  user ||= {};
  profile ||= {};
  emergency ||= {};
  return {
    name: formatPersonName(`${user.first_name || ''} ${user.last_name || ''}`.trim()),
    studentId: user.student_id || '',
    program: [profile.course || user.course, profile.year || user.year, profile.section || user.section].filter(Boolean).join(' • '),
    age: ageFrom(profile.birthday || user.birthday),
    // M / F for the OJT certificate ("(M/F)"); blank when the profile says something else.
    sexInitial: { male: 'M', female: 'F' }[String(profile.gender || user.gender || '').toLowerCase()] || '',
    address: profile.address || '',
    contact: profile.mobile_number || '',
    // Name and relationship apart (Consultation Form) and together (Student Profile).
    emergencyPerson: emergency.name || profile.guardian_name || '',
    emergencyRelationship: emergency.relationship || profile.guardian_relationship || '',
    emergencyName: [emergency.name || profile.guardian_name, emergency.relationship || profile.guardian_relationship]
      .filter(Boolean).join(' — '),
    emergencyContact: emergency.phone || profile.guardian_contact || '',
  };
};

// Student portal: the signed-in student's own profile, or the session account if that cannot be loaded.
const loadOwnDetails = async () => {
  try {
    const { data } = await api.get('/student/profile');
    return studentDetails(data.data?.user, data.data?.profile, data.data?.emergency_contact);
  } catch {
    return studentDetails(getUser('student'));
  }
};

const NOT_RECORDED = 'Not recorded';

/*
 * Fills a template: {{#key}}…{{/key}} keeps its part when key has a value,
 * {{^key}}…{{/key}} when it does not, {{{key}}} inserts HTML as is, and
 * {{key}} inserts the value as text (or `empty` when it has none).
 */
const fillTemplate = (template, data, empty = NOT_RECORDED) => {
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
      return escapeHtml((Array.isArray(value) ? value.join('\n') : value) || empty);
    });
};

const loadTemplate = async (file) => {
  const response = await fetch(`${TEMPLATE_DIR}${file}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`${file} could not be loaded`);
  return response.text();
};

const certificateData = (record) => ({
  // The certificate header also carries the clinic's address and email.
  clinic_address: CLINIC_ADDRESS,
  clinic_email: CLINIC_EMAIL,
  visit_date: formatDay(record.date),
  complaint: record.complaint,
  findings: record.diagnosis,
  recommendation: record.followUpRequired
    ? `Follow-up visit${record.followUpDate ? ` on ${formatDay(record.followUpDate)}` : ''}`
    : '',
  certificate_ref: record.medicalCertificateRef,
  // Not recorded by the system yet; the nurse writes the number of days by hand.
  rest_days: '',
});

// Medical Certificate (Sick): examined on the visit date, the impression, and the days of attendance the illness needs.
const sickCertificateData = (record) => ({
  issued_date: formatDay(record.date),
  visit_date: formatDay(record.date),
  certificate_ref: record.sickCertificateRef,
  findings: record.diagnosis,
  rest_days: record.sickRestDays ? String(record.sickRestDays) : '',
  recommendation: record.followUpRequired
    ? `Follow-up visit${record.followUpDate ? ` on ${formatDay(record.followUpDate)}` : ''}`
    : '',
});

// Medical Certificate (OJT): essentially normal, may undergo On the Job Training at the company.
const ojtCertificateData = (record) => ({
  issued_date: formatDay(record.date),
  visit_date: formatDay(record.date),
  certificate_ref: record.ojtCertificateRef,
  ojt_company: record.ojtCompany,
});

// The form is dated on the visit, when the nurse released it.
const liabilityData = (record) => ({
  issued_date: formatDay(record.date),
  visit_date: formatDay(record.date),
  activity: record.liabilityActivity,
});

const consultationData = (record) => {
  const isEmergency = record.recordType === 'emergency';
  const vitals = record.vitals || {};
  return {
    document_title: isEmergency ? 'Emergency Encounter Form' : 'Consultation Form',
    is_emergency: isEmergency,
    visit_datetime: formatDateTime(record.date),
    complaint: record.complaint,
    history: record.history,
    symptoms: record.symptoms,
    service: record.appointment?.service,
    vital_bp: vitals.bp,
    vital_hr: vitals.hr,
    vital_temp: vitals.temp,
    vital_rr: vitals.rr,
    vital_o2: vitals.o2,
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
    medical_certificate: record.medicalCertificate ? record.medicalCertificateRef || 'Issued' : 'Not issued',
  };
};

/*
 * Student Health Profile (nurse portal): who the student is and what the health profile says.
 * `record.profile` is the personal extras (birthday, sex, email); `record.health` is the health profile.
 * Only what was filled in is listed, so the printout is not full of "Not provided".
 */
const PROFILE_GROUPS = [
  ['Medical history', [['medical_history', 'Medical conditions'], ['allergy_details', 'Allergies'], ['other_medical_history', 'Other medical history'], ['medications', 'Current medications'], ['family_history', 'Family history']]],
  ['Hospitalization, surgery & COVID-19', [['hospitalized', 'Hospitalized before'], ['hospitalization_date', 'Hospitalization date'], ['hospitalization_diagnosis', 'Hospitalization diagnosis'], ['surgery', 'Had surgery'], ['surgery_date', 'Surgery date'], ['surgery_diagnosis', 'Surgery diagnosis'], ['had_covid', 'Had COVID-19'], ['covid_date', 'COVID-19 date'], ['covid_diagnosis', 'COVID-19 notes']]],
  ['Lifestyle & accessibility', [['occupation', 'Occupation'], ['marital_status', 'Marital status'], ['tobacco_use', 'Tobacco use'], ['tobacco_amount', 'Tobacco amount'], ['tobacco_duration', 'Tobacco duration'], ['alcohol_use', 'Alcohol use'], ['other_substance_use', 'Other substance use'], ['has_disability', 'Has a disability'], ['disability_details', 'Disability details']]],
  // A third value `true` means "quiet": a No / 0 is left out, so the section does not print at all when it does not apply.
  ['Reproductive history', [['last_menstrual_period', 'Last menstrual period'], ['has_children', 'Has children', true], ['number_of_children', 'Number of children', true], ['age_first_pregnancy', 'Age at first pregnancy', true], ['gravidity', 'Gravidity', true], ['term', 'Term', true], ['premature', 'Premature', true], ['abortion', 'Abortion', true], ['living_children', 'Living children', true]]],
  ['Consent', [['consent_signature', 'Signed by'], ['consent_date', 'Date signed']]],
];

const profileValue = (key, value, quiet = false) => {
  if (value === null || value === undefined || value === '') return null;
  if (quiet && (value === false || value === 0 || value === '0')) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) {
    const items = value.map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item).trim())).filter(Boolean);
    return items.length ? items.join(', ') : null;
  }
  const text = String(value).trim();
  if (!text) return null;
  const isDate = /(_date|_period)$/.test(key) && !Number.isNaN(new Date(text).getTime());
  return isDate ? formatDay(text) : text;
};

const healthSections = (health) => {
  if (!health) return '<p class="statement">Health profile not yet submitted.</p>';
  const sections = PROFILE_GROUPS.map(([title, fields]) => {
    const rows = fields
      .map(([key, label, quiet]) => [label, profileValue(key, health[key], quiet)])
      .filter(([, value]) => value !== null)
      .map(([label, value]) => `<div class="field"><span class="label">${escapeHtml(label)}:</span><span class="value">${escapeHtml(value)}</span></div>`);
    return rows.length ? `<h2>${escapeHtml(title)}</h2>${rows.join('')}` : '';
  }).join('');
  return sections || '<p class="statement">The health profile has no answers recorded yet.</p>';
};

const profileData = (record) => ({
  document_title: 'Student Health Profile',
  student_birthday: record.profile?.birthday ? formatDay(record.profile.birthday) : '',
  student_sex: String(record.profile?.sex || '').replace(/^./, (c) => c.toUpperCase()),
  student_email: record.profile?.email || '',
  health_sections: healthSections(record.health),
});

// Medical Clearance: one certification for a batch of students whose names the nurse typed in.
// The names go in as ready-made HTML (escaped), because the template engine has no loop.
const clearanceData = (record) => {
  const students = record.students || [];
  return {
    issued_date: formatDay(record.certifiedDate || record.date),
    activity: record.activity,
    venue: record.venue,
    activity_date: formatDay(record.activityDate),
    group: record.groupLabel,
    student_count: String(students.length),
    student_list: `<ol class="clearance-list${students.length > 12 ? ' two' : ''}">${students.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ol>`,
  };
};

export const DOCUMENTS = {
  clearance: { label: 'Medical Clearance', file: 'Medical-Clearance', template: 'medical-clearance.html', data: clearanceData, empty: '' },
  profile: { label: 'Student Profile', file: 'Student-Profile', template: 'student-profile.html', data: profileData, empty: '' },
  // Both documents print every row; fields with no value are left blank instead of "Not recorded".
  certificate: { label: 'Medical Certificate', file: 'Medical-Certificate', template: 'medical-certificate.html', data: certificateData, empty: '' },
  sick: { label: 'Medical Certificate (Sick)', file: 'Medical-Certificate-Sick', template: 'medical-certificate-sick.html', data: sickCertificateData, empty: '', rightLogo: 'cho-logo.jpeg' },
  ojt: { label: 'Medical Certificate (OJT)', file: 'Medical-Certificate-OJT', template: 'medical-certificate-ojt.html', data: ojtCertificateData, empty: '', rightLogo: 'cho-logo.jpeg' },
  // `paper: 'a4'` prints on A4 (paper-a4.css); documents without it stay on short bond paper (Letter).
  consultation: { label: 'Consultation Form', file: 'Consultation-Form', template: 'consultation-form.html', data: consultationData, empty: '', paper: 'a4' },
  liability: { label: 'Medical Liability Form', file: 'Medical-Liability-Form', template: 'medical-liability-form.html', data: liabilityData, empty: '', rightLogo: 'bagong-pilipinas-logo.png' },
};

/*
 * The finished page (layout + document template, filled in) as an HTML string. It is what Print
 * writes into the print window and what the consultation review shows in its preview frame, so
 * what the nurse reviews is exactly what prints. `student` (from studentDetails) is for the nurse
 * portal; without it the student portal loads the signed-in student's own profile.
 */
export const buildRecordDocument = async (kind, record, student = null) => {
  const doc = DOCUMENTS[kind];
  if (!doc) throw new Error('Unknown document');
  const reference = (kind === 'ojt' ? record.ojtCertificateRef : kind === 'sick' ? record.sickCertificateRef : kind !== 'liability' && record.medicalCertificateRef) || record.id;
  const [layout, body, info] = await Promise.all([loadTemplate('layout.html'), loadTemplate(doc.template), student || loadOwnDetails()]);
  // Full URL: the print window is about:blank and the preview frame is srcdoc, so relative image paths would not resolve.
  const templateDir = new URL(TEMPLATE_DIR, window.location.origin).href;
  // Nurse portal only (it passes `student`): the signatory picked in the account menu replaces the
  // template's own signature part. The student portal always prints the template's usual signatory.
  const signatory = student ? currentSignatory(getUser('nurse')) : null;
  const data = {
    clinic_name: CLINIC_NAME,
    template_dir: templateDir,
    // A plain on/off flag: layout.html holds the full, fixed address of paper-a4.css.
    paper_a4: doc.paper === 'a4' ? 'yes' : '',
    signature_block: signatory ? signatureBlock(signatory, templateDir) : '',
    issued_date: formatDay(new Date()),
    reference,
    // The title becomes the default file name in "Save as PDF".
    file_title: `PUPBC-${doc.file}-${reference}`,
    student_name: info.name,
    student_id: info.studentId,
    student_program: info.program,
    student_age: info.age,
    student_sex: info.sexInitial,
    student_address: info.address,
    student_contact: info.contact,
    emergency_name: info.emergencyName,
    emergency_person: info.emergencyPerson,
    emergency_relationship: info.emergencyRelationship,
    emergency_contact: info.emergencyContact,
    // Letterhead logo on the right (City Health Office logo on the OJT certificate, Bagong Pilipinas on the Medical Liability Form).
    right_logo: doc.rightLogo ? new URL(doc.rightLogo, new URL(TEMPLATE_DIR, window.location.origin)).href : '',
    staff_name: record.staff,
    staff_role: record.staffRole,
    ...doc.data(record),
  };
  return fillTemplate(layout, { ...data, content: fillTemplate(body, data, doc.empty ?? NOT_RECORDED) });
};

// `student` (from studentDetails) lets the nurse portal print for the student being seen;
// the student portal loads the signed-in student's own profile.
export const openRecordDocument = (kind, record, mode = 'preview', student = null) => {
  const doc = DOCUMENTS[kind];
  // Opened right away (inside the click) so the browser does not block it; the template fills it in after.
  const printWindow = doc && window.open('', '_blank');
  if (!printWindow) return false;
  // Plain text: inline style attributes are blocked by the site's Content-Security-Policy.
  printWindow.document.write('<p>Preparing document…</p>');

  buildRecordDocument(kind, record, student)
    .then((page) => {
      printWindow.document.open();
      printWindow.document.write(page);
      printWindow.document.close();
      if (mode === 'print') {
        // Wait for print.css and the logos so they are on the printout.
        whenPrintReady(printWindow.document)
          .then(() => printWindow.setTimeout(() => printWindow.print(), 200));
      }
    })
    .catch((error) => {
      printWindow.document.open();
      printWindow.document.write(`<p>Unable to load the print template: ${escapeHtml(error.message)}.</p>`);
      printWindow.document.close();
    });
  return true;
};
