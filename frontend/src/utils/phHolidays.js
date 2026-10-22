/*
 * Philippine holidays for a given year, computed on the device (no network).
 *
 * Covers the regular and special (non-working) holidays that follow a fixed
 * rule: fixed dates, the Holy Week days (from Easter), National Heroes Day
 * (last Monday of August) and Chinese New Year (lunar, from a lookup table).
 * Holidays set each year by proclamation only (Eid'l Fitr, Eid'l Adha, and
 * any moved or added days) are not included.
 *
 * Returns [{ date: 'YYYY-MM-DD', name, type: 'regular' | 'special' }].
 */

const pad = (value) => String(value).padStart(2, '0');
export const toDateKey = (year, monthIndex, day) => `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

// Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
const easterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const shift = (date, days) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const keyOf = (date) => toDateKey(date.getFullYear(), date.getMonth(), date.getDate());

const lastMondayOfAugust = (year) => {
  const date = new Date(year, 7, 31);
  while (date.getDay() !== 1) date.setDate(date.getDate() - 1);
  return date;
};

const CHINESE_NEW_YEAR = {
  2024: '02-10', 2025: '01-29', 2026: '02-17', 2027: '02-06', 2028: '01-26',
  2029: '02-13', 2030: '02-03', 2031: '01-23', 2032: '02-11', 2033: '01-31',
};

const cache = new Map();

export function philippineHolidays(year) {
  if (cache.has(year)) return cache.get(year);

  const fixed = (monthIndex, day, name, type) => ({ date: toDateKey(year, monthIndex, day), name, type });
  const easter = easterSunday(year);
  const list = [
    fixed(0, 1, "New Year's Day", 'regular'),
    fixed(1, 25, 'EDSA People Power Anniversary', 'special'),
    { date: keyOf(shift(easter, -3)), name: 'Maundy Thursday', type: 'regular' },
    { date: keyOf(shift(easter, -2)), name: 'Good Friday', type: 'regular' },
    { date: keyOf(shift(easter, -1)), name: 'Black Saturday', type: 'special' },
    fixed(3, 9, 'Araw ng Kagitingan', 'regular'),
    fixed(4, 1, 'Labor Day', 'regular'),
    fixed(5, 12, 'Independence Day', 'regular'),
    fixed(7, 21, 'Ninoy Aquino Day', 'special'),
    { date: keyOf(lastMondayOfAugust(year)), name: 'National Heroes Day', type: 'regular' },
    fixed(10, 1, "All Saints' Day", 'special'),
    fixed(10, 2, "All Souls' Day", 'special'),
    fixed(10, 30, 'Bonifacio Day', 'regular'),
    fixed(11, 8, 'Feast of the Immaculate Conception', 'special'),
    fixed(11, 24, 'Christmas Eve', 'special'),
    fixed(11, 25, 'Christmas Day', 'regular'),
    fixed(11, 30, 'Rizal Day', 'regular'),
    fixed(11, 31, 'Last Day of the Year', 'special'),
  ];
  if (CHINESE_NEW_YEAR[year]) list.push({ date: `${year}-${CHINESE_NEW_YEAR[year]}`, name: 'Chinese New Year', type: 'special' });

  list.sort((a, b) => a.date.localeCompare(b.date));
  cache.set(year, list);
  return list;
}

/* Holidays keyed by date for every year touched by [fromKey, toKey]. */
export function holidaysByDate(fromKey, toKey) {
  const map = {};
  for (let year = Number(fromKey.slice(0, 4)); year <= Number(toKey.slice(0, 4)); year += 1) {
    philippineHolidays(year).forEach((holiday) => {
      if (holiday.date >= fromKey && holiday.date <= toKey) (map[holiday.date] ||= []).push(holiday);
    });
  }
  return map;
}
