import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const windowTarget = new EventTarget();
const documentTarget = new EventTarget();
documentTarget.hidden = false;
globalThis.window = windowTarget;
globalThis.document = documentTarget;
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
globalThis.localStorage = { getItem: () => 'test-token' };
let revisions = { medicines: 1, appointments: 1, day: '2026-10-09' };
let failure = false;
const get = mock.fn(async () => {
  if (failure) throw new Error('offline');
  return { data: { data: { ...revisions } } };
});
mock.module('./api.js', { defaultExport: { get } });
const { subscribeNurseSync } = await import('./nurseSync.js');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('one change check refreshes only affected subscriptions, pauses and recovers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 100000 });
  const medicine = mock.fn(async () => {});
  const appointment = mock.fn(async () => {});
  const stopMedicine = subscribeNurseSync(['medicines'], medicine);
  const stopAppointment = subscribeNurseSync(['appointments'], appointment);
  t.mock.timers.tick(5000); await flush();
  assert.equal(get.mock.callCount(), 1);
  assert.equal(medicine.mock.callCount(), 1);
  assert.equal(appointment.mock.callCount(), 1);
  t.mock.timers.tick(5000); await flush();
  assert.equal(medicine.mock.callCount(), 1);
  revisions.medicines++;
  t.mock.timers.tick(5000); await flush();
  assert.equal(medicine.mock.callCount(), 2);
  assert.equal(appointment.mock.callCount(), 1);
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  const calls = get.mock.callCount();
  t.mock.timers.tick(20000); await flush();
  assert.equal(get.mock.callCount(), calls);
  document.hidden = false;
  document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(medicine.mock.callCount(), 3);
  failure = true;
  t.mock.timers.tick(5000); await flush();
  const failedCalls = get.mock.callCount();
  t.mock.timers.tick(5000); await flush();
  assert.equal(get.mock.callCount(), failedCalls); // Backoff, not a hot retry loop.
  failure = false;
  window.dispatchEvent(new Event('online')); await flush();
  assert.equal(medicine.mock.callCount(), 4);
  stopMedicine(); stopAppointment();
  const stopped = get.mock.callCount();
  t.mock.timers.tick(60000); await flush();
  assert.equal(get.mock.callCount(), stopped);
});
