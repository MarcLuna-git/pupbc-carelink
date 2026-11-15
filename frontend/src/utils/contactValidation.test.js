import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as contactValidation from './contactValidation.js';

const { contactNameError, contactPhoneError, formatContactPhone, philippineMobileDigits, canonicalContactPhone, ownMobileContactError, signatureNameError } = contactValidation;

test('emergency contact names follow the registration name rule', () => {
  for (const name of ['Juan Dela Cruz', 'Peña', 'José', "O'Brien", 'Anne-Marie', 'Jr.']) {
    assert.equal(contactNameError(name, true), '', name);
  }
  for (const name of ['Juan2', '123', 'Juan@', 'Anne_Marie', 'Juan😀', 'O’Brien']) {
    assert.equal(contactNameError(name, true), 'Enter a valid name.', name);
  }
  assert.equal(contactNameError('   ', true), 'Full name is required');
  assert.equal(contactNameError('   '), '');
});

test('mobile numbers use only +639XXXXXXXXX and distinguish blank from invalid', () => {
  assert.equal(contactPhoneError('+639123456789', true), '');
  for (const phone of ['09123456789', '0912345678', '+63912345678', '08123456789', '+638123456789', '0912345678a', '639123456789']) {
    assert.equal(contactPhoneError(phone, true), 'Use +639XXXXXXXXX.', phone);
  }
  assert.equal(contactPhoneError('   ', true), 'Phone number is required');
  assert.equal(contactPhoneError('   '), '');
});

test('typed or pasted numbers become +639... and never 09...', () => {
  const cases = {
    '': '', '0': '', '9': '+639', '917': '+63917', '9171234567': '+639171234567',
    '09171234567': '+639171234567', '639171234567': '+639171234567', '+639171234567': '+639171234567',
    '+63 917 123 4567': '+639171234567', '917123456789': '+639171234567',
  };
  for (const [input, expected] of Object.entries(cases)) assert.equal(formatContactPhone(input), expected, input);
  for (const input of ['1', '6', '08123456789', '+638123456789']) assert.equal(formatContactPhone(input), null, input);
  assert.equal(philippineMobileDigits('+639171234567'), '9171234567');
});

test('typing one digit at a time keeps every digit (stored value read back by the field)', () => {
  let stored = '';
  for (const key of '9171234567') {
    const shown = philippineMobileDigits(stored);
    assert.notEqual(shown, null, stored);
    stored = formatContactPhone(shown + key);
    assert.notEqual(stored, null, key);
    assert.equal(formatContactPhone(stored), stored, 'a stored value stays the same when passed again');
  }
  assert.equal(stored, '+639171234567');
  for (const partial of ['+639', '+6391', '+63917']) assert.equal(philippineMobileDigits(partial), partial.slice(3));
});

test('the Register page and the other mobile fields use the same PhilippineMobileInput', () => {
  for (const page of ['../pages/Student/Register.jsx', '../pages/Student/Overview/Overview.jsx', '../pages/Student/HealthProfile/HealthProfile.jsx', '../pages/Admin/Faculty/FacultyFormModal.jsx', '../pages/Admin/Consultation/ConsultationVisit.jsx']) {
    const source = readFileSync(new URL(page, import.meta.url), 'utf8');
    assert.match(source, /<PhilippineMobileInput/, page);
    assert.doesNotMatch(source, /09X|09\d/, page);
  }
});

test('own mobile comparison uses the +639 form', () => {
  const message = 'Emergency contact number must be different from your mobile number.';
  assert.equal(canonicalContactPhone('639171234567'), '+639171234567');
  assert.equal(canonicalContactPhone('+639171234567'), '+639171234567');
  for (const phone of ['', '   ', '09171234567', '0917123456', '+638171234567', 'not a phone', null]) {
    assert.equal(canonicalContactPhone(phone), null, String(phone));
  }
  assert.equal(ownMobileContactError('639171234567', '+639171234567'), message);
  assert.equal(ownMobileContactError('+639171234567', '+639171234567'), message);
  assert.equal(ownMobileContactError('+639171234567', '+639987654321'), '');
  assert.equal(ownMobileContactError('', ''), '');
  assert.equal(ownMobileContactError('bad', 'bad'), '');
});

test('electronic signature matches either registered full-name form', () => {
  const user = { first_name: 'Juan', middle_name: 'Peña', last_name: 'Dela Cruz' };
  const mismatch = 'Signature must match your registered name.';
  for (const signature of ['Juan Dela Cruz', 'Juan Peña Dela Cruz', '  jUaN   pEñA  dElA   cRuZ  ', 'Juan Pen\u0303a Dela Cruz']) {
    assert.equal(signatureNameError(signature, user), '', signature);
  }
  for (const signature of ['Other Student', 'Juan Pena Dela Cruz', 'Dela Cruz, Juan', 'J. Dela Cruz', 'Juan Dela Cruz Jr.']) {
    assert.equal(signatureNameError(signature, user), mismatch, signature);
  }
  assert.equal(signatureNameError('   ', user), 'Full name is required as signature');
  assert.equal(signatureNameError('Anything', {}), '');
  assert.equal(signatureNameError('Anything', { first_name: 'Juan' }), '');
  assert.equal(signatureNameError('Juan Dela Cruz', { first_name: 'Juan', middle_name: null, last_name: 'Dela Cruz' }), '');
  assert.equal(signatureNameError('Juan Dela Cruz', { first_name: 'Juan', middle_name: '  ', last_name: 'Dela Cruz' }), '');
  assert.equal(signatureNameError('Juan Peña Dela Cruz', { first_name: 'Juan', middle_name: null, last_name: 'Dela Cruz' }), mismatch);
  assert.equal(signatureNameError('Juan Peña Dela Cruz', { first_name: 'Juan', middle_name: 'Pen\u0303a', last_name: 'Dela Cruz' }), '');
});
