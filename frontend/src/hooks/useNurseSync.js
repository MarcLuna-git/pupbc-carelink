import { useEffect, useRef } from 'react';
import { subscribeNurseSync } from '../services/nurseSync';

// Refresh server-backed display state only. Draft form state belongs to the page.
export default function useNurseSync(topics, refresh, scope = '') {
  const callback = useRef(refresh);
  callback.current = refresh;
  const key = topics.join(',');
  useEffect(() => {
    const controller = new AbortController();
    const unsubscribe = subscribeNurseSync(key.split(','), () => callback.current(controller.signal));
    return () => { controller.abort(); unsubscribe(); };
  }, [key, scope]);
}
