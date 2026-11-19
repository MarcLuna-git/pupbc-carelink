import academics from '../../../data/registration-academics.json';

// Kapareho ng values sa Student/Register.jsx; panatilihing tugma.
export const courses = [
  ['BSIT', 'Information Technology'], ['BSCS', 'Computer Science'],
  ['BSIS', 'Information Systems'], ['BSCE', 'Civil Engineering'],
  ['BSEE', 'Electrical Engineering'], ['BSME', 'Mechanical Engineering'],
  ['BSA', 'Accountancy'], ['BSBA', 'Business Administration'],
  ['BSED', 'Secondary Education'], ['BEED', 'Elementary Education'],
  ['BSN', 'Nursing'], ['BSHM', 'Hospitality Management'],
  ['BSTourism', 'Tourism Management'], ['BSOA', 'Office Administration'],
  ['BPA', 'Public Administration'],
];
export const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const sections = ['1-1', '1-2', '1-3', '1-4', '1-5', '2-1', '2-2', '2-3', '2-4', '2-5', '3-1', '3-2', '3-3', '3-4', '3-5', '4-1', '4-2', '4-3', '4-4', '4-5'];
export const directoryCourses = academics.map(({ code, name }) => [code, name]);
export const directorySections = [...new Set(academics.flatMap(({ sections }) => sections))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export const directorySectionsForYear = year => year ? directorySections.filter(section => section.startsWith(`${years.indexOf(year) + 1}-`)) : directorySections;
export const nextDirectoryFilters = (previous, key, value) => ({ ...previous, [key]: value, ...(key === 'year' && value !== previous.year ? { section: '' } : {}) });
export const emptyFilters = { search: '', course: '', year: '', section: '', status: '', date_from: '', date_to: '' };
export const directoryStatusOptions = [['active', 'Active'], ['archived', 'Archived']];
export const directoryDefaultFilters = { ...emptyFilters, status: 'active' };
export const appliedDirectoryFilters = filters => Object.entries(filters).filter(([key, value]) => value && (key !== 'status' || value !== directoryDefaultFilters.status));
export const academic = (student, field) => student?.student_profile?.[field] || student?.[field] || '';
export const fullName = student => [student?.first_name, student?.middle_name, student?.last_name].filter(Boolean).join(' ');
export const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-maroon-500 focus-visible:ring-offset-2';
export const inputStyle = 'w-full rounded-[10px] border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-maroon-500 focus:outline-none focus:ring-2 focus:ring-maroon-500/20 dark:focus:ring-maroon-300/30 dark:focus:border-maroon-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
export const primary = `inline-flex items-center justify-center gap-2 rounded-[10px] bg-maroon-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-maroon-900 disabled:opacity-50 ${focus}`;
export const secondary = `inline-flex items-center justify-center gap-2 rounded-[10px] border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-700 ${focus}`;
