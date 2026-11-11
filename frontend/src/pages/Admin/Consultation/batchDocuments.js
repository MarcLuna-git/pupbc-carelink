/*
 * Documents the nurse can issue for a group of students (Consultation → Batch Release).
 *
 * To add a document:
 *   1. Add an entry here (key, category, label, fields, toRecord).
 *   2. Add the same key, with its validation rules, to backend/config/batch_documents.php.
 *   3. Add its print template to public/templates/print/ and an entry in DOCUMENTS (recordDocuments.js),
 *      then point `template` at that DOCUMENTS key.
 *
 * Field options: name, label, type ('text' | 'date' | 'textarea' | 'select' | 'section'), required, max, placeholder,
 * span (2 = full width), options (for select: [[value, label]]), default ('today' or a value).
 * The student list is shared by every document, so it is not a field.
 */
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

export const BATCH_DOCUMENTS = [
  {
    key: 'clearance',
    category: 'Clearances',
    label: 'Medical Clearance',
    description: 'One certification for a batch of students who were assessed and are fit to join an activity.',
    template: 'clearance',
    titleField: 'activity', // must match title_field in backend/config/batch_documents.php
    fields: [
      { name: 'activity', label: 'Activity', required: true, max: 191, placeholder: 'e.g. Trimex' },
      { name: 'group_label', label: 'Group / Section', type: 'section', max: 100, placeholder: 'Search or choose, e.g. BSCPE 3-1' },
      { name: 'venue', label: 'Venue', required: true, max: 191, span: 2, placeholder: 'e.g. Lyceum of the Philippines University-Cavite' },
      { name: 'activity_date', label: 'Date of the activity', type: 'date', required: true },
      { name: 'certified_date', label: 'Date of the certification', type: 'date', required: true, default: 'today' },
    ],
    // What the print template (clearanceData in recordDocuments.js) needs.
    toRecord: ({ id, fields, students, staff }) => ({
      id: id || 'draft',
      activity: fields.activity,
      venue: fields.venue,
      groupLabel: fields.group_label || '',
      activityDate: fields.activity_date,
      certifiedDate: fields.certified_date,
      students: students.map((student) => student.name),
      staff,
      staffRole: 'Campus Nurse',
    }),
    // Extra detail under the title in the issued list.
    summary: (fields) => [fields.venue, fields.group_label].filter(Boolean).join(' · '),
  },
];

export const findBatchDocument = (key) => BATCH_DOCUMENTS.find((doc) => doc.key === key) || BATCH_DOCUMENTS[0];

export const emptyFields = (doc) => Object.fromEntries(doc.fields.map((field) => [
  field.name,
  field.default === 'today' ? today() : field.default ?? '',
]));

export const validateFields = (doc, values) => Object.fromEntries(doc.fields
  .filter((field) => field.required && !String(values[field.name] ?? '').trim())
  .map((field) => [field.name, `Enter the ${field.label.charAt(0).toLowerCase()}${field.label.slice(1)}.`]));

export const nurseLabel = (user) => `Nurse ${[user?.first_name, user?.last_name].filter(Boolean).join(' ')}`.trim();

export const formatDay = (value) => {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Saved documents keep students as { name, student_id }; older rows may hold plain names.
export const savedStudents = (list) => (list || []).map((student) => (typeof student === 'string' ? { name: student, student_id: null } : student));

// The print record of a saved document (a row from /nurse/batch-documents).
export const savedRecord = (item, fallbackStaff) => findBatchDocument(item.type).toRecord({
  id: item.id,
  fields: item.fields || {},
  students: savedStudents(item.students),
  staff: item.issuer ? nurseLabel(item.issuer) : fallbackStaff,
});

export const trimFields =(values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
