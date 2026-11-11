import { Pill, Tablets, FlaskConical, Package, ArrowUp, ArrowDown, Trash2, CalendarX, SlidersHorizontal } from 'lucide-react';

// Shared by the Medicine Inventory page, its form, and the stock history.

// A starting list for the Category dropdown; categories already used by saved medicines are added to it.
export const STANDARD_CATEGORIES = [
  'Pain Relief', 'Antibiotic', 'Antihistamine', 'Antacid', 'Cough & Cold',
  'Vitamins & Supplements', 'Oral Rehydration', 'First Aid & Antiseptic', 'Other',
];
export const UNITS = [
  ['tablet', 'Tablet'], ['capsule', 'Capsule'], ['sachet', 'Sachet'], ['ml', 'ML'],
  ['bottle', 'Bottle'], ['box', 'Box'], ['tube', 'Tube'], ['piece', 'Piece'],
];
export const unitLabel = value => UNITS.find(([key]) => key === value)?.[1] || (value ? value.charAt(0).toUpperCase() + value.slice(1) : '');
export const unitIcon = value => ({ capsule: Pill, tablet: Tablets, ml: FlaskConical, bottle: FlaskConical, box: Package }[value] || Pill);

// Badge colors and labels; STOCK and EXPIRY below pick from these.
export const STATUS = {
  ok: { label: 'In Stock', pill: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300', dot: 'bg-green-500' },
  low_stock: { label: 'Low Stock', pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300', dot: 'bg-amber-500' },
  out_of_stock: { label: 'Out of Stock', pill: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', dot: 'bg-red-500' },
  expiring_soon: { label: 'Expiring Soon', pill: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300', dot: 'bg-yellow-500' },
  expired: { label: 'Expired', pill: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', dot: 'bg-red-600' },
};

/*
 * The inventory table shows stock and expiry apart, so a medicine that is low on stock and also expiring
 * says both. Each has its own filter; the list can also be sorted by expiry date or by stock.
 */
export const STOCK = { in_stock: STATUS.ok, low_stock: STATUS.low_stock, out_of_stock: STATUS.out_of_stock };
export const STOCK_FILTERS = [['', 'All Stock Status'], ['in_stock', 'In Stock'], ['low_stock', 'Low Stock'], ['out_of_stock', 'Out of Stock']];
// expired: the date has passed. today: it is the expiry date. soon: within three months. ok: later than that.
export const EXPIRY = {
  ok: { label: 'Valid', pill: STATUS.ok.pill, dot: STATUS.ok.dot },
  expired: STATUS.expired,
  today: { label: 'Expires Today', pill: 'bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300', dot: 'bg-orange-500' },
  soon: STATUS.expiring_soon,
};
export const EXPIRY_FILTERS = [['', 'All Expiry Status'], ['expired', 'Expired'], ['today', 'Expires Today'], ['soon', 'Expiring Soon']];
export const SORTS = [['', 'Sort: Name (A–Z)'], ['expiry', 'Sort: Expiry (soonest first)'], ['stock', 'Sort: Stock (lowest first)']];

// A server that does not send the two states yet (an older backend) still sends the flags they come from.
export const stockStatusOf = medicine => medicine.stock_status || (medicine.is_out_of_stock ? 'out_of_stock' : medicine.is_low_stock ? 'low_stock' : 'in_stock');
export const expiryStatusOf = medicine => (medicine.expiry_status !== undefined ? medicine.expiry_status : medicine.is_expired ? 'expired' : medicine.is_expiring_soon ? 'soon' : medicine.next_expiry ? 'ok' : null);

// "in 12 days" / "3 days ago", beside the expiry badge.
export function expiryNote(days) {
  if (days === null || days === undefined || days === 0) return '';
  const count = Math.abs(days);
  const text = `${count} day${count === 1 ? '' : 's'}`;
  return days > 0 ? `in ${text}` : `${text} ago`;
}

// Stock movements, as the history table labels them.
export const MOVEMENTS = {
  stock_in: { label: 'Restock', icon: ArrowUp, pill: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300', amount: 'text-green-700 dark:text-green-400' },
  dispensed: { label: 'Dispensed', icon: ArrowDown, pill: 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300', amount: 'text-red-600 dark:text-red-400' },
  wasted: { label: 'Wasted', icon: Trash2, pill: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', amount: 'text-red-600 dark:text-red-400' },
  expired: { label: 'Expired', icon: CalendarX, pill: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', amount: 'text-red-600 dark:text-red-400' },
  adjustment: { label: 'Adjustment', icon: SlidersHorizontal, pill: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300', amount: 'text-amber-700 dark:text-amber-400' },
};
export const MOVEMENT_FILTERS = [['', 'All Movements'], ...Object.entries(MOVEMENTS).map(([key, value]) => [key, value.label])];

// 2026-12-31, the way the inventory table shows an expiry date.
export const isoDay = value => (value ? String(value).slice(0, 10) : '');

// 2026-10-15 09:24 AM, in clinic time.
export function dateTime(value) {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true,
  }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${String(parts.dayPeriod).toUpperCase()}`;
}

export const personName = person => (person ? [person.first_name, person.last_name].filter(Boolean).join(' ') : '');

// Reference / Reason: what the nurse wrote, plus who received it and which lot it came from.
export function reasonText(movement) {
  const student = movement.student ? `Student: ${personName(movement.student)} (${movement.student.student_id})` : '';
  const faculty = movement.faculty?.full_name ? `Faculty: ${movement.faculty.full_name}` : '';
  const lot = movement.batch?.lot_number ? `Lot ${movement.batch.lot_number}` : '';
  return [movement.reason, student, faculty, lot].filter(Boolean).join(' · ');
}

export const signed = value => (value > 0 ? `+${value}` : String(value));

// The signed change of a movement. A server that does not send quantity_change yet (an older backend)
// still gives the type and quantity, so the sign can be worked out; stock before/after then show as "—".
export const changeOf = movement => movement.quantity_change ?? (movement.movement_type === 'stock_in' ? Number(movement.quantity) : -Number(movement.quantity));
export const balance = value => (value === null || value === undefined ? '—' : value);
