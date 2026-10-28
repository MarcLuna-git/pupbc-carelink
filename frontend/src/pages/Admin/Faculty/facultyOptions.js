// Shared by the Faculty page: its lists, badges, avatars and date formats.

export const FACULTY_TYPES = [['full_time', 'Full-time'], ['part_time', 'Part-time']];
export const typeLabel = value => FACULTY_TYPES.find(([key]) => key === value)?.[1] || value || '';
export const TYPE_PILL = {
  full_time: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
  part_time: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300',
};

export const STATUSES = {
  active: { label: 'Active', pill: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300', dot: 'bg-green-500' },
  inactive: { label: 'Inactive', pill: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
};
export const STATUS_FILTERS = [['', 'All'], ['active', 'Active'], ['inactive', 'Inactive']];

// Lists for the Add / Edit form. A value a nurse already saved is added to the list when it is not here.
export const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Instructor', 'Lecturer', 'Department Head', 'Dean', 'Staff'];
export const DEPARTMENTS = [
  'College of Information Technology', 'College of Business Administration', 'College of Education', 'College of Engineering',
  'College of Arts and Sciences', 'College of Accountancy', 'Administrative / Support Staff',
];

// "Maria Santos" -> "MS"; one word -> its first two letters.
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// The same name always gets the same avatar colour.
const AVATARS = ['bg-maroon-800', 'bg-rose-800', 'bg-amber-800', 'bg-red-700', 'bg-stone-800', 'bg-orange-800', 'bg-pink-800'];
export function avatarColor(name) {
  let hash = 0;
  for (const char of String(name || '')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATARS[hash % AVATARS.length];
}

const ZONE = 'Asia/Manila';
// Oct 12, 2025
export const dayLabel = value => (value ? new Date(value).toLocaleDateString('en-US', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric' }) : '');
// Oct 12, 2025 10:24 AM
export const dateTimeLabel = value => (value ? new Date(value).toLocaleString('en-US', { timeZone: ZONE, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '');
// 1 tablet
export const quantityLabel = dispensing => [dispensing.quantity, dispensing.unit].filter(value => value !== null && value !== undefined && value !== '').join(' ');
// The first day and the last day of this month, in clinic time, as yyyy-mm-dd.
export function currentMonth(now = new Date()) {
  const [year, month] = now.toLocaleDateString('en-CA', { timeZone: ZONE }).split('-').map(Number);
  const pad = value => String(value).padStart(2, '0');
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(new Date(year, month, 0).getDate())}` };
}
