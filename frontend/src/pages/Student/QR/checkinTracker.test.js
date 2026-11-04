import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUEUE_STATUS_NOTES, checkinStepIndex } from './checkinTracker.js';

const step = (status, appointmentStatus = 'approved') => checkinStepIndex(status ? { status } : null, { status: appointmentStatus });

test('every queue status lands on a check-in step', () => {
  assert.equal(step(null), 0);
  assert.equal(step('waiting'), 1);
  assert.equal(step('skipped'), 1);
  assert.equal(step('on_hold'), 1);
  assert.equal(step('called'), 2);
  assert.equal(step('serving'), 2);
  assert.equal(step('completed'), 3);
  assert.equal(step(null, 'completed'), 3);
});

test('called, skipped and on hold explain themselves', () => {
  assert.match(QUEUE_STATUS_NOTES.called, /called/);
  assert.ok(QUEUE_STATUS_NOTES.skipped && QUEUE_STATUS_NOTES.on_hold);
  assert.equal(QUEUE_STATUS_NOTES.waiting, undefined);
});
