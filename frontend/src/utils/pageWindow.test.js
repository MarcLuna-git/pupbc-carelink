import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pageWindow } from './pageWindow.js';

test('a few pages are all shown', () => {
  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(pageWindow(5, 5), [1, 2, 3, 4, 5]);
  assert.deepEqual(pageWindow(1, 0), [1]);
});

test('many pages show the ends and the neighbours, with gaps marked', () => {
  assert.deepEqual(pageWindow(1, 20), [1, 2, null, 20]);
  assert.deepEqual(pageWindow(2, 20), [1, 2, 3, null, 20]);
  assert.deepEqual(pageWindow(7, 20), [1, null, 6, 7, 8, null, 20]);
  assert.deepEqual(pageWindow(19, 20), [1, null, 18, 19, 20]);
  assert.deepEqual(pageWindow(20, 20), [1, null, 19, 20]);
  assert.deepEqual(pageWindow(3, 6), [1, 2, 3, 4, null, 6]);
});
