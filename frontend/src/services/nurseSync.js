import api from './api.js';

export const SYNC_INTERVAL = 5000;
const subscribers = new Set();
let timer;
let running = false;
let failures = 0;
let token;
let lastReconcile = 0;
let wakePending = false;
let blockedUntil = 0;

const visible = () => !document.hidden && navigator.onLine !== false;

async function check() {
  clearTimeout(timer);
  if (running) { wakePending = true; return; }
  if (!subscribers.size || !visible()) return;
  if (Date.now() < blockedUntil) {
    timer = setTimeout(check, blockedUntil - Date.now());
    return;
  }
  const currentToken = localStorage.getItem('token');
  if (!currentToken) return;
  if (token !== currentToken) {
    token = currentToken;
    subscribers.forEach(subscriber => { subscriber.seen = null; });
  }
  running = true;
  let delay = SYNC_INTERVAL;
  try {
    const response = await api.get('/nurse/sync');
    if (localStorage.getItem('token') !== currentToken) return;
    const revisions = response.data.data;
    // Also reconcile once a minute: recover individual failed reads and date-based alerts.
    const reconcile = Date.now() - lastReconcile >= 60000;
    if (reconcile) lastReconcile = Date.now();
    await Promise.all([...subscribers].map(async subscriber => {
      const signature = JSON.stringify([...subscriber.topics, 'day'].map(topic => revisions[topic]));
      if (subscriber.seen === signature && !reconcile) return;
      try {
        await subscriber.refresh();
        subscriber.seen = signature;
      } catch {
        // Leave this subscription stale; retry on the next successful check.
      }
    }));
    failures = 0;
  } catch (error) {
    failures += 1;
    delay = Math.max(Math.min(60000, SYNC_INTERVAL * 2 ** failures), Number(error.response?.headers?.['retry-after'] || 0) * 1000);
    if (error.response?.status === 429) blockedUntil = Date.now() + delay;
  } finally {
    running = false;
    if (subscribers.size && visible()) timer = setTimeout(check, wakePending ? Math.max(delay, 1000) : delay);
    wakePending = false;
  }
}

function wake(event) {
  if (!visible()) { clearTimeout(timer); return; }
  if (event?.type !== 'carelink:nurse-change') {
    subscribers.forEach(subscriber => { subscriber.seen = null; });
  }
  check();
}

export function subscribeNurseSync(topics, refresh) {
  const subscriber = { topics, refresh, seen: null };
  subscribers.add(subscriber);
  if (subscribers.size === 1) {
    window.addEventListener('online', wake);
    window.addEventListener('focus', wake);
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('carelink:nurse-change', wake);
    timer = setTimeout(check, SYNC_INTERVAL);
  }
  return () => {
    subscribers.delete(subscriber);
    if (!subscribers.size) {
      clearTimeout(timer);
      token = null;
      lastReconcile = 0;
      blockedUntil = 0;
      window.removeEventListener('online', wake);
      window.removeEventListener('focus', wake);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('carelink:nurse-change', wake);
    }
  };
}
