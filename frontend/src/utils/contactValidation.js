const validName = /^[\p{L}\s\-'.]+$/u;

export const contactNameError = (name, required = false) => {
  const value = String(name ?? '').trim();
  if (!value) return required ? 'Full name is required' : '';
  return validName.test(value) ? '' : 'Enter a valid name.';
};

const validPhone = /^(?:09\d{9}|\+639\d{9})$/;

// Keep partial-entry behavior in sync with Register.jsx's formatPhilippineMobile.
export const formatContactPhone = (raw) => {
  const value = String(raw).replace(/[\s()-]/g, '');
  const prefixed = value.startsWith('63') ? `+${value}` : value;
  const validPartial = /^(?:|0|09\d{0,9}|\+|\+6|\+63|\+639\d{0,9})$/;
  return validPartial.test(prefixed) ? prefixed : null;
};

export const contactPhoneError = (phone, required = false) => {
  const value = String(phone ?? '').trim();
  if (!value) return required ? 'Phone number is required' : '';
  return validPhone.test(value) ? '' : 'Use 09XXXXXXXXX or +639XXXXXXXXX.';
};
