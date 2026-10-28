import assert from 'node:assert/strict';
import { test } from 'node:test';
import { balance, changeOf, isoDay, personName, reasonText, signed } from './medicineOptions.js';

test('the change of a movement comes from the server, or is worked out from the type for an older backend', () => {
  assert.equal(changeOf({ movement_type: 'dispensed', quantity: 30, quantity_change: -30 }), -30);
  assert.equal(changeOf({ movement_type: 'stock_in', quantity: 20 }), 20);
  assert.equal(changeOf({ movement_type: 'adjustment', quantity: 10 }), -10);
  assert.equal(changeOf({ movement_type: 'wasted', quantity: '2' }), -2);
  assert.equal(signed(50), '+50');
  assert.equal(signed(-30), '-30');
});

test('a missing stock balance shows as a dash, a real zero stays 0', () => {
  assert.equal(balance(undefined), '—');
  assert.equal(balance(null), '—');
  assert.equal(balance(0), 0);
  assert.equal(balance(43), 43);
});

test('reference / reason adds the student and the lot; names and dates are plain', () => {
  const movement = { reason: 'Headache', student: { first_name: 'Ee', last_name: 'Student', student_id: '2026-99001-BN-0' }, batch: { lot_number: 'L-7' } };
  assert.equal(reasonText(movement), 'Headache · Student: Ee Student (2026-99001-BN-0) · Lot L-7');
  assert.equal(reasonText({ reason: 'Initial stock' }), 'Initial stock');
  assert.equal(reasonText({}), '');
  assert.equal(personName({ first_name: 'Jane', last_name: 'Doe' }), 'Jane Doe');
  assert.equal(personName(null), '');
  assert.equal(isoDay('2026-12-31T00:00:00.000000Z'), '2026-12-31');
  assert.equal(isoDay(null), '');
});
