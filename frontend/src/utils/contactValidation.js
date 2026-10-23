const validName = /^[\p{L}\s\-'.]+$/u;

export const contactNameError = (name, required = false) => {
  const value = String(name ?? '').trim();
  if (!value) return required ? 'Full name is required' : '';
  return validName.test(value) ? '' : 'Enter a valid name.';
};
