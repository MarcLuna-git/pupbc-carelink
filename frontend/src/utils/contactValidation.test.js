import assert from 'node:assert/strict';
import test from 'node:test';
import { contactNameError } from './contactValidation.js';

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
