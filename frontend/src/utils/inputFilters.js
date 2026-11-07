/*
 * Keystroke filters for form fields: each takes what the user typed and returns only the
 * characters that field allows, so a name field never takes numbers and a number field never
 * takes letters. The server validates the same rules again.
 */

// Names: letters (any language), spaces, hyphens, apostrophes and periods. "Ma. Dela Cruz-O'Neil"
export const nameOnly = (value) => String(value ?? '').replace(/[^\p{L}\s\-'.]/gu, '');

// Words such as an occupation: letters, spaces and . , ' - / &
export const wordsOnly = (value) => String(value ?? '').replace(/[^\p{L}\s.,'\-/&]/gu, '');

// Whole numbers only, optionally capped to `maxLength` digits.
export const digitsOnly = (value, maxLength) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  return maxLength ? digits.slice(0, maxLength) : digits;
};

// A decimal number with up to `intDigits` whole digits and `decimals` decimal places, e.g. 36.5
export const decimalOnly = (value, intDigits = 3, decimals = 1) => {
  const [whole = '', ...rest] = String(value ?? '').replace(/[^\d.]/g, '').split('.');
  const fraction = rest.join('').slice(0, decimals);
  const intPart = whole.slice(0, intDigits);
  return rest.length && decimals > 0 ? `${intPart}.${fraction}` : intPart;
};

// Blood pressure as systolic/diastolic: up to 3 digits, one slash, up to 3 digits. "120/80"
export const bloodPressureOnly = (value) => {
  const [top = '', ...rest] = String(value ?? '').replace(/[^\d/]/g, '').split('/');
  const bottom = rest.join('').slice(0, 3);
  return rest.length ? `${top.slice(0, 3)}/${bottom}` : top.slice(0, 3);
};

// Codes such as BSIT, BSED-English or 1-1: letters, digits and hyphens, no spaces.
export const codeOnly = (value) => String(value ?? '').replace(/[^\p{L}\d-]/gu, '');

// Student ID as YYYY-NNNNN-BN-D, built as it is typed (same as the registration form).
export const STUDENT_ID_MIN_YEAR = 2000;

// True when `prefix` (1-4 digits) can still grow into a year from 2000 up to the current year.
export const isStudentIdYearPrefix = (prefix) => {
  const max = new Date().getFullYear();
  for (let year = STUDENT_ID_MIN_YEAR; year <= max; year += 1) {
    if (String(year).startsWith(prefix)) return true;
  }
  return false;
};

export const isValidStudentIdYear = (year) => /^\d{4}$/.test(year)
  && +year >= STUDENT_ID_MIN_YEAR && +year <= new Date().getFullYear();

export const formatStudentId = (value) => {
  let digits = '';
  let suffix = '';
  let finalDigit = '';
  for (const char of String(value ?? '').toUpperCase()) {
    if (/\d/.test(char)) {
      if (digits.length < 4) {
        if (isStudentIdYearPrefix(digits + char)) digits += char;
      } else if (digits.length < 9) digits += char;
      else if (suffix === 'BN' && /^[01]$/.test(char)) finalDigit = char;
    } else if (digits.length === 9 && /^[BN]$/.test(char) && suffix.length < 2) {
      if (char === (suffix.length === 0 ? 'B' : 'N')) suffix += char;
    }
  }
  let formatted = digits.slice(0, 4);
  if (digits.length > 4) formatted += `-${digits.slice(4)}`;
  if (suffix) formatted += `-${suffix}`;
  if (finalDigit) formatted += `-${finalDigit}`;
  return formatted;
};
