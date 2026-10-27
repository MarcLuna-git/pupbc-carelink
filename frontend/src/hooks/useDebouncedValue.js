import { useEffect, useState } from 'react';

// Follows `value` after it has stopped changing for `delay` ms, so typing in a
// search box triggers one request instead of one per keystroke.
export default function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
