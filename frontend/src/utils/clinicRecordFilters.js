export const emptyRecordFilters = { search: '', course: '', year: '', section: '', type: '' };
export const recordAcademic = (record, key) => String(record.student?.student_profile?.[key] || record.student?.profile?.[key] || record.student?.[key] || '').trim();
export const yearValue = value => String(value || '').match(/^[1-4](?=\D|$)/)?.[0] || String(value || '');
export const yearLabel = value => ({ 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year' }[value] || value);
export function filterClinicRecords(records, filters) {
  const search = filters.search.trim().toLowerCase();
  return records.filter(record => {
    const student = record.student || {};
    const text = [student.first_name, student.last_name, student.student_id, record.chief_complaint, record.reason, record.general_remarks, record.intervention, ...['course', 'year', 'section'].map(key => recordAcademic(record, key))].filter(Boolean).join(' ').toLowerCase();
    return (!search || text.includes(search))
      && (!filters.course || recordAcademic(record, 'course') === filters.course)
      && (!filters.year || yearValue(recordAcademic(record, 'year')) === filters.year)
      && (!filters.section || recordAcademic(record, 'section') === filters.section)
      && (!filters.type || record.record_type === filters.type);
  });
}
