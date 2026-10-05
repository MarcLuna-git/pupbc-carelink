import { useCallback, useLayoutEffect, useState } from 'react';

const readTheme = () => {
  try { return localStorage.getItem('darkMode') === 'true'; }
  catch { return false; }
};

// Mount only in account layouts so public pages always use the light theme.
export default function useAccountTheme() {
  const [darkMode, setDarkMode] = useState(readTheme);

  useLayoutEffect(() => {
    const syncTheme = () => {
      const next = readTheme();
      setDarkMode(next);
      document.documentElement.classList.toggle('dark', next);
    };
    const onStorage = event => {
      if (event.key === 'darkMode' || event.key === null) syncTheme();
    };
    syncTheme();
    window.addEventListener('darkModeChange', syncTheme);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('darkModeChange', syncTheme);
      window.removeEventListener('storage', onStorage);
      document.documentElement.classList.remove('dark');
    };
  }, []);

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode;
    try { localStorage.setItem('darkMode', String(next)); } catch { /* Keep the current session usable. */ }
    window.dispatchEvent(new Event('darkModeChange'));
    setDarkMode(next);
    document.documentElement.classList.toggle('dark', next);
  }, [darkMode]);

  return { darkMode, toggleDarkMode };
}
