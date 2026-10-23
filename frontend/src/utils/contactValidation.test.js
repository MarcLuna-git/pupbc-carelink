import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as contactValidation from './contactValidation.js';

const { contactNameError, contactPhoneError, formatContactPhone, canonicalContactPhone, ownMobileContactError } = contactValidation;

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

test('emergency phones accept the registration formats and distinguish blank from invalid', () => {
  for (const phone of ['09123456789', '+639123456789']) assert.equal(contactPhoneError(phone, true), '');
  for (const phone of ['0912345678', '+63912345678', '08123456789', '+638123456789', '0912345678a', '0912345678@', '639123456789']) {
    assert.equal(contactPhoneError(phone, true), 'Use 09XXXXXXXXX or +639XXXXXXXXX.', phone);
  }
  assert.equal(contactPhoneError('   ', true), 'Phone number is required');
  assert.equal(contactPhoneError('   '), '');
});

test('emergency phone typing matches the Register formatter', () => {
  const source = readFileSync(new URL('../pages/Student/Register.jsx', import.meta.url), 'utf8');
  const registerFormatter = runInNewContext(`(${source.match(/function formatPhilippineMobile\(raw\) \{[\s\S]*?\n\}/)?.[0]})`);
  for (const input of ['', '0', '09', '09123456789', '+', '+6', '+63', '+639', '+639123456789', '639123456789', '09a', '08123456789', '+638123456789', '091234567890']) {
    assert.equal(formatContactPhone(input), registerFormatter(input), input);
  }
  assert.equal(formatContactPhone('639123456789'), '+639123456789');
});

test('loading a saved emergency phone preserves both stored formats', () => {
  const source = readFileSync(new URL('../pages/Student/HealthProfile/HealthProfile.jsx', import.meta.url), 'utf8');
  const mapping = source.match(/setForm\(current => Object\.fromEntries\([\s\S]*?\n        \}\)\)\);/)?.[0];
  assert.ok(mapping, 'Health Profile load mapping exists');
  for (const phone of ['+639123456789', '09123456789']) {
    let loaded;
    runInNewContext(mapping, {
      data: { data: { emergency_phone: phone } },
      getManilaDateString: () => '2026-10-24',
      setForm: (update) => { loaded = update({ emergency_phone: '' }); },
    });
    assert.equal(loaded.emergency_phone, phone);
  }
});

test('own mobile comparison treats all three Philippine prefixes as equivalent', () => {
  const message = 'Emergency contact number must be different from your mobile number.';
  assert.equal(canonicalContactPhone('09171234567'), '+639171234567');
  assert.equal(canonicalContactPhone('639171234567'), '+639171234567');
  assert.equal(canonicalContactPhone('+639171234567'), '+639171234567');
  for (const phone of ['', '   ', '0917123456', '+638171234567', 'not a phone', null]) {
    assert.equal(canonicalContactPhone(phone), null, String(phone));
  }
  assert.equal(ownMobileContactError('09171234567', '+639171234567'), message);
  assert.equal(ownMobileContactError('639171234567', '09171234567'), message);
  assert.equal(ownMobileContactError('+639171234567', '639171234567'), message);
  assert.equal(ownMobileContactError('09171234567', '09987654321'), '');
  assert.equal(ownMobileContactError('', ''), '');
  assert.equal(ownMobileContactError('bad', 'bad'), '');
});
