import assert from 'node:assert/strict';
import { test } from 'node:test';
import { avatarColor, currentMonth, initials, quantityLabel, typeLabel } from './facultyOptions.js';

test('initials: first and last word, or the first two letters of a single name', () => {
  assert.equal(initials('Maria Santos'), 'MS');
  assert.equal(initials('Karen Dela Cruz'), 'KC');
  assert.equal(initials('  ana   cruz '), 'AC');
  assert.equal(initials('Madonna'), 'MA');
  assert.equal(initials(''), '?');
  assert.equal(initials(null), '?');
});

test('the same name always has the same avatar colour', () => {
  assert.equal(avatarColor('Maria Santos'), avatarColor('Maria Santos'));
  assert.match(avatarColor('John Reyes'), /^bg-/);
  assert.notEqual(new Set(['Maria Santos', 'John Reyes', 'Ana Cruz', 'Luis Pascual', 'Karen Dela Cruz'].map(avatarColor)).size, 1);
});

test('labels', () => {
  assert.equal(typeLabel('full_time'), 'Full-time');
  assert.equal(typeLabel('part_time'), 'Part-time');
  assert.equal(quantityLabel({ quantity: 1, unit: 'tablet' }), '1 tablet');
  assert.equal(quantityLabel({ quantity: 2, unit: null }), '2');
});

test('the current month runs from its first to its last day, in clinic time', () => {
  assert.deepEqual(currentMonth(new Date('2025-10-12T10:00:00+08:00')), { from: '2025-10-01', to: '2025-10-31' });
  assert.deepEqual(currentMonth(new Date('2026-02-10T10:00:00+08:00')), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(currentMonth(new Date('2024-02-10T10:00:00+08:00')), { from: '2024-02-01', to: '2024-02-29' });
  // 11:30 PM on 30 Nov in Manila is still November, even though it is already past midnight in UTC+9 and ahead of UTC.
  assert.deepEqual(currentMonth(new Date('2025-11-30T23:30:00+08:00')), { from: '2025-11-01', to: '2025-11-30' });
});
