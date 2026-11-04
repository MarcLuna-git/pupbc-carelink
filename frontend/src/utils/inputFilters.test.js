import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bloodPressureOnly, codeOnly, decimalOnly, digitsOnly, formatStudentId, nameOnly, wordsOnly } from './inputFilters.js';

test('name fields drop numbers and symbols but keep name punctuation', () => {
  assert.equal(nameOnly('Juan2 Dela Cruz!'), 'Juan Dela Cruz');
  assert.equal(nameOnly("Ma. O'Neil-Santos"), "Ma. O'Neil-Santos");
  assert.equal(nameOnly('Peña'), 'Peña');
  assert.equal(wordsOnly('IT Staff 3 / Admin & Ops'), 'IT Staff  / Admin & Ops');
});

test('number fields drop letters', () => {
  assert.equal(digitsOnly('12a3e'), '123');
  assert.equal(digitsOnly('98765', 3), '987');
  assert.equal(decimalOnly('36.55'), '36.5');
  assert.equal(decimalOnly('3a6.5.1'), '36.5');
  assert.equal(decimalOnly('1234', 2), '12');
  assert.equal(decimalOnly('36.'), '36.');
});

test('blood pressure keeps one slash and three digits a side', () => {
  assert.equal(bloodPressureOnly('120/80'), '120/80');
  assert.equal(bloodPressureOnly('1200/800'), '120/800');
  assert.equal(bloodPressureOnly('12a0//8x0'), '120/80');
  assert.equal(bloodPressureOnly('abc'), '');
});

test('codes and student IDs', () => {
  assert.equal(codeOnly('BSED English!'), 'BSEDEnglish');
  assert.equal(codeOnly('BSBA-HRM'), 'BSBA-HRM');
  assert.equal(formatStudentId('2023001'), '2023-001');
  assert.equal(formatStudentId('202300123bn0'), '2023-00123-BN-0');
  assert.equal(formatStudentId('2023x00123-BN-9'), '2023-00123-BN');
});
