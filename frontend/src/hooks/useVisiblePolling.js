import { useEffect, useRef } from 'react';

// For student/kiosk polling. Nurse screens retain their shared revision coordinator.
export default function useVisiblePolling(refresh, interval, enabled = true, scope = '') {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer;
    let running = false;
    let failures = 0;
    let blockedUntil = 0;
    const visible = () => !document.hidden && navigator.onLine !== false;
    const run = async () => {
      clearTimeout(timer);
      if (running || controller.signal.aborted || !visible()) return;
      if (Date.now() < blockedUntil) { timer = setTimeout(run, blockedUntil - Date.now()); return; }
      running = true;
      let delay = interval;
      try { await callback.current(controller.signal); failures = 0; }
      catch (error) {
        delay = Math.max(Math.min(60000, interval * 2 ** ++failures), Number(error.response?.headers?.['retry-after'] || 0) * 1000);
        if (error.response?.status === 429) blockedUntil = Date.now() + delay;
      } finally {
        running = false;
        if (!controller.signal.aborted && visible()) timer = setTimeout(run, delay);
      }
    };
    run();
    window.addEventListener('online', run);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      clearTimeout(timer); controller.abort();
      window.removeEventListener('online', run);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [interval, enabled, scope]);
}
