const validName = /^[\p{L}\s\-'.]+$/u;

export const contactNameError = (name, required = false) => {
  const value = String(name ?? '').trim();
  if (!value) return required ? 'Full name is required' : '';
  return validName.test(value) ? '' : 'Enter a valid name.';
};

export const signatureNameError = (signature, user) => {
  const normalize = (value) => String(value ?? '').normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
  const signed = normalize(signature);
  if (!signed) return 'Full name is required as signature';
  const first = String(user?.first_name ?? '').trim();
  const middle = String(user?.middle_name ?? '').trim();
  const last = String(user?.last_name ?? '').trim();
  if (!first || !last) return '';
  const names = [`${first} ${last}`];
  if (middle) names.push(`${first} ${middle} ${last}`);
  return names.some((name) => normalize(name) === signed) ? '' : 'Signature must match your registered name.';
};

// Mobile numbers use one format everywhere: +639XXXXXXXXX. The old 09XXXXXXXXX form is no
// longer used; a pasted or autofilled 09..., 639... or +639... is turned into +639...
const validPhone = /^\+639\d{9}$/;
export const PHONE_FORMAT_MESSAGE = 'Use +639XXXXXXXXX.';

// The 10 digits after +63 (9XXXXXXXXX) from whatever was typed or pasted, or null when the
// text cannot be a Philippine mobile number. Used by PhilippineMobileInput.
export const philippineMobileDigits = (raw) => {
  const text = String(raw ?? '').trim();
  let digits;
  if (text.startsWith('+63')) {
    // A stored value, even a partial one while typing ('+639', '+63917').
    digits = text.slice(3).replace(/\D/g, '');
  } else {
    digits = text.replace(/\D/g, '');
    if (digits.startsWith('63') && digits.length > 10) digits = digits.slice(2);
  }
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits && !digits.startsWith('9')) return null;
  return digits.slice(0, 10);
};

// Typed or pasted text as the stored value: '+63' plus the digits so far, '' when empty.
export const formatContactPhone = (raw) => {
  const digits = philippineMobileDigits(raw);
  if (digits === null) return null;
  return digits ? `+63${digits}` : '';
};

export const contactPhoneError = (phone, required = false) => {
  const value = String(phone ?? '').trim();
  if (!value) return required ? 'Phone number is required' : '';
  return validPhone.test(value) ? '' : PHONE_FORMAT_MESSAGE;
};

export const canonicalContactPhone = (phone) => {
  const value = String(phone ?? '').trim();
  if (validPhone.test(value)) return value;
  return /^639\d{9}$/.test(value) ? `+${value}` : null;
};

export const ownMobileContactError = (contact, mobile) => {
  const number = canonicalContactPhone(contact);
  return number && number === canonicalContactPhone(mobile)
    ? 'Emergency contact number must be different from your mobile number.'
    : '';
};
